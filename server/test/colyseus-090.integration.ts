import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import { AddressInfo } from "node:net";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Client as ColyseusClient } from "@colyseus/sdk";
import { BankRoom } from "../src/room.ts";
import { State, Player } from "../src/state.ts";
import { OFFICIAL_RULES } from "../src/domain/ruleset.ts";
import { atomicSave } from "../src/persistence.ts";
import { hashPin, hashToken } from "../src/domain/security.ts";

async function withServer(run:(endpoint:string)=>Promise<void>){
  const server=http.createServer();
  const game=new Server({transport:new WebSocketTransport({server})});
  game.define("bank_room",BankRoom).filterBy(["resumeCode"]);
  await game.listen(0);
  const port=(server.address() as AddressInfo).port;
  try{await run(`http://127.0.0.1:${port}`);}finally{await game.gracefullyShutdown(false);}
}
const waitFor=(fn:()=>boolean,ms=2500)=>new Promise<void>((resolve,reject)=>{const start=Date.now();const tick=()=>{let ready=false;try{ready=Boolean(fn());}catch{ready=false;}if(ready)return resolve();if(Date.now()-start>ms)return reject(Error("timeout aguardando estado Colyseus"));setTimeout(tick,20);};tick();});

test("Colyseus real: compra server-authoritative sincroniza para dois clientes",async()=>withServer(async endpoint=>{
  const ca=new ColyseusClient(endpoint),cb=new ColyseusClient(endpoint);
  const a=await ca.create("bank_room",{name:"A",pin:"1234",deviceToken:"dev-a",mode:"assisted",operationId:crypto.randomUUID()});
  a.onMessage("action_feedback",()=>{});
  const aReady=new Promise<any>(resolve=>a.onMessage("profile_recovered",resolve));a.send("client_ready");const aProfile=await aReady;assert.equal(aProfile.name,"A");assert.ok(aProfile.playerId);assert.ok(aProfile.recoveryCode);
  const b=await cb.joinById(a.roomId,{name:"B",pin:"1234",deviceToken:"dev-b"});
  b.onMessage("action_feedback",()=>{});
  const bReady=new Promise<any>(resolve=>b.onMessage("profile_recovered",resolve));b.send("client_ready");const bProfile=await bReady;assert.equal(bProfile.name,"B");assert.ok(bProfile.playerId);
  await waitFor(()=>a.state.players.size===2&&b.state.players.size===2);
  const aId=[...a.state.players.values()].find((p:any)=>p.name==="A")!.id;
  a.send("asset",{catalogId:"londres",development:4,purchase:1});
  await waitFor(()=>a.state.pending.size===1);
  const pending=[...a.state.pending.values()][0] as any;
  a.send("respond",{id:pending.id,accept:true});
  await waitFor(()=>[...b.state.players.get(aId).assets].some((x:any)=>x.catalogId==="londres"));
  const asset=[...b.state.players.get(aId).assets].find((x:any)=>x.catalogId==="londres") as any;
  assert.equal(asset.development,0);assert.equal(asset.purchase,240000);
  await a.leave();await b.leave();
}));


test("Colyseus real: ruleset personalizado é sincronizado no estado inicial",async()=>withServer(async endpoint=>{
  const client=new ColyseusClient(endpoint);
  const room=await client.create("bank_room",{name:"Rules",pin:"1234",deviceToken:"rules-device",mode:"assisted",operationId:crypto.randomUUID(),rules:{...OFFICIAL_RULES,preset:"custom",requireFullGroupForBuilding:false,requireEvenBuilding:true}});
  const ready=new Promise<any>(resolve=>room.onMessage("profile_recovered",resolve));room.send("client_ready");const profile=await ready;assert.equal(profile.name,"Rules");assert.ok(profile.playerId);
  await waitFor(()=>Boolean((room.state as any).rulesSnapshot));
  const snapshot=JSON.parse((room.state as any).rulesSnapshot);
  assert.equal(snapshot.requireFullGroupForBuilding,false);
  assert.equal(snapshot.requireEvenBuilding,true);
  assert.equal(snapshot.preset,"custom");
  const nested=(room.state as any).rules;
  if(nested){assert.equal(nested.requireFullGroupForBuilding,false);assert.equal(nested.requireEvenBuilding,true);}
  await room.leave();
}));

