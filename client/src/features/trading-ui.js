import { escapeHtml as esc } from "../ui/safe.js";
import { schemaGet, schemaValues } from "../ui/schema-safe.js";
import { synchronizedRules } from "./ruleset.js";

const assetsOf = (player) => schemaValues(player?.assets);
const idsOf = (collection) => schemaValues(collection);

export function eligibleTradeRecipients(entries, senderId){
  return [...(entries||[])].filter(([id,p])=>id!==senderId&&p?.connected===true&&p?.bankrupt!==true&&p?.spectator!==true&&p?.jailed!==true);
}

export function updateTradeAssetLists({room,me,$}){
  const players=room?.state?.players;
  const assetOptions=(playerId,cssClass)=>{
    const p=schemaGet(players,playerId);
    if(!p)return"";
    const eligible=assetsOf(p).filter(a=>!a.mortgaged&&a.development===0);
    return eligible.length?eligible.map(a=>`<label class="asset-check"><input type="checkbox" class="${cssClass}" value="${a.id}"> ${esc(a.name)}</label>`).join(""):'<div class="small">Nenhum patrimônio negociável.</div>';
  };
  const target=$("#tradeRecipient")?.value;
  if($("#tradeGiveAssets"))$("#tradeGiveAssets").innerHTML=assetOptions(me,"trade-give-asset");
  if($("#tradeReceiveAssets"))$("#tradeReceiveAssets").innerHTML=target?assetOptions(target,"trade-receive-asset"):'<div class="small">Escolha o destinatário.</div>';
}

export function renderTrades({room,me,$,fmt,emptyState}){
  if(!$("#tradeList"))return;
  updateTradeAssetLists({room,me,$});
  const players=room?.state?.players;
  const playerName=id=>schemaGet(players,id)?.name||"Jogador";
  const trades=schemaValues(room?.state?.trades).filter(t=>t.proposerId===me||t.recipientId===me);
  $("#tradeList").innerHTML=trades.length?trades.map(t=>{
    const incoming=t.recipientId===me,
      giveIds=incoming?idsOf(t.recipientAssetIds):idsOf(t.proposerAssetIds),
      receiveIds=incoming?idsOf(t.proposerAssetIds):idsOf(t.recipientAssetIds),
      giveCash=incoming?t.recipientCash:t.proposerCash,
      receiveCash=incoming?t.proposerCash:t.recipientCash,
      giveHabeas=incoming?t.recipientHabeasCount:t.proposerHabeasCount,
      receiveHabeas=incoming?t.proposerHabeasCount:t.recipientHabeasCount,
      names=(ownerId,ids)=>ids.map(id=>assetsOf(schemaGet(players,ownerId)).find(a=>a.id===id)?.name||"patrimônio").join(", ")||"nenhum patrimônio",
      freeTransfer=Number(t.proposerCash)===0&&Number(t.recipientCash)===0&&Number(t.proposerHabeasCount)===0&&Number(t.recipientHabeasCount)===0&&idsOf(t.proposerAssetIds).length===1&&idsOf(t.recipientAssetIds).length===0;
    if(freeTransfer){const assetName=names(t.proposerId,idsOf(t.proposerAssetIds));return`<div class="pending ${incoming?"incoming":""}"><strong>${incoming?`${esc(playerName(t.proposerId))} quer transferir ${esc(assetName)} para você.`:`Transferência de ${esc(assetName)} aguardando ${esc(playerName(t.recipientId))}`}</strong><div>Você ${incoming?"recebe":"transfere"}: <b>${esc(assetName)}</b></div><div>Dinheiro movimentado: <b>${fmt(0)}</b></div><div class="row">${incoming?`<button data-trade-accept="${t.id}">Aceitar</button><button data-trade-reject="${t.id}">Recusar</button>`:`<button data-trade-cancel="${t.id}">Cancelar</button>`}</div></div>`;}
    return`<div class="pending ${incoming?"incoming":""}"><strong>${incoming?`Proposta de ${esc(playerName(t.proposerId))}`:`Para ${esc(playerName(t.recipientId))}`}</strong><div>Você entrega: ${fmt(giveCash)} + ${esc(names(incoming?t.recipientId:t.proposerId,giveIds))}${giveHabeas?` + ${giveHabeas} Habeas Corpus`:""}</div><div>Você recebe: ${fmt(receiveCash)} + ${esc(names(incoming?t.proposerId:t.recipientId,receiveIds))}${receiveHabeas?` + ${receiveHabeas} Habeas Corpus`:""}</div><div class="row">${incoming?`<button data-trade-accept="${t.id}">Aceitar</button><button data-trade-reject="${t.id}">Recusar</button>`:`<button data-trade-cancel="${t.id}">Cancelar</button>`}</div></div>`;
  }).join(""):emptyState("🤝","Nenhuma negociação pendente","As propostas bilaterais aparecerão aqui.");
  document.querySelectorAll("[data-trade-accept]").forEach(b=>b.onclick=()=>room.send("respond_trade",{id:b.dataset.tradeAccept,accept:true}));
  document.querySelectorAll("[data-trade-reject]").forEach(b=>b.onclick=()=>room.send("respond_trade",{id:b.dataset.tradeReject,accept:false}));
  document.querySelectorAll("[data-trade-cancel]").forEach(b=>b.onclick=()=>room.send("cancel_trade",{id:b.dataset.tradeCancel}));
}

