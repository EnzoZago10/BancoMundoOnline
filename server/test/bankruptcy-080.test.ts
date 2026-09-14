import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "../src/domain/game-engine.ts";
import { stateWithPlayers } from "./helpers.ts";

test("falência só conclui após liquidez e construções devolvem peças antes dela",()=>{
  const s=stateWithPlayers("a","b"),g=new GameEngine(s);
  s.rules.requireFullGroupForBuilding=false;
  s.rules.requireEvenBuilding=false;
  const asset=g.purchaseAsset("a","cidade-cabo");
  for(let i=1;i<=4;i++)g.changeDevelopment("a",asset.id,i);
  assert.equal(s.housesRemaining,76);
  s.players.get("a")!.balance=0;
  const liability=g.createLiability({debtorId:"a",creditorType:"PLAYER",creditorPlayerId:"b",amount:5_000_000,reason:"aluguel"});

  // A 0.9 exige esgotar as alternativas de liquidez antes da falência.
  assert.throws(()=>g.declareBankruptcy("a",liability.id),/opções de liquidez/i);

  for(let target=3;target>=0;target--)g.changeDevelopment("a",asset.id,target);
  assert.equal(s.housesRemaining,80);
  g.sellAssetToBank("a",asset.id,liability.id);
  const beforeCreditor=s.players.get("b")!.balance;
  const result=g.declareBankruptcy("a",liability.id);

  assert.equal(s.housesRemaining,80);
  assert.equal(s.players.get("a")!.bankrupt,true);
  assert.ok(result.paid>0);
  assert.equal(s.players.get("b")!.balance,beforeCreditor+result.paid);
});

test("desfazer snapshot legado 0.8 restaura construções reservando peças sem duplicar",()=>{
  const s=stateWithPlayers("a","b"),g=new GameEngine(s);
  s.rules.requireFullGroupForBuilding=false;
  s.rules.requireEvenBuilding=false;
  const p=s.players.get("a")!;
  const asset=g.purchaseAsset("a","cidade-cabo");
  for(let i=1;i<=4;i++)g.changeDevelopment("a",asset.id,i);
  assert.equal(s.housesRemaining,76);

  // Simula um bankruptcyBackup legítimo de uma versão 0.8, quando o snapshot
  // administrativo ainda podia conter imóveis com construções.
  p.bankruptcyBackup=JSON.stringify({
    balance:p.balance,
    bankOps:p.bankOps,
    sent:p.sent,
    received:p.received,
    stats:{},
    assets:[{id:asset.id,catalogId:asset.catalogId,development:4,mortgaged:false}],
    liabilities:[],
    payments:[]
  });
  p.assets.clear();
  p.bankrupt=true;
  p.spectator=true;
  g.syncHouseStock();
  assert.equal(s.housesRemaining,80);

  g.restoreBankruptcy("a");
  assert.equal(s.housesRemaining,76);
  assert.equal(p.assets.length,1);
  assert.equal(p.assets[0].development,4);
  assert.equal(p.bankrupt,false);
});