test("Colyseus real: sala bloqueada rejeita novo jogador e aceita recovery token conhecido",async()=>{
  const state=new State();state.saveCode=`TST${Date.now().toString(36).toUpperCase()}`;Object.assign(state.rules,OFFICIAL_RULES);state.locked=true;
  const p=new Player();p.id="player-a";p.name="A";p.balance=2_558_000;p.recoveryTokenHash=hashToken("RECOVERY-KNOWN-090");p.deviceTokenHash=hashToken("old-device");state.players.set(p.id,p);state.hostId=p.id;
  const pinHash=await hashPin("1234");await atomicSave(state,pinHash);
  await withServer(async endpoint=>{
    const ca=new ColyseusClient(endpoint),cb=new ColyseusClient(endpoint);
    const a=await ca.joinOrCreate("bank_room",{resumeCode:state.saveCode,name:"A",pin:"1234",recoveryCode:"RECOVERY-KNOWN-090",deviceToken:"new-a"});
    const ready=new Promise<any>(resolve=>a.onMessage("profile_recovered",resolve));a.send("client_ready");const profile=await ready;assert.equal(profile.playerId,"player-a");assert.equal(profile.recoveryCode,"RECOVERY-KNOWN-090");
    await waitFor(()=>Boolean((a.state as any)?.players?.get?.("player-a")?.connected===true));assert.equal((a.state as any).players.size,1);
    await assert.rejects(()=>cb.joinById(a.roomId,{name:"B",pin:"1234",deviceToken:"dev-b"}),/bloqueada|locked/i);
    await a.leave();
  });
});

test("Colyseus real: sala simples pode ser criada e acessada sem PIN",async()=>withServer(async endpoint=>{
  const ca=new ColyseusClient(endpoint),cb=new ColyseusClient(endpoint);
  const a=await ca.create("bank_room",{name:"Sem PIN",deviceToken:"no-pin-a",mode:"assisted",operationId:crypto.randomUUID()});
  const aReady=new Promise<any>(resolve=>a.onMessage("profile_recovered",resolve));a.send("client_ready");await aReady;
  const b=await cb.joinById(a.roomId,{name:"Amigo",deviceToken:"no-pin-b"});
  const bReady=new Promise<any>(resolve=>b.onMessage("profile_recovered",resolve));b.send("client_ready");await bReady;
  await waitFor(()=>a.state.players.size===2&&b.state.players.size===2);
  assert.equal(a.state.players.size,2);
  await a.leave();await b.leave();
}));

test("Colyseus real: sala protegida pede PIN somente quando necessário",async()=>withServer(async endpoint=>{
  const ca=new ColyseusClient(endpoint),cb=new ColyseusClient(endpoint);
  const a=await ca.create("bank_room",{name:"ADM",pin:"1234",deviceToken:"pin-a",mode:"assisted",operationId:crypto.randomUUID()});
  const ready=new Promise<any>(resolve=>a.onMessage("profile_recovered",resolve));a.send("client_ready");await ready;
  await assert.rejects(()=>cb.joinById(a.roomId,{name:"Sem senha",deviceToken:"pin-b"}),/PIN_REQUIRED/);
  await assert.rejects(()=>cb.joinById(a.roomId,{name:"Senha errada",pin:"9999",deviceToken:"pin-b"}),/PIN incorreto/);
  const b=await cb.joinById(a.roomId,{name:"Com senha",pin:"1234",deviceToken:"pin-b"});
  const bReady=new Promise<any>(resolve=>b.onMessage("profile_recovered",resolve));b.send("client_ready");await bReady;
  await b.leave();await a.leave();
}));


test("Colyseus real: ADM baixa backup do estado ativo sem expor segredos",async()=>withServer(async endpoint=>{
  const client=new ColyseusClient(endpoint);
  const room=await client.create("bank_room",{name:"Backup ADM",pin:"1234",deviceToken:"backup-device",mode:"assisted",operationId:crypto.randomUUID()});
  room.onMessage("action_feedback",()=>{});
  const ready=new Promise<any>(resolve=>room.onMessage("profile_recovered",resolve));room.send("client_ready");const profile=await ready;assert.ok(profile.recoveryCode);
  const message=new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("timeout aguardando backup")),3000);room.onMessage("backup",data=>{clearTimeout(timer);resolve(data);});});
  room.send("backup");const data=await message;assert.match(data.filename,/BancoMundo-.*-v0\.9\.3\.json/);const backup=JSON.parse(data.content);assert.equal(backup.format,"BancoMundoSave");assert.equal(backup.state.saveCode,(room.state as any).saveCode);assert.equal("pinHash" in backup,false);assert.equal("privateData" in backup,false);
  const player=Object.values<any>(backup.state.players)[0];assert.equal("recoveryTokenHash" in player,false);assert.equal("deviceTokenHash" in player,false);
  await room.leave();
}));
