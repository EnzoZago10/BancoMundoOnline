import { Callbacks, Client } from "@colyseus/sdk";
import { initShellFeatures } from "./shell.js";
import { apiBase, wsBase, isLocal } from "./config/runtime.js";
import { escapeHtml as esc } from "./ui/safe.js";
import { schemaKeys, schemaValues } from "./ui/schema-safe.js";
import { canRespondPending, canSeePending } from "./features/pending.js";
import { eventPresentation } from "./features/history.js";
import { applyOfficialRules, collectRules, synchronizedRules } from "./features/ruleset.js";
import { renderRoomRules as renderRoomRulesModule, ruleReview as ruleReviewModule, openCreateReview as openCreateReviewModule } from "./features/rules-ui.js";
import { eligibleTradeRecipients, renderTrades as renderTradesModule, renderLiabilities as renderLiabilitiesModule, renderSettlements as renderSettlementsModule, showLiquidityState as showLiquidityStateModule, updateTradeAssetLists as updateTradeAssetListsModule } from "./features/trading-ui.js";
import { renderRankings as renderRankingsModule } from "./features/ranking.js";
import { bindManual } from "./features/manual.js";
import { bindAssistiveGameplay, renderAssistiveGameplay } from "./features/assistive-gameplay.js";
import { openRoomSession, setConnectionState, wakeBackend } from "./features/session.js";
import { createRecoveryTools } from "./features/recovery.js";
import { emptyState, playerMarkup, updateSummaryAndBadges } from "./features/player-rendering.js";
import { renderAssets } from "./features/assets.js";
import { renderAdminPlayers } from "./features/admin-ui.js";
import { downloadJson, importBackup, renderImportedBackup } from "./features/backup.js";
import { bindRoomState } from "./features/room-binding.js";
import { initSimpleUX } from "./features/simple-ux.js";
let catalog = { developmentLabels: [], properties: [], organizations: [] };
const $ = (s) => document.querySelector(s);
let room,
  me,
  simpleUX,
  pin = "",
  intentional = false,
  recoveryCode = "",
  assetSellId = "",
  assetTransferId = "";
const recentKey = "bm-recent-033",
  sessionKey = "bm-session-033",
  fmt = (n) => Number(n).toLocaleString("pt-BR"),
  P = (id) => catalog.properties.find((x) => x.id === id),
  O = (id) => catalog.organizations.find((x) => x.id === id),
  toast = (m, type = "auto") => {
    const text = String(m || "");
    const inferred = type === "auto" ? (/erro|não foi|inválid|incorret|falha/i.test(text) ? "error" : /aguarde|atenção|aviso/i.test(text) ? "warning" : /copiad|instalad|restaurad|enviad|sucesso|conclu/i.test(text) ? "success" : "info") : type;
    const icons = { success: "✓", error: "!", warning: "⚠", info: "i" };
    const element = $("#toast");
    element.dataset.toastType = inferred;
    element.replaceChildren();
    const icon = document.createElement("span"); icon.className = "toast-icon"; icon.setAttribute("aria-hidden", "true"); icon.textContent = icons[inferred];
    element.append(icon, document.createTextNode(text));
    element.style.display = "block";
    clearTimeout(element._hideTimer);
    element._hideTimer = setTimeout(() => (element.style.display = "none"), inferred === "error" ? 3600 : 2400);
  };
const lowPowerDevice =
  (Number(navigator.deviceMemory || 8) <= 4 || Number(navigator.hardwareConcurrency || 8) <= 4);
if (lowPowerDevice) document.documentElement.classList.add("lite");

const recoveryTools = createRecoveryTools({$,getRoom:()=>room,getMe:()=>me,toast,sessionKey,getCode:()=>recoveryCode,setCode:(value)=>{recoveryCode=value;}});


const fieldLabels = {
  name: "Nome do jogador", balance: "Saldo inicial oficial", mode: "Modo da partida", code: "Código temporário ou permanente",
  pin: "PIN da partida", recoveryInput: "Código pessoal de recuperação (opcional)",
  importFile: "Arquivo de backup", lobbyImportFile: "Arquivo de backup", lobbyImportPin: "Novo PIN da partida restaurada", prop: "Propriedade",
  propReason: "Motivo da compra", org: "Organização", orgReason: "Motivo da compra",
  to: "Destinatário", amount: "Valor do pagamento", reason: "Motivo do pagamento",
  bankAmount: "Valor da operação bancária", bankReason: "Motivo da operação",
  rentProp: "Propriedade para calcular aluguel", rentDev: "Nível de construção",
  fmiKind: "Tipo de operação FMI", diceSum: "Soma dos dados", creditor: "Credor",
  debtAmount: "Valor original da dívida", cash: "Dinheiro oferecido", note: "Observação",
  search: "Buscar no histórico", manualSearch: "Buscar no manual", transferAdminPlayer: "Novo ADM", tradeRecipient: "Destinatário da negociação", tradeGiveCash: "Dinheiro que você entrega", tradeReceiveCash: "Dinheiro que você recebe", institutionCalc: "Instituição", institutionDice: "Soma dos dados"
};

