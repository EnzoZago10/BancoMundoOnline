import { escapeHtml as esc } from "../ui/safe.js";
import { schemaGet, schemaValues } from "../ui/schema-safe.js";
import { playerMetrics } from "./ranking.js";
import { synchronizedRules } from "./ruleset.js";

export function bindAssistiveGameplay({$,getRoom,getMe,toast}){
  const send=(name,payload)=>{const room=getRoom();if(!room)return toast("Entre em uma sala primeiro.","warning");room.send(name,payload);};
  $("#resolveRent")?.addEventListener("click",()=>send("resolve_rent",{catalogId:$("#physicalProperty")?.value}));
  $("#resolveInstitution")?.addEventListener("click",()=>send("resolve_institution",{catalogId:$("#physicalInstitution")?.value,diceSum:Number($("#physicalInstitutionDice")?.value||0)}));
  $("#registerStart")?.addEventListener("click",()=>send("register_start"));
  $("#physicalGoJail")?.addEventListener("click",()=>send("jail_action",{action:"send",playerId:getMe()}));
  $("#physicalVisitJail")?.addEventListener("click",()=>send("jail_action",{action:"visit",playerId:getMe()}));
  $("#rollDigitalDice")?.addEventListener("click",()=>send("roll_assistive_dice"));
  $("#winnerReport")?.addEventListener("click",()=>send("report"));
  $("#winnerSave")?.addEventListener("click",()=>{const room=getRoom();if(!room?.state?.winnerId)return;const w=schemaGet(room.state.players,room.state.winnerId);localStorage.setItem(`bmo-final-${room.state.saveCode||room.roomId}`,JSON.stringify({savedAt:new Date().toISOString(),winnerId:w?.id,winnerName:w?.name,rules:synchronizedRules(room)}));toast("Resultado salvo neste navegador.","success");});
  $("#finishByLiquidation")?.addEventListener("click",()=>send("finish_by_liquidation"));
  $("#winnerNewGame")?.addEventListener("click",()=>location.reload());
  $("#initialDistribute")?.addEventListener("click",()=>send("initial_distribution",{playerId:$("#initialDistributionPlayer")?.value,catalogId:$("#initialDistributionAsset")?.value}));
  $("#startHouseAuction")?.addEventListener("click",()=>send("start_house_auction"));
  $("#bidHouseAuction")?.addEventListener("click",()=>send("bid_house_auction",{assetId:$("#houseAuctionAsset")?.value,amount:Number($("#houseAuctionBid")?.value||0)}));
  $("#closeHouseAuction")?.addEventListener("click",()=>send("close_house_auction"));
}

