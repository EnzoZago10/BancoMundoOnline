import { applyOfficialRules, collectRules, synchronizedRules } from "./ruleset.js";
import { escapeHtml as esc } from "../ui/safe.js";
import { schemaEntries, schemaGet, schemaValues } from "../ui/schema-safe.js";

const LAST_RULES_KEY = "bmo-last-rules-091";

function setChecked(id, value){const el=document.getElementById(id);if(el)el.checked=Boolean(value);}
function setValue(id, value){const el=document.getElementById(id);if(el)el.value=String(value);}
function applyRulesObject(rules={}){
  applyOfficialRules(document);
  if("requireFullGroupForBuilding" in rules)setChecked("ruleFullGroup",rules.requireFullGroupForBuilding);
  if("requireEvenBuilding" in rules)setChecked("ruleEvenBuilding",rules.requireEvenBuilding);
  if("housesBeforeCondo" in rules)setValue("ruleCondoAfter",Number(rules.housesBeforeCondo)===3?3:4);
  if("limitedHouseStock" in rules)setChecked("ruleLimitedStock",rules.limitedHouseStock);
  if("allowEarlyJailFine" in rules)setChecked("ruleEarlyJailFine",rules.allowEarlyJailFine);
  if("autoCollectStart" in rules)setChecked("ruleAutoStart",rules.autoCollectStart);
  if("useDigitalDice" in rules)setChecked("ruleDigitalDice",rules.useDigitalDice);
  if("initialPropertyDistribution" in rules)setChecked("ruleInitialDistribution",rules.initialPropertyDistribution);
  if("alternateLiquidationVictory" in rules)setChecked("ruleLiquidationVictory",rules.alternateLiquidationVictory);
  if("timedGame" in rules)setChecked("ruleTimedGame",rules.timedGame);
  if(rules.timeLimitMs)setValue("ruleTimeMinutes",Math.max(5,Math.round(Number(rules.timeLimitMs)/60000)));
}
function presetName(rules){
  if(rules?.requireFullGroupForBuilding===false && rules?.requireEvenBuilding===true && !rules?.timedGame && !rules?.useDigitalDice && !rules?.initialPropertyDistribution && !rules?.alternateLiquidationVictory) return "Construção livre";
  if(rules?.preset==="official" || rules?.requireFullGroupForBuilding===true) return "Clássico";
  return "Personalizado";
}
function markPreset(name){
  document.querySelectorAll(".preset-card").forEach(b=>b.classList.toggle("active",b.id===name));
}
function showModal(id,show=true){document.getElementById(id)?.classList.toggle("hidden",!show);}
function activatePanel(id){
  document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t=>{t.classList.remove("active");t.setAttribute("aria-selected","false");});
  document.getElementById(id)?.classList.add("active");
  const tab=document.querySelector(`.tab[data-tab="${id}"]`) || document.querySelector('.tab[data-tab="rules"]');
  tab?.classList.add("active");tab?.setAttribute("aria-selected","true");
  window.scrollTo({top:0,behavior:"smooth"});
}
function propertyOwner(room,catalogId){
  if(!room?.state?.players)return null;
  for(const [playerId,player] of schemaEntries(room.state.players)){
    const asset=schemaValues(player?.assets).find(a=>a.catalogId===catalogId);
    if(asset)return {playerId,player,asset};
  }
  return null;
}
function nextDevelopmentTarget(asset,rules){
  const before=Number(rules?.housesBeforeCondo||4);
  if(Number(asset.development)===before)return 5;
  if(Number(asset.development)>=5)return null;
  return Number(asset.development)+1;
}
function canBuildOn(room,me,catalog,asset){
  const player=schemaGet(room?.state?.players,me), rules=synchronizedRules(room);
  if(!player||!asset||asset.kind!=="property"||asset.mortgaged||asset.development>=5)return {ok:false,reason:"Indisponível"};
  const property=catalog.properties.find(p=>p.id===asset.catalogId);if(!property)return {ok:false,reason:"Indisponível"};
  const group=catalog.properties.filter(p=>p.group===property.group);
  const owned=group.map(p=>schemaValues(player?.assets).find(a=>a.catalogId===p.id)).filter(Boolean);
  if(rules.requireFullGroupForBuilding&&owned.length!==group.length)return {ok:false,reason:"Complete o grupo primeiro"};
  if(rules.requireFullGroupForBuilding&&owned.some(a=>a.mortgaged))return {ok:false,reason:"Há hipoteca no grupo"};
  const target=nextDevelopmentTarget(asset,rules);if(target===null)return {ok:false,reason:"Já está no máximo"};
  const before=Number(rules.housesBeforeCondo||4);
  if(rules.requireEvenBuilding){
    if(target===5&&owned.some(a=>a.id!==asset.id&&Number(a.development)<before))return {ok:false,reason:"Construa por igual primeiro"};
    if(target<5){const levels=owned.map(a=>Number(a.development)===5?before:Number(a.development));const idx=owned.findIndex(a=>a.id===asset.id);if(idx>=0){const next=[...levels];next[idx]=target;if(next.length&&Math.max(...next)-Math.min(...next)>1)return {ok:false,reason:"Construa por igual"};}}
  }
  const cost=target===5?Number(property.condominiumCost):Number(property.houseCost);
  if(Number(player.balance)<cost)return {ok:false,reason:"Saldo insuficiente"};
  return {ok:true,target,cost,property};
}