function decorateInterface() {
  document.querySelectorAll("button").forEach((button) => {
    if (!button.getAttribute("type")) button.type = "button";
  });
  Object.entries(fieldLabels).forEach(([id, text]) => {
    const control = document.getElementById(id);
    if (!control || control.closest(".field-wrap") || control.closest(".action-modal")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "field-wrap";
    const label = document.createElement("label");
    label.className = "field-label";
    label.htmlFor = id;
    label.textContent = text;
    control.parentNode.insertBefore(wrapper, control);
    wrapper.append(label, control);
  });
  const create = document.querySelector("#create");
  const join = document.querySelector("#join");
  if (create && join && !create.parentElement.classList.contains("lobby-actions")) {
    create.parentElement.classList.add("lobby-actions");
  }
  const tabs = [...document.querySelectorAll(".tab")];
  const tablist = document.querySelector(".tabs");
  if (tablist) tablist.setAttribute("role", "tablist");
  tabs.forEach((tab) => {
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", tab.dataset.tab || "");
    tab.setAttribute("aria-selected", String(tab.classList.contains("active")));
  });
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-label", panel.id);
  });
  const themeButton = document.querySelector("#theme");
  if (themeButton) themeButton.setAttribute("aria-label", "Alternar entre tema claro e escuro");
  const modal = document.querySelector("#endModal");
  modal?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") document.querySelector("#endBack")?.click();
  });
}

async function init() {
  try {
    const response = await fetch(`${apiBase}/api/catalog`, { cache: "no-store" });
    if (!response.ok) throw Error("Catálogo indisponível.");
    catalog = await response.json();
  } catch (error) {
    toast("Não foi possível carregar o catálogo oficial.", "error");
    console.error(error);
    return;
  }
  decorateInterface();
  const po = catalog.properties
      .map((x) => `<option value="${x.id}">${x.name}</option>`)
      .join(""),
    oo = catalog.organizations
      .map((x) => `<option value="${x.id}">${x.name}</option>`)
      .join("");
  $("#prop").innerHTML = $("#rentProp").innerHTML = po;
  $("#org").innerHTML = oo;
  $("#rentDev").innerHTML = catalog.developmentLabels
    .map((x, i) => `<option value="${i}">${x}</option>`)
    .join("");
  showCatalog();
  calcRules();
  showRecent();
}
let connectionAttempt = null;

async function connect(create, override) {
  if (connectionAttempt) return;
  if (!validateConnectionForm(create, override)) return;
  const controller = new AbortController(); connectionAttempt = controller;
  setConnectionState($, true, "Preparando conexão...", "Não pressione os botões novamente.");
  try {
    const result = await openRoomSession({ Client, wsBase, apiBase, isLocal, $, create, override, collectRules, recoveryCode, signal: controller.signal });
    room = result.room; pin = result.data.pin; recoveryCode = result.recoveryCode; me = null; intentional = false;
    localStorage.removeItem(recentKey);
    localStorage.setItem(sessionKey, JSON.stringify({ roomId: room.roomId, saveCode: room.state.saveCode, name: result.data.name, pin: result.data.pin, recoveryCode }));
    $("#lobby").classList.add("hidden"); $("#returnCard").classList.add("hidden"); $("#game").classList.remove("hidden");
    // client.create/join resolve após o estado inicial chegar. Renderize regras imediatamente;
    // o binding abaixo cuida das atualizações posteriores.
    renderRoomRulesModule({room,$});
    bind();
    room.send("client_ready");
    queueRender();
  } catch (error) { if (error?.name === "AbortError") toast("Conexão cancelada."); else if (String(error?.message||"").includes("PIN_REQUIRED")) { simpleUX?.showJoinPin(); toast("Esta sala é protegida. Digite o PIN para continuar.","warning"); } else toast(error?.message || "Não foi possível conectar."); }
  finally { connectionAttempt = null; setConnectionState($, false); }
}
let renderFrame = 0;
function queueRender() {
  if (renderFrame) return;
  renderFrame = requestAnimationFrame(() => {
    renderFrame = 0;
    try { render(); } catch (error) { console.error("Falha transitória ao renderizar estado sincronizado", error); }
  });
}

