import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "../src/domain/game-engine.ts";
import { stateWithPlayers } from "./helpers.ts";

test("fiança oficial só pode ser paga após a terceira tentativa",()=>{
  const s=stateWithPlayers("a","b"),g=new GameEngine(s);g.startTurnTracker(["a","b"]);g.sendToJail("a");
  assert.throws(()=>g.payJailFine("a"),/terceira tentativa/i);
  g.failedJailAttempt("a");assert.throws(()=>g.payJailFine("a"),/terceira tentativa/i);
  g.failedJailAttempt("a");g.failedJailAttempt("a");const before=s.players.get("a")!.balance;const result=g.payJailFine("a");
  assert.equal(result.status,"paid");assert.equal(s.players.get("a")!.balance,before-50_000);assert.equal(s.players.get("a")!.jailed,false);
});

test("fiança opcional exige ao menos uma tentativa perdida",()=>{
  const s=stateWithPlayers("a","b");s.rules.allowEarlyJailFine=true;const g=new GameEngine(s);g.startTurnTracker(["a","b"]);g.sendToJail("a");
  assert.throws(()=>g.payJailFine("a"),/pelo menos uma tentativa/i);g.failedJailAttempt("a");assert.equal(g.payJailFine("a").status,"paid");
});

test("terceira tentativa cria ação obrigatória e fiança sem saldo vira Liability",()=>{
  const s=stateWithPlayers("a","b"),g=new GameEngine(s);g.startTurnTracker(["a","b"]);g.sendToJail("a");const p=s.players.get("a")!;p.balance=10_000;
  g.failedJailAttempt("a");g.failedJailAttempt("a");assert.equal(g.failedJailAttempt("a"),true);assert.equal(s.requiredAction,"PAY_JAIL_FINE");assert.throws(()=>g.endTurn("a"),/Resolva PAY_JAIL_FINE/);
  const r=g.payJailFine("a");assert.equal(r.status,"liability");const l=s.liabilities.get(r.liabilityId)!;assert.equal(l.creditorType,"BANK");assert.equal(l.amount,50_000);assert.equal(p.balance,10_000);assert.equal(p.jailed,true);
  p.balance=50_000;g.payLiability("a",l.id);assert.equal(l.status,"paid");assert.equal(p.jailed,false);assert.equal(s.requiredAction,"");
});

test("aluguel é calculado pelo servidor, atualiza estatísticas e cria Liability sem saldo",()=>{
  const s=stateWithPlayers("a","b"),g=new GameEngine(s);const london=g.purchaseAsset("b","londres");const a=s.players.get("a")!,b=s.players.get("b")!;a.balance=500_000;
  const beforeB=b.balance;const paid=g.resolveRent("a","londres");assert.equal(paid.status,"paid");assert.equal(paid.amount,20_000);assert.equal(a.stats.rentPaid,20_000);assert.equal(b.stats.rentReceived,20_000);assert.equal(b.balance,beforeB+20_000);
  london.development=1;s.housesRemaining=79;a.balance=10_000;const debt=g.resolveRent("a","londres");assert.equal(debt.status,"liability");if(!("liabilityId" in debt))throw Error("expected liability");const l=s.liabilities.get(debt.liabilityId)!;assert.equal(l.amount,100_000);assert.equal(a.balance,10_000);assert.equal(l.creditorPlayerId,"b");
});

test("instituição resolve taxa real e dobra com as seis",()=>{
  const s=stateWithPlayers("a","b"),g=new GameEngine(s);for(const id of ["omc","onu","oit","otan","ipcc","oms"])g.purchaseAsset("b",id);const a=s.players.get("a")!,b=s.players.get("b")!;a.balance=2_000_000;const before=b.balance;
  const r=g.resolveInstitution("a","omc",7);assert.equal(r.status,"paid");if(!("ownsAll" in r))throw Error("expected payment");assert.equal(r.ownsAll,true);assert.equal(r.amount,700_000);assert.equal(b.balance,before+700_000);
});

test("venda de título ao banco exige dívida aberta explícita",()=>{
  const s=stateWithPlayers("a","b"),g=new GameEngine(s),asset=g.purchaseAsset("a","cidade-cabo");assert.throws(()=>g.sellAssetToBank("a",asset.id,""),/dívida aberta/i);const l=g.createLiability({debtorId:"a",creditorType:"BANK",amount:1_000_000,reason:"teste"});const before=s.players.get("a")!.balance;assert.equal(g.sellAssetToBank("a",asset.id,l.id),60_000);assert.equal(s.players.get("a")!.balance,before+60_000);
});

test("falência não apaga múltiplos credores silenciosamente",()=>{
  const s=stateWithPlayers("a","b","c"),g=new GameEngine(s);s.players.get("a")!.balance=0;const l1=g.createLiability({debtorId:"a",creditorType:"PLAYER",creditorPlayerId:"b",amount:100_000,reason:"1"});g.createLiability({debtorId:"a",creditorType:"PLAYER",creditorPlayerId:"c",amount:100_000,reason:"2"});assert.throws(()=>g.declareBankruptcy("a",l1.id),/múltiplas obrigações/i);assert.equal([...s.liabilities.values()].filter(x=>x.status==="open").length,2);
});

