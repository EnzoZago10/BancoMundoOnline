import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { databaseEnabled, pool, saveRoomToDatabase, loadRoomFromDatabase } from "../src/database.ts";

test("PostgreSQL CAS: instância antiga não alcança e sobrescreve revisão concorrente",{skip:!databaseEnabled},async()=>{
  assert.ok(pool);
  const saveCode=`CAS-${crypto.randomBytes(6).toString("hex")}`;
  await pool!.query(`insert into public.room_saves(save_code,room_name,state_data,private_data,pin_hash,game_status,format_version,revision) values($1,'CAS', $2, '{}', 'pin', 'active', 4, 10)`,[saveCode,{saveCode,revision:10,marker:"base"}]);
  try{
    // A e B leram a mesma base 10. B chega primeiro e grava 11.
    const b=await saveRoomToDatabase(saveCode,"CAS",{saveCode,revision:11,marker:"B"},{},"pin","active",10,11);
    assert.equal(b,"saved");
    // A continua baseada em 10. Não pode gravar 11 nem inventar 12 para "alcançar" B.
    const a=await saveRoomToDatabase(saveCode,"CAS",{saveCode,revision:11,marker:"A"},{},"pin","active",10,11);
    assert.equal(a,"conflict");
    const loaded=await loadRoomFromDatabase(saveCode);assert.ok(loaded);assert.equal(loaded!.state.marker,"B");assert.equal(loaded!.state.revision,11);
  }finally{
    await pool!.query(`delete from public.room_backups where save_code=$1`,[saveCode]);
    await pool!.query(`delete from public.room_saves where save_code=$1`,[saveCode]);
    await pool!.query(`delete from public.active_room_leases where save_code=$1`,[saveCode]);
  }
});