function bind() {
  bindRoomState({Callbacks,room,$,fmt,toast,sessionKey,queueRender,getMe:()=>me,getIntentional:()=>intentional,onProfileRecovered:(d)=>{me=d.playerId||me;recoveryTools.handleRecovered(d);},showLiquidity:(d)=>showLiquidityStateModule({$,fmt,room,me},d),download:downloadJson});
}
function openAssetSale(asset) {
  const player=room?.state?.players?.get?.(me);if(!asset||!player)return;
  assetSellId=asset.id;
  const after=Number(player.balance||0)+Number(asset.purchase||0),summary=$("#assetSellSummary");
  if(summary)summary.innerHTML=`<div><span>Patrimônio</span><strong>${esc(asset.name)}</strong></div><div><span>Você receberá</span><strong>${fmt(asset.purchase)}</strong></div><div><span>Saldo atual</span><strong>${fmt(player.balance)}</strong></div><div><span>Saldo após venda</span><strong>${fmt(after)}</strong></div><p class="small">Após a aprovação do ADM, o título volta ao banco e poderá ser comprado novamente.</p>`;
  $("#assetSellModal")?.classList.remove("hidden");
}
function refreshAssetTransferRecipients(playersEntries) {
  const recipients=eligibleTradeRecipients(playersEntries,me),select=$("#assetTransferRecipient"),confirm=$("#assetTransferConfirm"),availability=$("#assetTransferAvailability");
  if(select){const keep=select.value;select.innerHTML=recipients.map(([id,p])=>`<option value="${id}">${esc(p.name)}</option>`).join("");select.disabled=!recipients.length;if(recipients.some(([id])=>id===keep))select.value=keep;}
  if(confirm)confirm.disabled=!recipients.length;
  if(availability)availability.textContent=recipients.length?"Nenhum dinheiro será movimentado. O destinatário precisará aceitar.":"Nenhum jogador disponível para receber este título.";
  return recipients;
}
function openAssetTransfer(asset) {
  if(!asset)return;assetTransferId=asset.id;
  const players=room?.state?.players?.entries?[...room.state.players.entries()]:[];
  refreshAssetTransferRecipients(players);
  if($("#assetTransferSummary"))$("#assetTransferSummary").innerHTML=`<div><span>Você está transferindo</span><strong>${esc(asset.name)}</strong></div><div><span>Dinheiro</span><strong>${fmt(0)}</strong></div>`;
  $("#assetTransferModal")?.classList.remove("hidden");
}
function closeAssetModal(id){$(id)?.classList.add("hidden");}

function clearFieldError(control) {
  if (!control) return;
  control.classList.remove("input-invalid", "shake");
  control.removeAttribute("aria-invalid");
  const error = control.parentElement?.querySelector(".field-error");
  error?.remove();
}
function showFieldError(control, message) {
  if (!control) return false;
  clearFieldError(control);
  control.classList.add("input-invalid", "shake");
  control.setAttribute("aria-invalid", "true");
  const error = document.createElement("span");
  error.className = "field-error";
  error.textContent = message;
  control.insertAdjacentElement("afterend", error);
  control.focus();
  toast(message, "error");
  return true;
}
function validateConnectionForm(create, override) {
  if (override) return true;
  const name = $("#name");
  const pinField = $("#pin");
  [name, pinField, $("#code")].forEach(clearFieldError);
  if (!name.value.trim()) return !showFieldError(name, "Informe seu nome.");
  if (create && $("#protectRoomToggle")?.checked && !pinField.value.trim()) return !showFieldError(pinField, "Crie um PIN de pelo menos 4 caracteres.");
  if (create && $("#protectRoomToggle")?.checked && pinField.value.trim().length < 4) return !showFieldError(pinField, "O PIN precisa ter pelo menos 4 caracteres.");
  if (!create && !$("#code").value.trim()) return !showFieldError($("#code"), "Informe o código da sala.");
  return true;
}