export function renderLiabilities({room,me,$,fmt,emptyState}){
  if(!$("#liabilityList"))return;
  const players=room?.state?.players;
  const list=schemaValues(room?.state?.liabilities).filter(l=>l.debtorId===me||l.creditorPlayerId===me);
  $("#liabilityList").innerHTML=list.length?list.map(l=>{
    const mine=l.debtorId===me,creditor=l.creditorType==="BANK"?"Banco":schemaGet(players,l.creditorPlayerId)?.name||"Jogador";
    return`<div class="pending ${mine?"incoming":""}"><strong>${mine?"Você deve":"Você é credor"}: ${fmt(l.remaining)}</strong><div>Credor: ${esc(creditor)} • ${esc(l.reason)}</div>${mine&&l.status==="open"?`<div class="row"><button data-liq="${l.id}">Resolver esta obrigação</button><button data-pay-liability="${l.id}">Pagar com saldo</button></div>`:""}</div>`;
  }).join(""):emptyState("💧","Nenhuma dívida aberta","Se faltar dinheiro para um pagamento obrigatório, ele aparecerá aqui.");
  document.querySelectorAll("[data-liq]").forEach(b=>b.onclick=()=>room.send("liquidity",{id:b.dataset.liq}));
  document.querySelectorAll("[data-pay-liability]").forEach(b=>b.onclick=()=>room.send("pay_liability",{id:b.dataset.payLiability}));
}

export function showLiquidityState({$,fmt,room,me},data){
  const box=$("#liquidityInfo");if(!box||!data)return;
  box.classList.remove("hidden");box.dataset.liabilityId=data.liabilityId||"";
  const p=schemaGet(room?.state?.players,me),asset=id=>assetsOf(p).find(a=>a.id===id),cards=(ids,kind)=>schemaValues(ids).map(id=>{
    const a=asset(id);if(!a)return"";
    if(kind==="development")return`<div class="asset"><strong>${esc(a.name)}</strong><div>Nível atual: ${a.development}</div><button data-liq-development="${a.id}" data-liability="${data.liabilityId}">Vender 1 nível</button></div>`;
    if(kind==="mortgage")return`<div class="asset"><strong>${esc(a.name)}</strong><div>Libera ${fmt(a.mortgage)}</div><button data-liq-mortgage="${a.id}">Hipotecar</button></div>`;
    return`<div class="asset"><strong>${esc(a.name)}</strong><div>Venda ao banco: ${fmt(a.purchase)}</div><button data-liq-sell="${a.id}" data-liability="${data.liabilityId}">Vender título ao banco</button></div>`;
  }).join("");
  box.innerHTML=`<strong>Resolver dívida</strong><div>Você deve: ${fmt(data.amount||0)}</div><div>Saldo: ${fmt(data.balance||0)}</div><div>Faltam: ${fmt(data.shortfall||0)}</div><h4>1. Vender construções</h4>${cards(data.developed||[],"development")||'<div class="small">Nenhuma construção elegível.</div>'}<h4>2. Hipotecar</h4>${cards(data.mortgageable||[],"mortgage")||'<div class="small">Nenhum título elegível.</div>'}<h4>3. Negociar</h4><button data-open-trade>Ir para negociação</button><h4>4. Vender título ao banco</h4>${cards(data.sellable||[],"sell")||'<div class="small">Nenhum título elegível.</div>'}<h4>5. Falência</h4><button data-bankruptcy="${data.liabilityId}" ${data.canDeclareBankruptcy?"":"disabled"}>Declarar falência</button>`;
  box.querySelectorAll("[data-liq-development]").forEach(b=>b.onclick=()=>{const a=asset(b.dataset.liqDevelopment);if(a&&a.development>0)room.send("development",{id:a.id,value:a.development===5?Number(synchronizedRules(room).housesBeforeCondo||4):a.development-1});});
  box.querySelectorAll("[data-liq-mortgage]").forEach(b=>b.onclick=()=>room.send("mortgage",{id:b.dataset.liqMortgage,action:"mortgage"}));
  box.querySelectorAll("[data-liq-sell]").forEach(b=>b.onclick=()=>room.send("sell_asset_to_bank",{id:b.dataset.liqSell,liabilityId:b.dataset.liability}));
  box.querySelector("[data-open-trade]")?.addEventListener("click",()=>document.querySelector('[data-tab="debts"]')?.click());
  box.querySelectorAll("[data-bankruptcy]").forEach(b=>b.onclick=()=>room.send("request_bankruptcy",{liabilityId:b.dataset.bankruptcy}));
}

