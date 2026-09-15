import test from "node:test";import assert from "node:assert/strict";import { eligibleTradeRecipients, renderTrades } from "../../client/src/features/trading-ui.js";
function screen(me:string){const tradeList:any={innerHTML:""},give:any={innerHTML:""},receive:any={innerHTML:""},recipient:any={value:me==="a"?"b":"a"};const els:any={tradeList,tradeGiveAssets:give,tradeReceiveAssets:receive,tradeRecipient:recipient};const $=(selector:string)=>els[selector.slice(1)]||null;(globalThis as any).document={querySelectorAll:()=>[]};const players=new Map<string,any>([["a",{name:"A",assets:[{id:"london",name:"Londres",development:0,mortgaged:false}]}],["b",{name:"B",assets:[]}]]);const trades=new Map<string,any>([["t",{id:"t",proposerId:"a",recipientId:"b",proposerCash:0,recipientCash:0,proposerAssetIds:["london"],recipientAssetIds:[]}]]);const room:any={state:{players,trades},send(){}};renderTrades({room,me,$,fmt:(n:number)=>String(n),emptyState:()=>"empty"});return tradeList.innerHTML;}
test("bug 0.7: somente B recebe Aceitar/Recusar; proponente/ADM não vira aprovador",()=>{const proposer=screen("a"),recipient=screen("b");assert.match(proposer,/Cancelar/);assert.doesNotMatch(proposer,/Aceitar/);assert.match(recipient,/Aceitar/);assert.match(recipient,/Recusar/);});


test("destinatários elegíveis de negociação excluem falido, espectador, preso, desconectado e remetente",()=>{
  const entries:any[]=[
    ["me",{connected:true,bankrupt:false,spectator:false,jailed:false}],
    ["active",{connected:true,bankrupt:false,spectator:false,jailed:false}],
    ["bankrupt",{connected:true,bankrupt:true,spectator:false,jailed:false}],
    ["spectator",{connected:true,bankrupt:false,spectator:true,jailed:false}],
    ["jailed",{connected:true,bankrupt:false,spectator:false,jailed:true}],
    ["offline",{connected:false,bankrupt:false,spectator:false,jailed:false}]
  ];
  assert.deepEqual(eligibleTradeRecipients(entries,"me").map(([id])=>id),["active"]);
});