function render() {
  if (!room?.state) return;
  // Regras são independentes das coleções de jogadores e devem aparecer mesmo durante hidratação parcial.
  renderRoomRulesModule({room,$});
  recoveryTools.update();
  renderRankingsModule({room,me,$,fmt});
  const ps = room.state.players?.entries ? [...room.state.players.entries()] : [],
    adm = room.state.hostId === me,
    opts = ps
      .filter(([id, p]) => id !== me && p.connected)
      .map(([id, p]) => `<option value="${id}">${esc(p.name)}</option>`)
      .join(""),
    tradeOpts = eligibleTradeRecipients(ps,me)
      .map(([id,p])=>`<option value="${id}">${esc(p.name)}</option>`)
      .join("");
  updateSummaryAndBadges({room,me,$,ps,adm,fmt});
  $("#roomName").textContent = room.state.roomName;
  const modeLabel=room.state.mode === "assisted" ? "Modo Assistido" : "Modo de partida"; if ($("#roomModeLabel")) $("#roomModeLabel").textContent = modeLabel; if ($("#appModeHeader")) $("#appModeHeader").textContent = "Companheiro para sua partida";
  $("#saveCode").textContent =
    `Código permanente da partida: ${room.state.saveCode} • Último salvamento: ${room.state.lastSavedAt ? new Date(room.state.lastSavedAt).toLocaleString("pt-BR") : "agora"}`;
  if($("#pause")){$("#pause").textContent=room.state.paused?"▶️ Retomar partida":"⏸️ Pausar e salvar";$("#pause").classList.toggle("primary",Boolean(room.state.paused));}
  $("#roomCode").textContent =
    room.roomId +
    (room.state.locked ? " • Entradas bloqueadas" : " • Sala aberta");
  document
    .querySelectorAll(".admin-only")
    .forEach((x) => x.classList.toggle("hidden", !adm));
  $("#lock").textContent = room.state.locked
    ? "Reabrir entradas"
    : "Bloquear entradas";
  $("#players").innerHTML = ps.map(([id, p]) => playerMarkup({room,me,id,player:p,adm,fmt})).join("") || emptyState("👥", "Nenhum jogador", "Os jogadores conectados aparecerão aqui.");
  renderAdminPlayers({room,me,$,ps,adm});
  $("#to").innerHTML = opts;
  if ($("#tradeRecipient")) $("#tradeRecipient").innerHTML = tradeOpts?`<option value="">Selecione...</option>${tradeOpts}`:`<option value="">Nenhum jogador disponível</option>`;
  refreshAssetTransferRecipients(ps);
  const p = room.state.players?.get?.(me);
  if (p) renderAssets({room,$,player:p,fmt,catalog,onSell:openAssetSale,onTransfer:openAssetTransfer});
  pending(adm);
  renderTradesModule({room,me,$,fmt,emptyState});
  renderLiabilitiesModule({room,me,$,fmt,emptyState});
  renderSettlementsModule({room,me,$,fmt,emptyState});
  renderAssistiveTools(p, adm);
  renderAssistiveGameplay({room,me,$,catalog,fmt});
  simpleUX?.render();
  events();
}
function pending(adm) {
  const all = room.state.pending?.values ? [...room.state.pending.values()] : [],
    vis = all.filter((q) => canSeePending(q, me, adm)),
    gifts = schemaValues(room.state.trades).filter((t) => t.proposerCash === 0 && t.recipientCash === 0 && t.proposerHabeasCount === 0 && t.recipientHabeasCount === 0 && schemaValues(t.proposerAssetIds).length === 1 && schemaValues(t.recipientAssetIds).length === 0 && (t.proposerId === me || t.recipientId === me));
  const total = vis.length + gifts.length;
  $("#count").textContent = total;
  $("#count").classList.toggle("hidden", !total);
  $("#pendingCard")?.classList.toggle("hidden", !total);
  const markup = (q) => {
    const can = canRespondPending(q, me, adm), from = room.state.players?.get?.(q.fromId), to = room.state.players?.get?.(q.toId);
    const actions = can ? `<button data-y="${q.id}">Aceitar</button><button data-n="${q.id}">Recusar</button>` : `<button data-c="${q.id}">Cancelar</button>`;
    if (q.kind === "transfer" || q.kind === "money") {
      const title = can ? `${esc(q.fromName)} quer transferir ${fmt(q.amount)} para você.` : `Transferência pendente para ${esc(q.toName)}`;
      return `<div class="pending ${can ? "incoming" : ""}"><strong>${title}</strong><div class="pending-review"><span>De: <b>${esc(q.fromName)}</b></span><span>Para: <b>${esc(q.toName)}</b></span><span>Valor: <b>${fmt(q.amount)}</b></span></div><div class="row">${actions}</div></div>`;
    }
    if (q.kind === "asset") {
      const current = Number(from?.balance || 0), after = current - Number(q.purchase || 0);
      const title = can ? `${esc(q.fromName)} quer comprar ${esc(q.name)}` : `⏳ Compra de ${esc(q.name)} aguardando ADM`;
      return `<div class="pending ${can ? "incoming" : ""}"><strong>${title}</strong><div class="pending-review"><span>Preço oficial: <b>${fmt(q.purchase)}</b></span><span>Saldo atual: <b>${fmt(current)}</b></span><span>Saldo após compra: <b>${fmt(after)}</b></span></div><div class="row">${actions}</div></div>`;
    }
    if (q.kind === "bank_sale") {
      const current = Number(from?.balance || 0), after = current + Number(q.purchase || 0);
      const title = can ? `${esc(q.fromName)} quer vender ${esc(q.name)} ao banco` : `⏳ Venda de ${esc(q.name)} aguardando ADM`;
      return `<div class="pending ${can ? "incoming" : ""}"><strong>${title}</strong><div class="pending-review"><span>Valor oficial: <b>${fmt(q.purchase)}</b></span><span>Saldo atual: <b>${fmt(current)}</b></span><span>Saldo após venda: <b>${fmt(after)}</b></span></div><div class="row">${actions}</div></div>`;
    }
    if (q.kind === "start_bonus") {
      const title = can ? `${esc(q.fromName)} solicita o pró-labore do Início.` : `⏳ Pró-labore do Início aguardando ADM`;
      return `<div class="pending ${can ? "incoming" : ""}"><strong>${title}</strong><div class="pending-review"><span>Jogador: <b>${esc(q.fromName)}</b></span><span>Valor: <b>${fmt(q.amount)}</b></span></div><div class="row">${actions}</div></div>`;
    }
    return `<div class="pending ${can ? "incoming" : ""}"><strong>${esc(q.fromName)}</strong><div>${esc(q.name || fmt(q.amount))} • ${esc(q.reason)}</div><div class="row">${actions}</div></div>`;
  };
  const giftMarkup = (t) => {
    const proposer = room.state.players?.get?.(t.proposerId), recipient = room.state.players?.get?.(t.recipientId), assetId = schemaValues(t.proposerAssetIds)[0], asset = schemaValues(proposer?.assets).find((a) => a.id === assetId), incoming = t.recipientId === me;
    const name = asset?.name || "título";
    const title = incoming ? `${esc(proposer?.name || "Jogador")} quer transferir ${esc(name)} para você.` : `Transferência de ${esc(name)} aguardando ${esc(recipient?.name || "jogador")}`;
    const actions = incoming ? `<button data-trade-y="${t.id}">Aceitar</button><button data-trade-n="${t.id}">Recusar</button>` : `<button data-trade-c="${t.id}">Cancelar</button>`;
    return `<div class="pending ${incoming ? "incoming" : ""}"><strong>${title}</strong><div class="pending-review"><span>Você ${incoming ? "recebe" : "transfere"}: <b>${esc(name)}</b></span><span>Dinheiro movimentado: <b>${fmt(0)}</b></span></div><div class="row">${actions}</div></div>`;
  };
  $("#pending").innerHTML = total ? [...vis.map(markup), ...gifts.map(giftMarkup)].join("") : '<div class="empty">Nenhuma aprovação.</div>';
  document.querySelectorAll("[data-y]").forEach((b) => (b.onclick = () => room.send("respond", { id: b.dataset.y, accept: true })));
  document.querySelectorAll("[data-n]").forEach((b) => (b.onclick = () => room.send("respond", { id: b.dataset.n, accept: false })));
  document.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => room.send("cancel", { id: b.dataset.c })));
  document.querySelectorAll("[data-trade-y]").forEach((b) => (b.onclick = () => room.send("respond_trade", { id: b.dataset.tradeY, accept: true })));
  document.querySelectorAll("[data-trade-n]").forEach((b) => (b.onclick = () => room.send("respond_trade", { id: b.dataset.tradeN, accept: false })));
  document.querySelectorAll("[data-trade-c]").forEach((b) => (b.onclick = () => room.send("cancel_trade", { id: b.dataset.tradeC })));
}