export function renderSettlements({room,me,$,fmt,emptyState}){
  const select=$("#settlementLiability"),assetsBox=$("#settlementAssets"),listBox=$("#settlementList"),players=room?.state?.players;
  const mine=schemaValues(room?.state?.liabilities).filter(l=>l.debtorId===me&&l.creditorType==="PLAYER"&&l.status==="open");
  if(select){const keep=select.value;select.innerHTML=`<option value="">Selecione uma obrigação...</option>${mine.map(l=>`<option value="${l.id}">${fmt(l.remaining)} • ${esc(l.reason)}</option>`).join("")}`;if([...select.options].some(o=>o.value===keep))select.value=keep;}
  if(assetsBox){const p=schemaGet(players,me),eligible=assetsOf(p).filter(a=>!a.mortgaged&&a.development===0);assetsBox.innerHTML=eligible.length?eligible.map(a=>`<label class="asset-check"><input type="checkbox" class="settlement-asset" value="${a.id}"> ${esc(a.name)}</label>`).join(""):'<div class="small">Nenhum patrimônio elegível.</div>';}
  if(!listBox)return;
  const list=schemaValues(room?.state?.settlements).filter(s=>s.debtorId===me||s.creditorPlayerId===me);
  listBox.innerHTML=list.length?list.map(s=>{
    const incoming=s.creditorPlayerId===me,debtor=schemaGet(players,s.debtorId)?.name||"Jogador",names=idsOf(s.assetIds).map(id=>assetsOf(schemaGet(players,s.debtorId)).find(a=>a.id===id)?.name||"patrimônio").join(", ")||"nenhum patrimônio";
    return`<div class="pending ${incoming?"incoming":""}"><strong>${incoming?`Acordo proposto por ${esc(debtor)}`:"Acordo aguardando credor"}</strong><div>Dinheiro: ${fmt(s.cash)} • Bens: ${esc(names)}</div><div class="small">${esc(s.note||"")}</div><div class="row">${incoming?`<button data-settle-accept="${s.id}">Aceitar</button><button data-settle-reject="${s.id}">Recusar</button>`:`<button data-settle-cancel="${s.id}">Cancelar</button>`}</div></div>`;
  }).join(""):emptyState("🧾","Nenhum acordo pendente","Propostas para quitar dívidas aparecerão aqui.");
  document.querySelectorAll("[data-settle-accept]").forEach(b=>b.onclick=()=>room.send("respond_settlement",{id:b.dataset.settleAccept,accept:true}));
  document.querySelectorAll("[data-settle-reject]").forEach(b=>b.onclick=()=>room.send("respond_settlement",{id:b.dataset.settleReject,accept:false}));
  document.querySelectorAll("[data-settle-cancel]").forEach(b=>b.onclick=()=>room.send("cancel_settlement",{id:b.dataset.settleCancel}));
}