export function renderAssistiveGameplay({room,me,$,catalog,fmt}){
  if(!room?.state)return;
  const state=room.state,rules=synchronizedRules(room),players=state.players,current=schemaGet(players,state.currentPlayerId),mine=schemaGet(players,me),property=$("#physicalProperty"),institution=$("#physicalInstitution");
  if(property&&!property.options.length)property.innerHTML=catalog.properties.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
  if(institution&&!institution.options.length)institution.innerHTML=catalog.organizations.map(o=>`<option value="${o.id}">${esc(o.name)}</option>`).join("");
  const required=state.requiredAction?` • Ação obrigatória: ${state.requiredAction}${state.requiredActionPlayerId===me?" (você)":""}`:"";
  let timer="";if(rules?.timedGame&&state.startedAt){const ref=state.pausedAt||Date.now(),remaining=Math.max(0,Number(state.durationMs||0)-(ref-Number(state.startedAt||0)-Number(state.totalPausedMs||0)));timer=` • ⏱ ${Math.ceil(remaining/60000)} min restantes`;}
  if($("#physicalCurrentAction"))$("#physicalCurrentAction").textContent=state.gameStarted?`Vez de ${current?.name||"—"}${required}${timer}`:`Inicie a ordem de turnos para rastrear a partida física.${timer}`;
  if($("#rollDigitalDice")){$("#rollDigitalDice").classList.toggle("hidden",!rules?.useDigitalDice);$("#rollDigitalDice").disabled=!rules?.useDigitalDice||state.currentPlayerId!==me||Boolean(state.requiredAction&&state.requiredActionPlayerId===me);}
  if($("#digitalDiceResult"))$("#digitalDiceResult").textContent=state.die1&&state.die2?`Dados: ${state.die1} + ${state.die2} = ${state.die1+state.die2}${state.die1===state.die2?" • dupla":""}`:"";
  if($("#finishByLiquidation")){const allowed=Boolean(rules?.alternateLiquidationVictory&&state.gameStarted&&state.gamePhase!=="FINISHED"&&state.hostId===me);$("#finishByLiquidation").classList.toggle("hidden",!allowed);}
  const card=$("#winnerCard");if(card){const winner=state.winnerId?schemaGet(players,state.winnerId):null;card.classList.toggle("hidden",!winner);if(winner){const m=playerMetrics(winner,rules);$("#winnerName").textContent=winner.name;$("#winnerStats").innerHTML=`<div><span>Saldo final</span><strong>${fmt(m.money)}</strong></div><div><span>Valor de liquidação</span><strong>${fmt(m.liquidation)}</strong></div><div><span>Propriedades</span><strong>${m.propertyCount}</strong></div><div><span>Instituições</span><strong>${m.organizationCount}</strong></div><div><span>Construções atuais</span><strong>${m.developmentPieces}</strong></div><div><span>Aluguéis pagos</span><strong>${fmt(winner.stats?.rentPaid||0)}</strong></div><div><span>Aluguéis recebidos</span><strong>${fmt(winner.stats?.rentReceived||0)}</strong></div><div><span>Hipotecas</span><strong>${winner.stats?.mortgagesCreated||0}</strong></div><div><span>Negociações concluídas</span><strong>${winner.stats?.tradesCompleted||0}</strong></div><div><span>Obrigações criadas</span><strong>${winner.stats?.obligationsCreated||0}</strong></div><div><span>Acordos</span><strong>${winner.stats?.settlementsCompleted||0}</strong></div>`;}}
  if(mine&&$("#jailFine"))$("#jailFine").disabled=!mine.jailed;
  const distribution=$("#initialDistributionCard");if(distribution)distribution.classList.toggle("hidden",!rules?.initialPropertyDistribution||state.gameStarted||state.hostId!==me);
  const distributionPlayer=$("#initialDistributionPlayer"),distributionAsset=$("#initialDistributionAsset");
  if(distributionPlayer){const keep=distributionPlayer.value;distributionPlayer.innerHTML=schemaValues(players).filter(p=>!p.bankrupt).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");if([...distributionPlayer.options].some(o=>o.value===keep))distributionPlayer.value=keep;}
  if(distributionAsset){const owned=new Set(schemaValues(players).flatMap(p=>schemaValues(p?.assets).map(a=>a.catalogId)));const keep=distributionAsset.value;distributionAsset.innerHTML=[...catalog.properties,...catalog.organizations].filter(a=>!owned.has(a.id)).map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("");if([...distributionAsset.options].some(o=>o.value===keep))distributionAsset.value=keep;}
  const auctionStatus=$("#houseAuctionStatus");if(auctionStatus)auctionStatus.textContent=state.houseAuctionStatus==="active"?`Leilão ativo • maior lance: ${fmt(state.houseAuctionBid||0)}${state.houseAuctionBidderId?` • ${schemaGet(players,state.houseAuctionBidderId)?.name||"jogador"}`:""}`:state.houseAuctionAvailable?"Uma casa retornou após escassez e pode ser leiloada pelo ADM.":"Nenhum leilão disponível no momento.";
  const auctionAsset=$("#houseAuctionAsset");if(auctionAsset&&mine){const keep=auctionAsset.value;auctionAsset.innerHTML=schemaValues(mine?.assets).filter(a=>a.kind==="property"&&!a.mortgaged&&a.development<5).map(a=>`<option value="${a.id}">${esc(a.name)} • nível ${a.development}</option>`).join("");if([...auctionAsset.options].some(o=>o.value===keep))auctionAsset.value=keep;}
  if($("#bidHouseAuction"))$("#bidHouseAuction").disabled=state.houseAuctionStatus!=="active";
  if($("#startHouseAuction"))$("#startHouseAuction").disabled=!state.houseAuctionAvailable||state.houseAuctionStatus==="active";
  if($("#closeHouseAuction"))$("#closeHouseAuction").disabled=state.houseAuctionStatus!=="active";
}