function events() {
  const query = $("#search").value.toLocaleLowerCase("pt-BR");
  const filtered = schemaValues(room.state.events).reverse().slice(0, lowPowerDevice ? 40 : 100).filter((event) => !query || event.message.toLocaleLowerCase("pt-BR").includes(query));
  const markup = filtered.length ? filtered.map((event) => {
    const { type, label } = eventPresentation(event);
    return `<div class="event" data-event-type="${type}"><span class="event-kind">${label}</span><strong>#${String(event.seq).padStart(3, "0")}</strong> ${esc(event.message)}<div class="small">${new Date(event.at).toLocaleTimeString("pt-BR")}</div></div>`;
  }).join("") : emptyState("🔍", "Nenhum evento encontrado", "Tente buscar por outra palavra.");
  $("#events").innerHTML = markup;
  const recent = schemaValues(room.state.events).reverse().slice(0,3);
  if ($("#recentEvents")) $("#recentEvents").innerHTML = recent.length ? recent.map(event => `<div class="recent-event">${esc(event.message)}<span>${new Date(event.at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span></div>`).join("") : '<div class="small">A partida acabou de começar.</div>';
}
function showCatalog() {
  const p = P($("#prop").value), o = O($("#org").value);
  if (!p || !o) return;
  const currentPlayer = room?.state?.players?.get(me), balanceAfter = currentPlayer ? Number(currentPlayer.balance) - Number(p.purchase || 0) : null;
  $("#propInfo").textContent = `Compra ${fmt(p.purchase)} • Casa ${fmt(p.houseCost)} • Condomínio ${fmt(p.condominiumCost)} • Hipoteca ${fmt(p.mortgage)}`;
  $("#propEstimate").innerHTML = `<strong>Compra: ${fmt(p.purchase)}</strong><div>Entra sem construções. Use Patrimônio para construir depois.</div>${balanceAfter === null ? "" : `<div>Seu saldo após aprovação: ${fmt(balanceAfter)}</div>`}`;
  $("#orgInfo").textContent = `Compra ${fmt(o.purchase)} • Dados × ${fmt(o.multiplier)} • Hipoteca ${fmt(o.mortgage)}`;
}
function calcRules() {
  const p = P($("#rentProp").value),
    v = p.rent[Number($("#rentDev").value)];
  $("#rentResult").textContent = `Referência visual: ${fmt(v)}. Para registrar cobrança/pagamento, use “Registrar jogada física”; o servidor calcula o valor canônico.`;
  $("#fmiResult").textContent = `Simulação legada: ${$("#diceSum").value} × 2.000 = ${fmt(Number($("#diceSum").value) * 2000)}`;
}

function renderAssistiveTools(player, adm) {
  if (!player) return;
  const playersState = room.state.players;
  if ($("#turnStatus")) $("#turnStatus").textContent = room.state.gameStarted ? `Rodada ${room.state.round || 1} • turno ${room.state.turnNumber || 1} • atual: ${playersState?.get?.(room.state.currentPlayerId)?.name || "—"}` : "Ordem de turnos ainda não iniciada.";
  if ($("#jailStatus")) $("#jailStatus").textContent = player.jailed ? `Você está preso • tentativa ${player.jailAttempts}/3 • aluguéis continuam, negociações bloqueadas.` : player.jailVisiting ? "Você está apenas visitando a cadeia." : "Você não está na cadeia.";
  if ($("#start")) { $("#start").disabled = !player.startBonusAvailable; $("#start").textContent = player.startBonusAvailable ? `Receber ${fmt(synchronizedRules(room).startSalary || 200000)} do Início` : "Pró-labore indisponível nesta jogada"; }
  if ($("#institutionCalc") && !$("#institutionCalc").options.length) $("#institutionCalc").innerHTML = catalog.organizations.map((o) => `<option value="${o.id}">${esc(o.name)}</option>`).join("");
  if(adm && $("#jailAdminTarget")){const box=$("#jailAdminTarget"),keep=box.value;const players=playersState?.entries?[...playersState.entries()]:[];box.innerHTML=players.filter(([,x])=>!x.bankrupt).map(([id,x])=>`<option value="${id}">${esc(x.name)}</option>`).join("");if([...box.options].some(o=>o.value===keep))box.value=keep;}
  if (adm && $("#adminAdjustPlayer")) {
    const players=(playersState?.entries?[...playersState.entries()]:[]).filter(([,x])=>!x.bankrupt);
    const previous=$("#adminAdjustPlayer").value;
    $("#adminAdjustPlayer").innerHTML=players.map(([id,x])=>`<option value="${id}">${esc(x.name)}</option>`).join("");
    if(players.some(([id])=>id===previous)) $("#adminAdjustPlayer").value=previous;
    updateAdminAdjustAssets();
  }
}



