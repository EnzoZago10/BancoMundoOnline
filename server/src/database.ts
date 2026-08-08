import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

export const databaseEnabled = Boolean(connectionString);

export const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
  : null;

export async function testDatabaseConnection() {
  if (!pool) {
    console.log(
      "DATABASE_URL não configurada. Salvamento local será utilizado.",
    );

    return false;
  }

  const result = await pool.query(
    "select current_timestamp as connected_at",
  );

  console.log(
    "PostgreSQL conectado:",
    result.rows[0].connected_at,
  );

  return true;
}

export async function saveRoomToDatabase(
  saveCode: string,
  roomName: string,
  stateData: unknown,
  pinHash: string,
  gameStatus: "active" | "paused" | "ended" | "archived",
) {
  if (!pool) {
    return false;
  }

  await pool.query("begin");

  try {
    const previousSave = await pool.query(
      `
        select state_data, pin_hash, format_version
        from public.room_saves
        where save_code = $1
      `,
      [saveCode],
    );

    if (previousSave.rowCount && previousSave.rows[0]) {
      await pool.query(
        `
          insert into public.room_backups (
            save_code,
            state_data,
            pin_hash,
            format_version
          )
          values ($1, $2, $3, $4)
        `,
        [
          saveCode,
          previousSave.rows[0].state_data,
          previousSave.rows[0].pin_hash,
          previousSave.rows[0].format_version,
        ],
      );
    }

    await pool.query(
      `
        insert into public.room_saves (
          save_code,
          room_name,
          state_data,
          pin_hash,
          game_status,
          format_version
        )
        values ($1, $2, $3, $4, $5, $6)
        on conflict (save_code)
        do update set
          room_name = excluded.room_name,
          state_data = excluded.state_data,
          pin_hash = excluded.pin_hash,
          game_status = excluded.game_status,
          format_version = excluded.format_version
      `,
      [
        saveCode,
        roomName,
        stateData,
        pinHash,
        gameStatus,
        "0.4.3.3",
      ],
    );

    await pool.query(
      `
        delete from public.room_backups
        where id in (
          select id
          from public.room_backups
          where save_code = $1
          order by created_at desc
          offset 10
        )
      `,
      [saveCode],
    );

    await pool.query("commit");

    return true;
  } catch (error) {
    await pool.query("rollback");

    throw error;
  }
}

export async function loadRoomFromDatabase(
  saveCode: string,
) {
  if (!pool) {
    return null;
  }

  const result = await pool.query(
    `
      select
        save_code,
        room_name,
        state_data,
        pin_hash,
        game_status,
        format_version,
        created_at,
        updated_at
      from public.room_saves
      where save_code = $1
      limit 1
    `,
    [saveCode],
  );

  if (!result.rowCount || !result.rows[0]) {
    return null;
  }

  const row = result.rows[0];

  return {
    format: "BancoMundoSave",
    version: row.format_version,
    savedAt: row.updated_at,
    pinHash: row.pin_hash,
    state: row.state_data,
  };
}

export async function listRoomSavesFromDatabase() {
  if (!pool) {
    return null;
  }

  const result = await pool.query(
    `
      select
        save_code,
        room_name,
        state_data,
        game_status,
        created_at,
        updated_at
      from public.room_saves
      where game_status <> 'archived'
      order by updated_at desc
    `,
  );

  return result.rows.map((row) => ({
    saveCode: row.save_code,
    roomName: row.room_name,
    players: Object.keys(
      row.state_data?.players || {},
    ).length,
    lastSavedAt:
      row.state_data?.lastSavedAt ||
      new Date(row.updated_at).getTime(),
    paused: row.game_status === "paused",
    ended: row.game_status === "ended",
  }));
}
