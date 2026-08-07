import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { loadRoomFromDatabase, saveRoomToDatabase } from "./database.js";

import { Asset, Debt, Event, Pending, Player, State } from "./state.js";

const root = path.resolve(process.cwd(), "data");

const rooms = path.join(root, "rooms");

const backups = path.join(root, "backups");

const corrupt = path.join(root, "corrupt");

for (const directory of [rooms, backups, corrupt]) {
  fs.mkdirSync(directory, {
    recursive: true,
  });
}

export const code = () => crypto.randomBytes(4).toString("hex").toUpperCase();

export const hash = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

const clean = (value: string) => value.replace(/[^A-Z0-9-]/gi, "");

const file = (saveCode: string) => path.join(rooms, `${clean(saveCode)}.json`);

export function serialize(state: State, pinHash: string) {
  return {
    format: "BancoMundoSave",
    version: "0.4.2",
    savedAt: new Date().toISOString(),
    pinHash,
    state: JSON.parse(JSON.stringify(state)),
  };
}

export function atomicSave(state: State, pinHash: string) {
  state.lastSavedAt = Date.now();

  const serialized = serialize(state, pinHash);

  const output = JSON.stringify(serialized, null, 2);

  const target = file(state.saveCode);

  const temporary = `${target}.tmp`;

  if (fs.existsSync(target)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");

    fs.copyFileSync(
      target,
      path.join(backups, `${clean(state.saveCode)}-${stamp}.json`),
    );

    const roomBackups = fs
      .readdirSync(backups)
      .filter((name) => name.startsWith(`${clean(state.saveCode)}-`))
      .sort()
      .reverse();

    for (const oldBackup of roomBackups.slice(10)) {
      fs.rmSync(path.join(backups, oldBackup));
    }
  }

  fs.writeFileSync(temporary, output, "utf8");

  fs.renameSync(temporary, target);

  const gameStatus = state.ended ? "ended" : state.paused ? "paused" : "active";

  void saveRoomToDatabase(
    state.saveCode,
    state.roomName,
    serialized.state,
    pinHash,
    gameStatus,
  ).catch((error) => {
    console.error("Falha ao salvar a partida no PostgreSQL:", error);
  });
}

export function loadSave(saveCode: string) {
  const target = file(saveCode);

  if (!fs.existsSync(target)) {
    throw Error("Partida salva não encontrada.");
  }

  try {
    const content = fs.readFileSync(target, "utf8");

    const save = JSON.parse(content);

    if (save.format !== "BancoMundoSave" || !save.state?.players) {
      throw Error("Formato inválido.");
    }

    return save;
  } catch {
    const isolatedFile = path.join(
      corrupt,
      `${path.basename(target)}-${Date.now()}`,
    );

    fs.copyFileSync(target, isolatedFile);

    throw Error("O salvamento está corrompido. Uma cópia foi isolada.");
  }
}

export async function loadSaveWithFallback(saveCode: string) {
  try {
    const databaseSave = await loadRoomFromDatabase(saveCode);

    if (databaseSave) {
      return databaseSave;
    }
  } catch (error) {
    console.error("Falha ao carregar a partida do PostgreSQL:", error);
  }

  return loadSave(saveCode);
}

