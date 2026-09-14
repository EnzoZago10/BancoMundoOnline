import test from "node:test";import assert from "node:assert/strict";
import { GameEngine } from "../src/domain/game-engine.ts";
import { calculateUsedHouses } from "../src/domain/invariants.ts";
import { stateWithPlayers } from "./helpers.ts";

test("GameEngine é o motor real para compra, construção, hipoteca e negociação",()=>{
 const s=stateWithPlayers("a","b"),g=new GameEngine(s);
 const city=g.purchaseAsset("a","cidade-cabo");assert.equal(city.development,0);assert.equal(s.players.get("a")!.balance,2_498_000);
 s.rules.requireFullGroupForBuilding=false;s.rules.requireEvenBuilding=false;g.changeDevelopment("a",city.id,1);assert.equal(calculateUsedHouses(s),1);assert.equal(s.housesRemaining,79);
 g.changeDevelopment("a",city.id,0);g.mortgage("a",city.id);assert.equal(city.mortgaged,true);g.redeemMortgage("a",city.id);assert.equal(city.mortgaged,false);
 const trade=g.proposeTrade({proposerId:"a",recipientId:"b",proposerCash:100_000,recipientCash:50_000,proposerAssetIds:[city.id],recipientAssetIds:[]});
 assert.throws(()=>g.respondTrade("a",trade.id,true),/Somente o destinatário/);g.respondTrade("b",trade.id,true);assert.equal(s.players.get("b")!.assets[0].catalogId,"cidade-cabo");
});

test("negociação é revalidada se patrimônio ou estado mudar",()=>{
 const s=stateWithPlayers("a","b"),g=new GameEngine(s);const city=g.purchaseAsset("a","cidade-cabo");const trade=g.proposeTrade({proposerId:"a",recipientId:"b",proposerCash:0,recipientCash:0,proposerAssetIds:[city.id],recipientAssetIds:[]});
 city.development=1;s.housesRemaining=79;assert.throws(()=>g.respondTrade("b",trade.id,true),/construções/);
 city.development=0;s.housesRemaining=80;s.players.get("a")!.jailed=true;assert.throws(()=>g.respondTrade("b",trade.id,true),/presos/);
});