function updateAdminAdjustAssets(){
  const playerId=$("#adminAdjustPlayer")?.value,p=room?.state?.players?.get(playerId),box=$("#adminAdjustAsset");if(!box)return;
  const current=box.value;const props=p?[...p.assets].filter(a=>a.kind==="property"):[];box.innerHTML=props.map(a=>`<option value="${a.id}">${esc(a.name)} • nível ${a.development}</option>`).join("");if(props.some(a=>a.id===current))box.value=current;
}

function saveRecent() {
  const s = JSON.parse(localStorage.getItem(sessionKey) || "{}");
  localStorage.setItem(recentKey, JSON.stringify(s));
  localStorage.removeItem(sessionKey);
  return s;
}
function showRecent() {
  const r = JSON.parse(localStorage.getItem(recentKey) || "null");
  if (r) {
    $("#returnCard").classList.remove("hidden");
    $("#returnRoom").textContent = r.roomId;
    $("#returnName").textContent = r.name;
  }
}
async function leave() {
  if (
    !confirm(
      "Sair da sala? Você poderá entrar novamente enquanto ela estiver ativa e aberta.",
    )
  )
    return;
  intentional = true;
  const s = saveRecent();
  $("#game").classList.add("hidden");
  $("#lobby").classList.add("hidden");
  showRecent();
  const old = room;
  room = null;
  await old.leave();
}
$("#create").onclick = () => { simpleUX?.saveLastRules(); connect(true); };
$("#join").onclick = () => connect(false);
$("#cancelConnect").onclick = () => connectionAttempt?.abort();
$("#rejoin").onclick = () => {
  const r = JSON.parse(localStorage.getItem(recentKey) || "null");
  if (r)
    connect(false, {
      ...r,
      initialBalance: 2558000,
      deviceToken: localStorage.deviceToken,
      recoveryCode: r.recoveryCode,
    });
};
$("#home").onclick = () => {
  localStorage.removeItem(recentKey);
  $("#returnCard").classList.add("hidden");
  $("#lobby").classList.remove("hidden");
};
$("#leave").onclick = leave;
$("#copy").onclick = () => navigator.clipboard.writeText(room.roomId);
$("#invite").onclick = () =>
  navigator.clipboard.writeText(`Banco Mundo Online\nCódigo: ${room.roomId}`);
$("#fullInvite").onclick = () =>
  navigator.clipboard.writeText(
    `Banco Mundo Online\nCódigo: ${room.roomId}\nPIN: ${pin}`,
  );
$("#lock").onclick = () => room.send("toggle_lock");
$("#pause").onclick = () => {
  if(!room)return;
  if(room.state.paused){room.send("resume_room");toast("Solicitação para retomar a partida enviada.","info");return;}
  if(confirm("Pausar e salvar a partida para continuar outro dia?"))room.send("pause_room");
};
$("#backup").onclick = () => {
  if(!room)return toast("Entre em uma partida antes de baixar o backup.","warning");
  const button=$("#backup");button.disabled=true;button.textContent="Preparando backup...";room.send("backup");
  setTimeout(()=>{if(button.disabled){button.disabled=false;button.textContent="Baixar backup";}},8000);
};
$("#report").onclick = () => room.send("report");
$("#end").onclick = () => $("#endModal").classList.remove("hidden");
$("#endBack").onclick = () => $("#endModal").classList.add("hidden");
$("#endConfirm").onclick = () => room.send("end_room");
$("#buyProp").onclick = () => {
  const p = P($("#prop").value);
  room.send("asset", { catalogId: p.id, reason: $("#propReason").value });
};
$("#buyOrg").onclick = () => {
  const o = O($("#org").value);
  room.send("asset", { catalogId: o.id, reason: $("#orgReason").value });
};
$("#send").onclick = () => {
  const amount = Number($("#amount").value), to = $("#to").value, player = room?.state?.players?.get?.(me), error = $("#transferError");
  if (error) { error.textContent = ""; error.classList.add("hidden"); }
  if (!to || !Number.isFinite(amount) || amount <= 0) { const message="Informe destinatário e valor válido."; if(error){error.textContent=message;error.classList.remove("hidden");} return toast(message,"warning"); }
  if (player && Number(player.balance) < amount) { const message=`Saldo insuficiente. Seu saldo: ${fmt(player.balance)}. Valor solicitado: ${fmt(amount)}.`; if(error){error.textContent=message;error.classList.remove("hidden");} return toast(message,"error"); }
  room.send("money", { to, amount, reason: $("#reason").value });
  $("#transferModal")?.classList.add("hidden");
};
$("#bank").onclick = () =>
  room.send("bank", {
    amount: Number($("#bankAmount").value),
    reason: $("#bankReason").value,
  });