export function restore(raw: any) {
  const state = new State();

  const savedState = raw.state;

  state.saveCode = savedState.saveCode;

  state.hostId = savedState.hostId;

  state.roomName = savedState.roomName;

  state.locked = Boolean(savedState.locked);

  state.ended = Boolean(savedState.ended);

  state.paused = false;

  state.maxPlayers = savedState.maxPlayers || 6;

  state.seq = savedState.seq || 0;

  state.lastSavedAt = savedState.lastSavedAt || 0;

  for (const [playerId, playerData] of Object.entries<any>(
    savedState.players || {},
  )) {
    const player = new Player();

    Object.assign(player, {
      id: playerData.id || playerId,

      deviceToken: playerData.deviceToken || "",

      recoveryCode: playerData.recoveryCode || "",

      name: playerData.name || "Jogador",

      balance: Number(playerData.balance) || 0,

      connected: false,

      sent: Number(playerData.sent) || 0,

      received: Number(playerData.received) || 0,

      bankOps: Number(playerData.bankOps) || 0,
    });

    for (const assetData of playerData.assets || []) {
      const asset = new Asset();

      Object.assign(asset, {
        id: assetData.id || code(),

        catalogId: assetData.catalogId || "",

        kind: assetData.kind || "",

        name: assetData.name || "Patrimônio",

        development: Math.max(
          0,
          Math.min(5, Number(assetData.development) || 0),
        ),

        mortgaged: Boolean(assetData.mortgaged),

        purchase: Math.max(0, Number(assetData.purchase) || 0),

        mortgage: Math.max(0, Number(assetData.mortgage) || 0),

        houseCost: Math.max(0, Number(assetData.houseCost) || 0),

        condominiumCost: Math.max(0, Number(assetData.condominiumCost) || 0),
      });

      player.assets.push(asset);
    }

    state.players.set(playerId, player);
  }

  for (const [requestId, requestData] of Object.entries<any>(
    savedState.pending || {},
  )) {
    const request = new Pending();

    Object.assign(request, requestData);

    request.id = requestData.id || requestId;

    request.amount = Number(requestData.amount) || 0;

    request.development = Math.max(
      0,
      Math.min(5, Number(requestData.development) || 0),
    );

    request.purchase = Math.max(0, Number(requestData.purchase) || 0);

    request.houseCost = Math.max(0, Number(requestData.houseCost) || 0);

    request.condominiumCost = Math.max(
      0,
      Number(requestData.condominiumCost) || 0,
    );

    request.mortgageValue = Math.max(0, Number(requestData.mortgageValue) || 0);

    state.pending.set(requestId, request);
  }

  for (const [agreementId, agreementData] of Object.entries<any>(
    savedState.debts || {},
  )) {
    const agreement = new Debt();

    Object.assign(agreement, {
      id: agreementData.id || agreementId,

      debtorId: agreementData.debtorId || "",

      debtorName: agreementData.debtorName || "",

      creditorId: agreementData.creditorId || "",

      creditorName: agreementData.creditorName || "",

      originalAmount: Math.max(0, Number(agreementData.originalAmount) || 0),

      cashOffered: Math.max(0, Number(agreementData.cashOffered) || 0),

      note: agreementData.note || "",

      at: Number(agreementData.at) || 0,
    });

    for (const assetId of agreementData.assetIds || []) {
      agreement.assetIds.push(String(assetId));
    }

    state.debts.set(agreementId, agreement);
  }

  for (const eventData of savedState.events || []) {
    const event = new Event();

    Object.assign(event, eventData);

    event.seq = Number(eventData.seq) || 0;

    event.at = Number(eventData.at) || 0;

    state.events.push(event);
  }

  return state;
}

export function listSaves() {
  return fs
    .readdirSync(rooms)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      try {
        const content = fs.readFileSync(path.join(rooms, name), "utf8");

        const save = JSON.parse(content);

        return {
          saveCode: save.state.saveCode,

          roomName: save.state.roomName,

          players: Object.keys(save.state.players || {}).length,

          lastSavedAt: save.state.lastSavedAt,

          paused: Boolean(save.state.paused),

          ended: Boolean(save.state.ended),
        };
      } catch {
        return null;
      }
    })
    .filter((save): save is NonNullable<typeof save> => Boolean(save));
}

export function importSave(raw: any) {
  if (raw?.format !== "BancoMundoSave" || !raw.state?.players) {
    throw Error("Backup inválido.");
  }

  raw.version = "0.4.2";

  raw.state.saveCode = code();

  raw.state.paused = true;

  const target = file(raw.state.saveCode);

  fs.writeFileSync(target, JSON.stringify(raw, null, 2), "utf8");

  return raw.state.saveCode;
}

export function getSavePath(saveCode: string) {
  return file(saveCode);
}
