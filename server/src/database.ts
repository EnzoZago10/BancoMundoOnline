import crypto from "node:crypto";
import pg from "pg";
import { SAVE_FORMAT_VERSION } from "./version.js";
const { Pool } = pg;
const connectionString=process.env.DATABASE_URL;
export const databaseEnabled=Boolean(connectionString);
export const INSTANCE_ID=process.env.INSTANCE_ID||crypto.randomUUID();
export const pool=connectionString?new Pool({connectionString,ssl:process.env.PGSSL==="disable"?false:{rejectUnauthorized:false},max:5,idleTimeoutMillis:30000,connectionTimeoutMillis:10000}):null;
export type DatabaseSaveResult="saved"|"conflict"|"disabled";

export async function testDatabaseConnection(){if(!pool){console.log("DATABASE_URL não configurada. Salvamento local será utilizado.");return false;}const result=await pool.query("select current_timestamp as connected_at");console.log("PostgreSQL conectado:",result.rows[0].connected_at,"instance",INSTANCE_ID);return true;}

export async function saveRoomToDatabase(saveCode:string,roomName:string,stateData:any,privateData:any,pinHash:string,gameStatus:"active"|"paused"|"ended"|"archived",expectedRevision:number,newRevision:number):Promise<DatabaseSaveResult>{
  if(!Number.isInteger(expectedRevision)||expectedRevision<0||newRevision!==expectedRevision+1)throw Error("Revisão de save inválida: CAS exige exatamente expectedRevision + 1.");
  if(!pool)return"disabled";
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const current=await client.query(`select state_data,private_data,pin_hash,format_version,revision from public.room_saves where save_code=$1 for update`,[saveCode]);
    if(!current.rowCount){
      const inserted=await client.query(`insert into public.room_saves(save_code,room_name,state_data,private_data,pin_hash,game_status,format_version,revision) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(save_code) do nothing returning revision`,[saveCode,roomName,stateData,privateData,pinHash,gameStatus,SAVE_FORMAT_VERSION,newRevision]);
      if(!inserted.rowCount){await client.query("ROLLBACK");return"conflict";}
      await client.query("COMMIT");return"saved";
    }
    const currentRevision=Number(current.rows[0].revision??0);
    if(currentRevision!==expectedRevision){await client.query("ROLLBACK");return"conflict";}
    await client.query(`insert into public.room_backups(save_code,state_data,private_data,pin_hash,format_version,revision) values($1,$2,$3,$4,$5,$6)`,[saveCode,current.rows[0].state_data,current.rows[0].private_data??{},current.rows[0].pin_hash,current.rows[0].format_version,currentRevision]);
    const updated=await client.query(`update public.room_saves set room_name=$2,state_data=$3,private_data=$4,pin_hash=$5,game_status=$6,format_version=$7,revision=$8,updated_at=now() where save_code=$1 and revision=$9 returning revision`,[saveCode,roomName,stateData,privateData,pinHash,gameStatus,SAVE_FORMAT_VERSION,newRevision,expectedRevision]);
    if(!updated.rowCount){await client.query("ROLLBACK");return"conflict";}
    await client.query(`delete from public.room_backups where id in(select id from public.room_backups where save_code=$1 order by created_at desc offset 10)`,[saveCode]);
    await client.query("COMMIT");return"saved";
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}

export async function loadRoomFromDatabase(saveCode:string){if(!pool)return null;const result=await pool.query(`select save_code,room_name,state_data,private_data,pin_hash,game_status,format_version,revision,created_at,updated_at from public.room_saves where save_code=$1 limit 1`,[saveCode]);if(!result.rowCount)return null;const row=result.rows[0],state={...(row.state_data||{}),revision:Number(row.revision)||0};return{format:"BancoMundoSave",version:Number(row.format_version)||1,savedAt:new Date(row.updated_at).toISOString(),pinHash:row.pin_hash,privateData:row.private_data||{},state};}

export async function acquireRoomLease(saveCode:string,ttlMs=45_000){if(!pool)return true;const leaseUntil=new Date(Date.now()+ttlMs);const r=await pool.query(`insert into public.active_room_leases(save_code,instance_id,lease_until) values($1,$2,$3) on conflict(save_code) do update set instance_id=excluded.instance_id,lease_until=excluded.lease_until where public.active_room_leases.instance_id=excluded.instance_id or public.active_room_leases.lease_until<now() returning instance_id`,[saveCode,INSTANCE_ID,leaseUntil]);return Boolean(r.rowCount);}
export async function renewRoomLease(saveCode:string,ttlMs=45_000){if(!pool)return true;const r=await pool.query(`update public.active_room_leases set lease_until=$3 where save_code=$1 and instance_id=$2 returning save_code`,[saveCode,INSTANCE_ID,new Date(Date.now()+ttlMs)]);return Boolean(r.rowCount);}
export async function releaseRoomLease(saveCode:string){if(!pool)return;await pool.query(`delete from public.active_room_leases where save_code=$1 and instance_id=$2`,[saveCode,INSTANCE_ID]);}

export async function recordSharedRateLimit(key:string,limit:number,windowMs:number){if(!pool)return null;const cutoff=new Date(Date.now()-windowMs),now=new Date();const r=await pool.query(`insert into public.auth_rate_limits(rate_key,window_start,attempt_count,updated_at) values($1,$2,1,$2) on conflict(rate_key) do update set window_start=case when public.auth_rate_limits.window_start<$3 then $2 else public.auth_rate_limits.window_start end,attempt_count=case when public.auth_rate_limits.window_start<$3 then 1 else public.auth_rate_limits.attempt_count+1 end,updated_at=$2 returning attempt_count`,[key,now,cutoff]);return Number(r.rows[0]?.attempt_count||0)>limit;}