$("#start").onclick = () => room.send("start_bonus");
$("#fmi").onclick = () =>
  room.send("fmi", {
    kind: $("#fmiKind").value,
    sum: Number($("#diceSum").value),
  });
$("#prop").onchange = showCatalog;
$("#org").onchange = showCatalog;
$("#rentProp").onchange = calcRules;
$("#rentDev").onchange = calcRules;
$("#diceSum").oninput = calcRules;
$("#search").oninput = events;
$("#theme").onclick = () => {
  const d = document.documentElement.dataset.theme !== "dark";
  document.documentElement.dataset.theme = d ? "dark" : "light";
  localStorage.theme = d ? "dark" : "light";
  $("#theme").textContent = d ? "☀️" : "🌙";
};
document.documentElement.dataset.theme = localStorage.theme || "light";
$("#theme").textContent =
  document.documentElement.dataset.theme === "dark" ? "☀️" : "🌙";
document.querySelectorAll(".tab").forEach(
  (b) =>
    (b.onclick = () => {
      document
        .querySelectorAll(".tab,.panel")
        .forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      $("#" + b.dataset.tab).classList.add("active");
    }),
);
simpleUX = initSimpleUX({$,getRoom:()=>room,getMe:()=>me,getCatalog:()=>catalog,fmt,toast,onRulesChanged:()=>ruleReviewModule($)});
init().catch((error) => { console.error(error); toast("Falha ao iniciar o aplicativo.", "error"); });
bindManual($);
bindAssistiveGameplay({$,getRoom:()=>room,getMe:()=>me,toast});
$("#requestBankruptcy").onclick = () => toast("Selecione uma obrigação específica na Central de Liquidez. A falência só pode ser declarada no contexto dessa obrigação.", "warning");
document.addEventListener("click", (event) => {
  const declareButton = event.target.closest("[data-declare-bankrupt]");
  if (declareButton && confirm("Declarar falência? Construções serão liquidadas por 50%, patrimônios voltarão ao banco e o perfil ficará bloqueado.")) {
    if (confirm("Confirma definitivamente a falência deste jogador?")) room.send("declare_bankruptcy", { playerId: declareButton.dataset.declareBankrupt, liabilityId: declareButton.dataset.liabilityId || "" });
  }
  const restoreButton = event.target.closest("[data-restore-bankrupt]");
  if (restoreButton && confirm("Restaurar o retrato anterior à falência?")) room.send("restore_bankruptcy", { playerId: restoreButton.dataset.restoreBankrupt });
});

$("#toggleRecovery").onclick = () => {
  const visible = $("#myRecoveryCode").dataset.visible === "true";
  recoveryTools.update(!visible);
};
$("#copyRecovery").onclick = recoveryTools.copy;
$("#shareRecovery").onclick = recoveryTools.share;
$("#transferAdmin").onclick = () => {
  const playerId = $("#transferAdminPlayer").value;
  if (!playerId) return toast("Selecione um jogador online.");
  room.send("transfer_admin", { playerId });
};
function chooseImportedProfile(profile,data,restoredPin=""){
  recoveryCode=profile.recoveryToken;
  $("#name").value=profile.name;$("#code").value=data.saveCode;$("#recoveryInput").value=profile.recoveryToken;
  if(restoredPin)$("#pin").value=restoredPin;
  connect(false,{name:profile.name,pin:restoredPin,deviceToken:localStorage.deviceToken||(localStorage.deviceToken=crypto.randomUUID()),recoveryCode:profile.recoveryToken,resumeCode:data.saveCode,initialBalance:2558000});
}
async function restoreBackupFromLobby(){
  const button=$("#lobbyImportBackup"),file=$("#lobbyImportFile")?.files?.[0],restoredPin=$("#lobbyImportPin")?.value?.trim()||"";
  if(!file)return toast("Selecione um backup JSON.","warning");
  button.disabled=true;button.textContent="Restaurando...";
  try{
    await wakeBackend({isLocal,apiBase,$});
    const data=await importBackup({apiBase,file,pin:restoredPin,toast,onImported:data=>renderImportedBackup({result:$("#lobbyImportResult"),data,onChooseProfile:profile=>chooseImportedProfile(profile,data,restoredPin)})});
    if(data)$("#code").value=data.saveCode;
  }catch(error){toast(error?.message||"Não foi possível acessar o servidor para restaurar o backup.","error");}
  finally{button.disabled=false;button.textContent="Restaurar backup";setConnectionState($,false);}
}
$("#lobbyImportBackup")?.addEventListener("click",restoreBackupFromLobby);
$("#importBackup").onclick = async()=>{const data=await importBackup({apiBase,file:$("#importFile").files?.[0],pin:$("#pin").value.trim(),toast,onImported:data=>renderImportedBackup({result:$("#importResult"),data})});if(data)$("#code").value=data.saveCode;};