export function initSimpleUX({$,getRoom,getMe,getCatalog,fmt,toast,onRulesChanged}){
  const pin=document.getElementById("pin"),createPinWrap=document.getElementById("createPinWrap"),joinPinWrap=document.getElementById("joinPinWrap");
  const placePin=(target)=>{const movable=pin?.closest(".field-wrap")||pin;if(movable&&target&&!target.contains(movable))target.append(movable);target?.classList.remove("hidden");};
  document.getElementById("protectRoomToggle")?.addEventListener("change",e=>{if(e.target.checked){placePin(createPinWrap);pin?.focus();}else{createPinWrap?.classList.add("hidden");if(pin)pin.value="";}});
  document.getElementById("showPinEntry")?.addEventListener("click",()=>{placePin(joinPinWrap);pin?.focus();});
  document.getElementById("showRecovery")?.addEventListener("click",()=>{const box=document.getElementById("recoveryJoinBox");box?.classList.toggle("hidden");if(box&&!box.classList.contains("hidden"))document.getElementById("recoveryInput")?.focus();});
  document.getElementById("rulesModalClose")?.addEventListener("click",()=>showModal("rulesModal",false));
  document.getElementById("rulesModalDone")?.addEventListener("click",()=>{showModal("rulesModal",false);markPreset("presetCustom");onRulesChanged?.();});
  document.getElementById("presetClassic")?.addEventListener("click",()=>{applyOfficialRules(document);markPreset("presetClassic");onRulesChanged?.();});
  document.getElementById("presetFree")?.addEventListener("click",()=>{applyOfficialRules(document);setChecked("ruleFullGroup",false);markPreset("presetFree");onRulesChanged?.();});
  document.getElementById("presetCustom")?.addEventListener("click",()=>{markPreset("presetCustom");showModal("rulesModal",true);onRulesChanged?.();});
  document.getElementById("rulesCustom")?.addEventListener("click",()=>showModal("rulesModal",true));
  document.getElementById("rulesOfficial")?.addEventListener("click",()=>markPreset("presetClassic"));
  document.getElementById("useLastPreset")?.addEventListener("click",()=>{try{const saved=JSON.parse(localStorage.getItem(LAST_RULES_KEY)||"null");if(saved?.rules){applyRulesObject(saved.rules);markPreset(saved.name==="Construção livre"?"presetFree":saved.name==="Clássico"?"presetClassic":"presetCustom");onRulesChanged?.();toast(`Configuração ${saved.name} aplicada.`,"success");}}catch{}});
  const saved=(()=>{try{return JSON.parse(localStorage.getItem(LAST_RULES_KEY)||"null");}catch{return null;}})();
  if(saved?.name){document.getElementById("lastPresetBox")?.classList.remove("hidden");const label=document.getElementById("lastPresetLabel");if(label)label.textContent=`Última configuração: ${saved.name}`;}

  const close=(id)=>showModal(id,false);
  document.getElementById("landedClose")?.addEventListener("click",()=>close("landedModal"));
  document.getElementById("transferClose")?.addEventListener("click",()=>close("transferModal"));
  document.getElementById("buildClose")?.addEventListener("click",()=>close("buildModal"));
  const renderTransferPreview=()=>{const room=getRoom(),me=getMe(),from=schemaGet(room?.state?.players,me),to=schemaGet(room?.state?.players,document.getElementById("to")?.value),amount=Number(document.getElementById("amount")?.value||0),box=document.getElementById("transferPreview");if(!box)return;box.innerHTML=`<div><span>De:</span><strong>${esc(from?.name||"—")}</strong></div><div><span>Para:</span><strong>${esc(to?.name||"—")}</strong></div><div><span>Valor:</span><strong>${fmt(amount||0)}</strong></div>`;};
  document.getElementById("openTransfer")?.addEventListener("click",()=>{const error=document.getElementById("transferError");if(error){error.textContent="";error.classList.add("hidden");}renderTransferPreview();showModal("transferModal",true);document.getElementById("to")?.focus();});
  document.getElementById("to")?.addEventListener("change",renderTransferPreview);
  document.getElementById("amount")?.addEventListener("input",renderTransferPreview);
  document.getElementById("moreActions")?.addEventListener("click",()=>activatePanel("rules"));
  document.getElementById("openFinancialMore")?.addEventListener("click",()=>activatePanel("money"));
  document.getElementById("openBackupPanel")?.addEventListener("click",()=>activatePanel("backupCard"));
  document.getElementById("toggleRanking")?.addEventListener("click",()=>{const d=document.getElementById("rankingDetails");if(d){d.open=!d.open;if(d.open)d.scrollIntoView({behavior:"smooth",block:"start"});}});
  document.getElementById("changeRulesInfo")?.addEventListener("click",()=>showModal("rulesModal",true));

  document.addEventListener("click",e=>{
    const jump=e.target.closest("[data-jump-tab]");if(jump){e.preventDefault();activatePanel(jump.dataset.jumpTab);}
    const back=e.target.closest("[data-back-main]");if(back){e.preventDefault();activatePanel(back.dataset.backMain||"rules");}
  });

  let selected=null;
  function renderLandedList(filter=""){
    const catalog=getCatalog(),box=document.getElementById("landedList");if(!box)return;
    const q=filter.trim().toLocaleLowerCase("pt-BR"),items=[...catalog.properties.map(x=>({...x,kind:"property"})),...catalog.organizations.map(x=>({...x,kind:"organization"}))].filter(x=>!q||x.name.toLocaleLowerCase("pt-BR").includes(q)).slice(0,18);
    box.innerHTML=items.map(x=>`<button type="button" class="search-result" data-landed-id="${esc(x.id)}" data-landed-kind="${x.kind}"><span>${x.kind==="property"?"🏠":"🏛️"}</span><strong>${esc(x.name)}</strong></button>`).join("")||'<div class="empty">Nada encontrado.</div>';
  }
  function renderLandedContext(kind,id){
    const room=getRoom(),me=getMe(),catalog=getCatalog(),box=document.getElementById("landedContext");if(!room||!box)return;const item=(kind==="property"?catalog.properties:catalog.organizations).find(x=>x.id===id);if(!item)return;
    selected={kind,id};const owner=propertyOwner(room,id),mine=schemaGet(room.state.players,me);let html=`<div class="landed-title"><strong>${esc(item.name)}</strong></div>`;
    if(!owner){html+=`<div class="context-price"><span>Preço</span><strong>${fmt(item.purchase)}</strong></div><div class="context-price"><span>Seu saldo</span><strong>${fmt(mine?.balance||0)}</strong></div><button class="primary" data-context-buy="${esc(id)}">Comprar</button><button data-context-close>Não comprar</button>`;}
    else if(owner.playerId===me){html+=`<p>Esta ${kind==="property"?"propriedade":"instituição"} é sua.</p>${kind==="property"?`<div class="context-price"><span>Construção</span><strong>${owner.asset.development===5?"Condomínio":`${owner.asset.development} casa(s)`}</strong></div>`:""}<button data-open-assets>Gerenciar ${kind==="property"?"propriedade":"patrimônio"}</button>`;}
    else if(owner.asset.mortgaged){html+=`<p>Propriedade de <strong>${esc(owner.player.name)}</strong>, mas está hipotecada. Nenhum pagamento é devido.</p>`;}
    else if(kind==="property"){
      const rent=Number(item.rent?.[Number(owner.asset.development)]||0);html+=`<div class="context-price"><span>Dono</span><strong>${esc(owner.player.name)}</strong></div><div class="context-price"><span>Aluguel</span><strong>${fmt(rent)}</strong></div><button class="primary" data-context-rent="${esc(id)}">Pagar aluguel</button>`;
    } else {
      html+=`<div class="context-price"><span>Dono</span><strong>${esc(owner.player.name)}</strong></div><label>Quanto saiu nos dados?</label><input id="contextDice" type="number" min="2" max="12" value="7"><button class="primary" data-context-institution="${esc(id)}">Calcular e pagar</button>`;
    }
    box.innerHTML=html;
    box.querySelector("[data-context-buy]")?.addEventListener("click",()=>{room.send("asset",{catalogId:id,reason:"Compra registrada pelo assistente"});toast(`${item.name}: compra solicitada.`,"success");close("landedModal");});
    box.querySelector("[data-context-rent]")?.addEventListener("click",()=>{room.send("resolve_rent",{catalogId:id});toast("Aluguel registrado.","success");close("landedModal");});
    box.querySelector("[data-context-institution]")?.addEventListener("click",()=>{room.send("resolve_institution",{catalogId:id,diceSum:Number(document.getElementById("contextDice")?.value||0)});toast("Pagamento da instituição registrado.","success");close("landedModal");});
    box.querySelector("[data-open-assets]")?.addEventListener("click",()=>{close("landedModal");activatePanel("assets");});
    box.querySelector("[data-context-close]")?.addEventListener("click",()=>close("landedModal"));
  }
  document.getElementById("openLanded")?.addEventListener("click",()=>{selected=null;document.getElementById("landedContext").innerHTML="";document.getElementById("landedSearch").value="";renderLandedList();showModal("landedModal",true);document.getElementById("landedSearch")?.focus();});
  document.getElementById("landedSearch")?.addEventListener("input",e=>renderLandedList(e.target.value));
  document.getElementById("landedList")?.addEventListener("click",e=>{const b=e.target.closest("[data-landed-id]");if(b)renderLandedContext(b.dataset.landedKind,b.dataset.landedId);});

  let showAllBuild=false;
  function renderBuild(){
    const room=getRoom(),me=getMe(),catalog=getCatalog(),box=document.getElementById("buildList");if(!room||!box)return;const p=schemaGet(room.state.players,me);if(!p){box.innerHTML="";return;}
    const rows=[...(p.assets||[])].filter(a=>a.kind==="property").map(a=>({asset:a,plan:canBuildOn(room,me,catalog,a)}));const visible=showAllBuild?rows:rows.filter(x=>x.plan.ok);
    box.innerHTML=visible.length?visible.map(({asset,plan})=>`<div class="build-row ${plan.ok?"":"disabled"}"><div><strong>${esc(asset.name)}</strong><span>${asset.development===5?"Condomínio":`${asset.development} casa(s)`}</span></div>${plan.ok?`<button data-build-id="${asset.id}" data-build-target="${plan.target}">+ Construir • ${fmt(plan.cost)}</button>`:`<small>${esc(plan.reason)}</small>`}</div>`).join(""):'<div class="empty-state"><strong>Nada para construir agora</strong><p>O servidor continua validando saldo, grupo, uniformidade, hipoteca e estoque.</p></div>';
    box.querySelectorAll("[data-build-id]").forEach(b=>b.addEventListener("click",()=>{room.send("development",{id:b.dataset.buildId,value:Number(b.dataset.buildTarget)});toast("Construção solicitada.","success");setTimeout(renderBuild,100);}));
  }
  const openBuild=()=>{showAllBuild=false;renderBuild();showModal("buildModal",true);};
  document.getElementById("openBuild")?.addEventListener("click",openBuild);document.getElementById("openBuildFromAssets")?.addEventListener("click",openBuild);
  document.getElementById("showAllBuild")?.addEventListener("click",()=>{showAllBuild=!showAllBuild;document.getElementById("showAllBuild").textContent=showAllBuild?"Mostrar apenas disponíveis":"Ver todos os terrenos";renderBuild();});

  return {
    activatePanel,
    showJoinPin(){placePin(joinPinWrap);document.getElementById("showPinEntry")?.classList.add("hidden");pin?.focus();},
    saveLastRules(){const rules=collectRules(document),name=presetName(rules);localStorage.setItem(LAST_RULES_KEY,JSON.stringify({name,rules}));},
    render(){
      const room=getRoom(),me=getMe();if(!room?.state)return;const player=schemaGet(room.state.players,me),current=schemaGet(room.state.players,room.state.currentPlayerId);
      const balance=document.getElementById("balanceHero");if(balance)balance.textContent=fmt(player?.balance||0);
      const title=document.getElementById("turnTitle");if(title)title.textContent=!room.state.gameStarted?"Partida pronta":room.state.currentPlayerId===me?"Sua vez":`Vez de ${current?.name||"—"}`;
      document.getElementById("jailContextCard")?.classList.toggle("hidden",!player?.jailed);
      const debts=[...(room.state.liabilities?.values?.()||[])].filter(l=>(l.debtorId===me||l.creditorPlayerId===me)&&l.status==="open");document.getElementById("debtCard")?.classList.toggle("hidden",debts.length===0);
      const end=document.getElementById("endTurn");if(end)end.classList.toggle("hidden",!room.state.gameStarted||room.state.currentPlayerId!==me||Boolean(room.state.requiredAction&&room.state.requiredActionPlayerId===me));
      const startButton=document.getElementById("start"),startAmount=Number(synchronizedRules(room).startSalary||200000),startPending=schemaValues(room.state.pending).some(q=>q.kind==="start_bonus"&&q.fromId===me);if(startButton){startButton.disabled=startPending;startButton.textContent=startPending?`Solicitação de ${fmt(startAmount)} aguardando ADM`:`💰 Passei pelo Início — Solicitar ${fmt(startAmount)}`;}
      const auction=document.getElementById("houseAuctionCard");if(auction)auction.classList.toggle("hidden",!(room.state.houseAuctionAvailable||room.state.houseAuctionStatus==="active"));
      renderBuild();
    }
  };
}
