import test from "node:test";import assert from "node:assert/strict";import { GameEngine } from "../src/domain/game-engine.ts";import { Pending } from "../src/state.ts";import { stateWithPlayers } from "./helpers.ts";
test("settlement é vinculado a Liability real e somente credor aceita",()=>{const s=stateWithPlayers("a","b"),g=new GameEngine(s);const asset=g.purchaseAsset("a","cidade-cabo");const l=g.createLiability({debtorId:"a",creditorType:"PLAYER",creditorPlayerId:"b",amount:500000,reason:"aluguel"});const st=g.proposeSettlement({debtorId:"a",liabilityId:l.id,cash:100000,assetIds:[asset.id],note:"acordo"});assert.throws(()=>g.respondSettlement("a",st.id,true),/Settlement inválido/);assert.equal(g.respondSettlement("b",st.id,true),true);assert.equal(l.status,"settled");assert.equal(l.remaining,0);assert.equal(s.players.get("b")!.assets[0].catalogId,"cidade-cabo");});
test("settlement vazio e settlement sem obrigação real são recusados",()=>{const s=stateWithPlayers("a","b"),g=new GameEngine(s);assert.throws(()=>g.proposeSettlement({debtorId:"a",liabilityId:"fake",cash:0,assetIds:[],note:""}),/obrigação aberta/);const l=g.createLiability({debtorId:"a",creditorType:"PLAYER",creditorPlayerId:"b",amount:1000,reason:"x"});assert.throws(()=>g.proposeSettlement({debtorId:"a",liabilityId:l.id,cash:0,assetIds:[],note:""}),/vazio/);});
test("venda ao banco durante liquidez paga valor de compra e remove título elegível",()=>{const s=stateWithPlayers("a","b"),g=new GameEngine(s);const a=g.purchaseAsset("a","cidade-cabo"),before=s.players.get("a")!.balance;const l=g.createLiability({debtorId:"a",creditorType:"BANK",amount:999999,reason:"liquidez"});const value=g.sellAssetToBank("a",a.id,l.id);assert.equal(value,60000);assert.equal(s.players.get("a")!.balance,before+60000);assert.equal(s.players.get("a")!.assets.length,0);});


function playerLiability(g:GameEngine,debtorId="a",creditorId="b"){return g.createLiability({debtorId,creditorType:"PLAYER",creditorPlayerId:creditorId,amount:500000,reason:"acordo"});}

test("Settlement não aceita título já comprometido em venda ao banco, Trade ou outro Settlement",()=>{
  {const s=stateWithPlayers("a","b"),g=new GameEngine(s),asset=g.purchaseAsset("a","cidade-cabo"),l=playerLiability(g);const q=new Pending();q.id="sale";q.kind="bank_sale";q.catalogId=asset.catalogId;s.pending.set(q.id,q);assert.throws(()=>g.proposeSettlement({debtorId:"a",liabilityId:l.id,cash:0,assetIds:[asset.id],note:""}),/solicitação pendente/i);}
  {const s=stateWithPlayers("a","b","c"),g=new GameEngine(s),asset=g.purchaseAsset("a","cidade-cabo"),l=playerLiability(g);g.proposeTrade({proposerId:"a",recipientId:"c",proposerCash:0,recipientCash:0,proposerAssetIds:[asset.id],recipientAssetIds:[]});assert.throws(()=>g.proposeSettlement({debtorId:"a",liabilityId:l.id,cash:0,assetIds:[asset.id],note:""}),/negociação/i);}
  {const s=stateWithPlayers("a","b"),g=new GameEngine(s),asset=g.purchaseAsset("a","cidade-cabo"),l=playerLiability(g);g.proposeSettlement({debtorId:"a",liabilityId:l.id,cash:0,assetIds:[asset.id],note:"primeiro"});assert.throws(()=>g.proposeSettlement({debtorId:"a",liabilityId:l.id,cash:0,assetIds:[asset.id],note:"segundo"}),/acordo de dívida/i);}
});

test("Settlement revalida patrimônio no aceite ignorando somente a própria proposta",()=>{
  const s=stateWithPlayers("a","b"),g=new GameEngine(s),asset=g.purchaseAsset("a","cidade-cabo"),l=playerLiability(g),st=g.proposeSettlement({debtorId:"a",liabilityId:l.id,cash:100000,assetIds:[asset.id],note:"acordo"});
  const debtor=s.players.get("a")!,creditor=s.players.get("b")!,debtorBalance=debtor.balance,creditorBalance=creditor.balance;
  const q=new Pending();q.id="conflict";q.kind="bank_sale";q.catalogId=asset.catalogId;s.pending.set(q.id,q);
  assert.throws(()=>g.respondSettlement("b",st.id,true),/solicitação pendente/i);
  assert.equal(debtor.balance,debtorBalance);assert.equal(creditor.balance,creditorBalance);assert.equal(debtor.assets.some(a=>a.id===asset.id),true);assert.equal(creditor.assets.some(a=>a.id===asset.id),false);
  s.pending.delete(q.id);
  assert.equal(g.respondSettlement("b",st.id,true),true);
  assert.equal(debtor.assets.some(a=>a.id===asset.id),false);assert.equal(creditor.assets.some(a=>a.id===asset.id),true);
});

test("Settlement preserva proteção de grupo com construções",()=>{
  const s=stateWithPlayers("a","b"),g=new GameEngine(s),asset=g.purchaseAsset("a","cidade-cabo"),other=g.purchaseAsset("a","cairo"),l=playerLiability(g);
  other.development=1;s.housesRemaining=79;
  assert.throws(()=>g.proposeSettlement({debtorId:"a",liabilityId:l.id,cash:0,assetIds:[asset.id],note:""}),/construções do grupo/i);
  assert.equal(s.players.get("a")!.assets.some(a=>a.id===asset.id),true);
});