$("#createReviewBack")?.addEventListener("click", () => $("#createReviewModal")?.classList.add("hidden"));
$("#createReviewConfirm")?.addEventListener("click", () => { $("#createReviewModal")?.classList.add("hidden"); connect(true); });
$("#adminAdjustPlayer")?.addEventListener("change", updateAdminAdjustAssets);
$("#adminAdjustApply")?.addEventListener("click", () => { const playerId=$("#adminAdjustPlayer")?.value,assetId=$("#adminAdjustAsset")?.value;if(!playerId||!assetId)return toast("Selecione jogador e propriedade.","warning");room.send("admin_adjust_asset",{playerId,assetId,development:Number($("#adminAdjustDevelopment")?.value||0)}); });

$("#assetSellClose")?.addEventListener("click",()=>closeAssetModal("#assetSellModal"));
$("#assetSellCancel")?.addEventListener("click",()=>closeAssetModal("#assetSellModal"));
$("#assetSellConfirm")?.addEventListener("click",()=>{if(!assetSellId)return;room.send("request_bank_sale",{id:assetSellId});closeAssetModal("#assetSellModal");});
$("#assetTransferClose")?.addEventListener("click",()=>closeAssetModal("#assetTransferModal"));
$("#assetTransferCancel")?.addEventListener("click",()=>closeAssetModal("#assetTransferModal"));
$("#assetTransferConfirm")?.addEventListener("click",()=>{const recipientId=$("#assetTransferRecipient")?.value;if(!assetTransferId||!recipientId)return toast("Escolha o jogador que receberá o título.","warning");room.send("trade",{recipientId,proposerCash:0,recipientCash:0,proposerAssetIds:[assetTransferId],recipientAssetIds:[],proposerHabeasCount:0,recipientHabeasCount:0});closeAssetModal("#assetTransferModal");toast("Transferência enviada para confirmação.","info");});

$("#rulesOfficial")?.addEventListener("click", () => { applyOfficialRules(document); ruleReviewModule($); });
$("#rulesCustom")?.addEventListener("click", () => { ruleReviewModule($); $("#ruleFullGroup")?.focus(); });
["ruleFullGroup","ruleEvenBuilding","ruleCondoAfter","ruleLimitedStock","ruleEarlyJailFine","ruleAutoStart","ruleDigitalDice","ruleInitialDistribution","ruleLiquidationVictory","ruleTimedGame","ruleTimeMinutes"].forEach((id) => $("#"+id)?.addEventListener("change", () => ruleReviewModule($)));
$("#tradeRecipient")?.addEventListener("change", () => updateTradeAssetListsModule({room,me,$}));
$("#proposeTrade")?.addEventListener("click", () => {
  const recipientId=$("#tradeRecipient")?.value; if(!recipientId)return toast("Selecione o destinatário.","warning");
  room.send("trade", { recipientId, proposerCash:Number($("#tradeGiveCash")?.value||0), recipientCash:Number($("#tradeReceiveCash")?.value||0), proposerAssetIds:[...document.querySelectorAll(".trade-give-asset:checked")].map(x=>x.value), recipientAssetIds:[...document.querySelectorAll(".trade-receive-asset:checked")].map(x=>x.value), proposerHabeasCount:Number($("#tradeGiveHabeas")?.value||0), recipientHabeasCount:Number($("#tradeReceiveHabeas")?.value||0) });
});
$("#proposeSettlement")?.addEventListener("click",()=>{const liabilityId=$("#settlementLiability")?.value;if(!liabilityId)return toast("Selecione uma obrigação aberta.","warning");room.send("settlement",{liabilityId,cash:Number($("#settlementCash")?.value||0),assetIds:[...document.querySelectorAll(".settlement-asset:checked")].map(x=>x.value),note:$("#settlementNote")?.value||""});});
$("#startTurns")?.addEventListener("click", () => room.send("start_turns", { order:schemaKeys(room.state.players) }));
$("#endTurn")?.addEventListener("click", () => room.send("end_turn"));
$("#markStartBonus")?.addEventListener("click", () => room.send("mark_start_bonus", { playerId:room.state.currentPlayerId }));
$("#jailVisit")?.addEventListener("click", () => room.send("jail_action", { action:"visit", playerId:$("#jailAdminTarget")?.value||me }));
$("#jailSend")?.addEventListener("click", () => room.send("jail_action", { action:"send", playerId:$("#jailAdminTarget")?.value||me }));
$("#jailGrantHabeas")?.addEventListener("click", () => room.send("jail_action", { action:"grant_habeas", playerId:$("#jailAdminTarget")?.value||me }));
$("#jailAttempt")?.addEventListener("click", () => room.send("jail_action", { action:"failed_roll" }));
$("#jailFine")?.addEventListener("click", () => room.send("jail_action", { action:"pay_fine" }));
$("#jailHabeas")?.addEventListener("click", () => room.send("jail_action", { action:"habeas" }));
$("#calculateInstitution")?.addEventListener("click", () => room.send("organization_fee", { catalogId:$("#institutionCalc")?.value, diceSum:Number($("#institutionDice")?.value||0) }));
ruleReviewModule($);

initShellFeatures({ toast, clearFieldError });