test("Trade transfere Habeas Corpus e rollback restaura todo estado",()=>{
  const s=stateWithPlayers("a","b"),g=new GameEngine(s);s.players.get("a")!.habeasCorpus=1;const t=g.proposeTrade({proposerId:"a",recipientId:"b",proposerCash:0,recipientCash:0,proposerAssetIds:[],recipientAssetIds:[],proposerHabeasCount:1});g.respondTrade("b",t.id,true);assert.equal(s.players.get("a")!.habeasCorpus,0);assert.equal(s.players.get("b")!.habeasCorpus,1);
  s.players.get("a")!.habeasCorpus=1;const t2=g.proposeTrade({proposerId:"a",recipientId:"b",proposerCash:1000,recipientCash:0,proposerAssetIds:[],recipientAssetIds:[],proposerHabeasCount:1});const a=s.players.get("a")!,b=s.players.get("b")!,ab=a.balance,bb=b.balance,ah=a.habeasCorpus,bh=b.habeasCorpus;const original=g.assertInvariants.bind(g);(g as any).assertInvariants=()=>{throw Error("forced invariant");};assert.throws(()=>g.respondTrade("b",t2.id,true),/forced invariant/);(g as any).assertInvariants=original;assert.equal(a.balance,ab);assert.equal(b.balance,bb);assert.equal(a.habeasCorpus,ah);assert.equal(b.habeasCorpus,bh);assert.ok(s.trades.has(t2.id));original();
});

test("Settlement é atômico e contabiliza dinheiro enviado/recebido",()=>{
  const s=stateWithPlayers("a","b"),g=new GameEngine(s);const l=g.createLiability({debtorId:"a",creditorType:"PLAYER",creditorPlayerId:"b",amount:100_000,reason:"aluguel"});const set=g.proposeSettlement({debtorId:"a",liabilityId:l.id,cash:50_000,assetIds:[],note:"acordo"});const a=s.players.get("a")!,b=s.players.get("b")!,as=a.sent,br=b.received;g.respondSettlement("b",set.id,true);assert.equal(a.sent,as+50_000);assert.equal(b.received,br+50_000);assert.equal(a.stats.settlementsCompleted,1);
});

test("dados digitais assistidos usam o servidor e terceira dupla envia à cadeia",()=>{
  const s=stateWithPlayers("a","b");s.rules.useDigitalDice=true;const g=new GameEngine(s);g.startTurnTracker(["a","b"]);const values=[3,3,4,4,5,5];const rnd=()=>values.shift()!;assert.equal(g.rollAssistiveDice("a",rnd as any).extraTurn,true);assert.equal(g.rollAssistiveDice("a",rnd as any).extraTurn,true);const third=g.rollAssistiveDice("a",rnd as any);assert.equal(third.sentToJail,true);assert.equal(s.players.get("a")!.jailed,true);
});

test("vitória automática encerra quando resta um jogador solvente",()=>{
  const s=stateWithPlayers("a","b"),g=new GameEngine(s);g.startTurnTracker(["a","b"]);s.players.get("b")!.bankrupt=true;s.players.get("b")!.spectator=true;const r=g.evaluateVictory();assert.equal(r?.winnerId,"a");assert.equal(s.winnerId,"a");assert.equal(s.gamePhase,"FINISHED");
});

import { serialize, restore } from "../src/persistence.ts";

test("save 0.8 personalizado preserva requireFullGroupForBuilding=false na migração 0.9",()=>{
  const s=stateWithPlayers("a","b");s.rules.preset="custom";s.rules.requireFullGroupForBuilding=false;s.rules.requireEvenBuilding=true;const raw=serialize(s,"pin-hash");raw.version=3;raw.appVersion="0.8.0";const restored=restore(raw);assert.equal(restored.rules.requireFullGroupForBuilding,false);assert.equal(restored.rules.requireEvenBuilding,true);assert.equal(restored.rules.preset,"custom");
});

test("final alternativo por liquidação usa o Ruleset e encerra com maior valor realizável",()=>{
  const s=stateWithPlayers("a","b"),g=new GameEngine(s);s.rules.alternateLiquidationVictory=true;g.startTurnTracker(["a","b"]);s.players.get("a")!.balance=3_000_000;s.players.get("b")!.balance=2_000_000;const result=g.finishByLiquidation();assert.equal(result.winnerId,"a");assert.equal(s.gamePhase,"FINISHED");
});

test("cronômetro assistido é server-authoritative e persiste pausa logicamente",()=>{
  const s=stateWithPlayers("a","b"),g=new GameEngine(s);s.rules.timedGame=true;s.rules.timeLimitMs=60_000;const start=1_000_000;const realNow=Date.now;try{Date.now=()=>start;g.startTurnTracker(["a","b"]);assert.equal(s.startedAt,start);g.pauseTimer(start+10_000);assert.equal(g.remainingTime(start+50_000),50_000);g.resumeTimer(start+50_000);assert.equal(s.totalPausedMs,40_000);assert.equal(g.remainingTime(start+70_000),30_000);}finally{Date.now=realNow;}
});
