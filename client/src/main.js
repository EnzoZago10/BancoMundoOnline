import { Callbacks, Client } from "@colyseus/sdk";
import catalog from "./catalog.json" with { type: "json" };
const $ = (s) => document.querySelector(s);
const isLocal =
  location.hostname === "localhost" || location.hostname === "127.0.0.1";

const apiBase = isLocal
  ? `http://${location.hostname}:2567`
  : "https://bancomundoonline.onrender.com";
let room,
  me,
  pin = "",
  intentional = false,
  recoveryCode = "",
  recoveryHideTimer;
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
    element.innerHTML = `<span class="toast-icon" aria-hidden="true">${icons[inferred]}</span>${text}`;
    element.style.display = "block";
    clearTimeout(element._hideTimer);
    element._hideTimer = setTimeout(() => (element.style.display = "none"), inferred === "error" ? 3600 : 2400);
  };
const lowPowerDevice =
  (Number(navigator.deviceMemory || 8) <= 4 || Number(navigator.hardwareConcurrency || 8) <= 4);
if (lowPowerDevice) document.documentElement.classList.add("lite");


const fieldLabels = {
  name: "Nome do jogador", balance: "Saldo inicial", code: "Código temporário ou permanente",
  pin: "PIN da partida", recoveryInput: "Código pessoal de recuperação (opcional)",
  importFile: "Arquivo de backup", prop: "Propriedade", dev: "Nível de construção",
  propReason: "Motivo da compra", org: "Organização", orgReason: "Motivo da compra",
  to: "Destinatário", amount: "Valor do pagamento", reason: "Motivo do pagamento",
  bankAmount: "Valor da operação bancária", bankReason: "Motivo da operação",
  rentProp: "Propriedade para calcular aluguel", rentDev: "Nível de construção",
  fmiKind: "Tipo de operação FMI", diceSum: "Soma dos dados", creditor: "Credor",
  debtAmount: "Valor original da dívida", cash: "Dinheiro oferecido", note: "Observação",
  search: "Buscar no histórico", manualSearch: "Buscar no manual", transferAdminPlayer: "Novo ADM"
};

function decorateInterface() {
  document.querySelectorAll("button").forEach((button) => {
    if (!button.getAttribute("type")) button.type = "button";
  });
  Object.entries(fieldLabels).forEach(([id, text]) => {
    const control = document.getElementById(id);
    if (!control || control.closest(".field-wrap")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "field-wrap";
    const label = document.createElement("label");
    label.className = "field-label";
    label.htmlFor = id;
    label.textContent = text;
    control.parentNode.insertBefore(wrapper, control);
    wrapper.append(label, control);
  });
  const lobby = document.querySelector("#lobby");
  if (lobby && !lobby.querySelector(".lobby-hero")) {
    const hero = document.createElement("div");
    hero.className = "lobby-hero";
    hero.innerHTML = "<h2>Sua partida, organizada em um só lugar</h2><p>Crie uma sala, convide o grupo e gerencie dinheiro, propriedades e decisões em tempo real.</p>";
    lobby.prepend(hero);
  }
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

function init() {
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

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => {
    clearTimeout(timer);
    reject(new DOMException("Cancelado", "AbortError"));
  }, { once: true });
});

function setConnectionState(active, title = "", detail = "") {
  [$("#create"), $("#join"), $("#rejoin")].forEach((button) => {
    if (button) button.disabled = active;
  });
  const box = $("#connectStatus");
  if (!box) return;
  box.classList.toggle("hidden", !active);
  if (title) $("#connectTitle").textContent = title;
  if (detail) $("#connectDetail").textContent = detail;
}

async function wakeBackend(signal) {
  if (isLocal) return;
  const delays = [0, 1500, 2500, 4000, 6000, 8000, 10000, 12000];
  let lastError;
  for (let index = 0; index < delays.length; index += 1) {
    if (delays[index]) await sleep(delays[index], signal);
    setConnectionState(true, "Acordando servidor...", `Tentativa ${index + 1} de ${delays.length}. Aguarde sem tocar novamente.`);
    try {
      const response = await fetch(`${apiBase}/api/health`, {
        cache: "no-store",
        signal,
      });
      if (response.ok) {
        const health = await response.json();
        if (health?.ok) return;
      }
      lastError = Error(`Servidor respondeu ${response.status}.`);
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      lastError = error;
    }
  }
  throw Error(lastError?.message || "O servidor não respondeu. Tente novamente.");
}

async function connect(create, override) {
  if (connectionAttempt) return;
  if (!validateConnectionForm(create, override)) return;
  const controller = new AbortController();
  connectionAttempt = controller;
  setConnectionState(true, "Preparando conexão...", "Não pressione os botões novamente.");
  try {
    await wakeBackend(controller.signal);
    setConnectionState(true, create ? "Criando sala..." : "Conectando à partida...", "A conexão será feita uma única vez.");
    const wsUrl = isLocal
      ? `ws://${location.hostname}:2567`
      : "wss://bancomundoonline.onrender.com";
    const client = new Client(wsUrl),
      data = override || {
        name: $("#name").value,
        initialBalance: Number($("#balance").value),
        pin: (pin = $("#pin").value),
        deviceToken:
          localStorage.deviceToken ||
          (localStorage.deviceToken = crypto.randomUUID()),
        recoveryCode: $("#recoveryInput").value.trim() || recoveryCode,
      };
    if (create && !data.operationId) data.operationId = crypto.randomUUID();
    recoveryCode = data.recoveryCode || recoveryCode;
    if (override?.resumeCode) {
      room = await client.joinOrCreate("bank_room", data);
    } else if (create) {
      room = await client.create("bank_room", data);
    } else {
      const enteredCode = (override?.roomId || $("#code").value).trim();
      if (!enteredCode) throw Error("Informe o código da sala ou da partida salva.");
      try {
        room = await client.joinById(enteredCode, data);
      } catch (activeRoomError) {
        try {
          room = await client.joinOrCreate("bank_room", { ...data, resumeCode: enteredCode });
        } catch (savedRoomError) {
          throw Error(savedRoomError?.message || activeRoomError?.message || "Sala ou partida salva não encontrada.");
        }
      }
    }
    me = room.sessionId;
    intentional = false;
    localStorage.removeItem(recentKey);
    localStorage.setItem(
      sessionKey,
      JSON.stringify({
        roomId: room.roomId,
        saveCode: room.state.saveCode,
        name: data.name,
        pin: data.pin,
        recoveryCode: data.recoveryCode || recoveryCode,
      }),
    );
    $("#lobby").classList.add("hidden");
    $("#returnCard").classList.add("hidden");
    $("#game").classList.remove("hidden");
    bind();
  } catch (error) {
    if (error?.name === "AbortError") {
      toast("Conexão cancelada.");
    } else {
      toast(error?.message || "Não foi possível conectar.");
    }
  } finally {
    connectionAttempt = null;
    setConnectionState(false);
  }
}
let renderFrame = 0;
function queueRender() {
  if (renderFrame) return;
  renderFrame = requestAnimationFrame(() => {
    renderFrame = 0;
    render();
  });
}

function bind() {
  const c = Callbacks.get(room);
  c.onAdd("players", (p) => {
    c.listen(p, "balance", queueRender);
    c.listen(p, "connected", queueRender);
    c.onAdd(p, "assets", queueRender);
    c.onRemove(p, "assets", queueRender);
    queueRender();
  });
  c.onRemove("players", queueRender);
  c.onAdd("pending", queueRender);
  c.onRemove("pending", queueRender);
  c.onAdd("debts", queueRender);
  c.onRemove("debts", queueRender);
  c.onAdd("events", queueRender);
  c.listen(room.state, "hostId", queueRender);
  c.listen(room.state, "locked", queueRender);
  room.onMessage("error", toast);
  room.onMessage("profile_recovered", (d) => {
    recoveryCode = d.recoveryCode;
    const s = JSON.parse(localStorage.getItem(sessionKey) || "{}");
    s.recoveryCode = recoveryCode;
    s.saveCode = room.state.saveCode;
    localStorage.setItem(sessionKey, JSON.stringify(s));
    updateRecoveryCard();
    toast("Perfil protegido. Consulte o código em Meu perfil e recuperação.");
  });
  room.onMessage("room_paused", (d) => {
    toast(d.message);
  });
  room.onMessage("kicked", (m) => {
    localStorage.removeItem(sessionKey);
    alert(m);
    location.reload();
  });
  room.onMessage("room_ended", (m) => {
    localStorage.removeItem(sessionKey);
    alert(m);
    location.reload();
  });
  room.onMessage("report", download);
  room.onLeave(() => {
    if (!intentional) toast("Conexão encerrada.");
  });
  queueRender();
}
function getStoredRecoveryCode() {
  if (recoveryCode) return recoveryCode;
  try {
    return JSON.parse(localStorage.getItem(sessionKey) || "{}").recoveryCode || "";
  } catch {
    return "";
  }
}
function updateRecoveryCard(show = false) {
  const code = getStoredRecoveryCode();
  let storedName = "";
  try {
    storedName = JSON.parse(localStorage.getItem(sessionKey) || "{}").name || "";
  } catch {}
  const name = room?.state?.players?.get(me)?.name || storedName;
  const nameBox = $("#myProfileName");
  const codeBox = $("#myRecoveryCode");
  const toggle = $("#toggleRecovery");
  if (!nameBox || !codeBox || !toggle) return;
  nameBox.textContent = name ? `Jogador: ${name}` : "";
  codeBox.textContent = show && code ? code : code ? "••••••••" : "Código ainda não disponível";
  codeBox.dataset.visible = show && code ? "true" : "false";
  toggle.textContent = show && code ? "🙈 Ocultar código" : "👁 Mostrar código";
  clearTimeout(recoveryHideTimer);
  if (show && code) recoveryHideTimer = setTimeout(() => updateRecoveryCard(false), 20000);
}
async function writeText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}
async function copyRecoveryCode() {
  const code = getStoredRecoveryCode();
  if (!code) return toast("Código pessoal ainda não disponível.");
  try {
    await writeText(code);
    toast("Código pessoal copiado.");
  } catch {
    toast("Não foi possível copiar. Use Mostrar código.");
  }
}
async function shareRecoveryCode() {
  const code = getStoredRecoveryCode();
  if (!code) return toast("Código pessoal ainda não disponível.");
  const name = room?.state?.players?.get(me)?.name || "Jogador";
  const text = `Banco Mundo Online\nJogador: ${name}\nCódigo pessoal de recuperação: ${code}\n\nGuarde em local privado.`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "Meu código de recuperação", text });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  try {
    await writeText(text);
    toast("Dados de recuperação copiados.");
  } catch {
    toast("Não foi possível compartilhar ou copiar.");
  }
}

function emptyState(icon, title, detail) {
  return `<div class="empty-state"><span class="empty-icon" aria-hidden="true">${icon}</span><strong>${title}</strong><p>${detail}</p></div>`;
}
function eventCategory(message) {
  const text = String(message || "").toLocaleLowerCase("pt-BR");
  if (/fal[eê]ncia|falido/.test(text)) return ["falencia", "Falência"];
  if (/hipotec/.test(text)) return ["hipoteca", "Hipoteca"];
  if (/d[ií]vida|acordo|proposta/.test(text)) return ["divida", "Dívida"];
  if (/adm|expuls|sala|entrada|bloque/.test(text)) return ["administracao", "Administração"];
  if (/propriedade|institui|patrim|casa|condom[ií]nio/.test(text)) return ["patrimonio", "Patrimônio"];
  if (/pag|saldo|banco|dinheiro|fmi|b[oô]nus/.test(text)) return ["financeiro", "Financeiro"];
  return ["sistema", "Sistema"];
}
function updateSummaryAndBadges(ps, adm) {
  const mePlayer = room.state.players.get(me);
  $("#summaryBalance").textContent = mePlayer ? fmt(mePlayer.balance) : "0";
  $("#summaryOnline").textContent = String(ps.filter(([, player]) => player.connected).length);
  const visiblePending = [...room.state.pending.values()].filter((q) => q.fromId === me || (q.kind === "money" ? q.toId === me : adm));
  const needsMe = visiblePending.filter((q) => q.fromId !== me && (q.kind === "money" ? q.toId === me : adm)).length;
  $("#summaryPending").textContent = String(visiblePending.length);
  $("#summaryRoom").textContent = room.state.paused ? "Pausada" : room.state.locked ? "Bloqueada" : "Aberta";
  [$("#approvalBadge"), $("#moreApprovalBadge")].forEach((badge) => {
    if (!badge) return;
    badge.textContent = String(visiblePending.length);
    badge.classList.toggle("hidden", visiblePending.length === 0);
    badge.classList.toggle("waiting", needsMe === 0);
    badge.setAttribute("aria-label", `${visiblePending.length} aprovações pendentes`);
  });
}
function playerMarkup(id, player, adm) {
  const badges = [
    id === me ? '<span class="status-chip badge-online">Você</span>' : "",
    id === room.state.hostId ? '<span class="status-chip badge-admin">ADM</span>' : "",
    `<span class="status-chip ${player.connected ? "badge-online" : "badge-offline"}">${player.connected ? "Online" : "Offline"}</span>`,
    player.bankrupt ? '<span class="status-chip badge-bankrupt">Falido</span>' : "",
  ].join("");
  const actions = adm && id !== me ? (player.connected ? `<button class="danger" data-kick="${id}">Expulsar</button>` : `<button class="danger" data-remove="${id}">Remover offline</button>`) : "";
  return `<div class="player ${id === me ? "me" : ""} ${id === room.state.hostId ? "admin" : ""} ${player.connected ? "" : "offline"} ${player.bankrupt ? "bankrupt" : ""}"><div class="player-card-head"><span class="player-name">${player.name}</span><span class="player-badges">${badges}</span></div><div class="player-balance"><span>Saldo</span><strong>${fmt(player.balance)}</strong></div><div class="player-stats"><div class="player-stat"><span class="small">Enviado</span><br><strong>${fmt(player.sent)}</strong></div><div class="player-stat"><span class="small">Recebido</span><br><strong>${fmt(player.received)}</strong></div></div>${actions ? `<div class="player-actions">${actions}</div>` : ""}</div>`;
}
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
  if (!name.value.trim()) return !showFieldError(name, "Informe o nome do jogador.");
  if (!pinField.value.trim()) return !showFieldError(pinField, "Informe o PIN da partida.");
  if (!create && !$("#code").value.trim()) return !showFieldError($("#code"), "Informe o código da sala ou da partida.");
  return true;
}

function render() {
  updateRecoveryCard();
  renderRankings();
  const ps = [...room.state.players.entries()],
    adm = room.state.hostId === me,
    opts = ps
      .filter(([id, p]) => id !== me && p.connected)
      .map(([id, p]) => `<option value="${id}">${p.name}</option>`)
      .join("");
  updateSummaryAndBadges(ps, adm);
  $("#roomName").textContent = room.state.roomName;
  $("#saveCode").textContent =
    `Código permanente da partida: ${room.state.saveCode} • Último salvamento: ${room.state.lastSavedAt ? new Date(room.state.lastSavedAt).toLocaleString("pt-BR") : "agora"}`;
  $("#roomCode").textContent =
    room.roomId +
    (room.state.locked ? " • Entradas bloqueadas" : " • Sala aberta");
  document
    .querySelectorAll(".admin-only")
    .forEach((x) => x.classList.toggle("hidden", !adm));
  $("#lock").textContent = room.state.locked
    ? "Reabrir entradas"
    : "Bloquear entradas";
  $("#players").innerHTML = ps.map(([id, p]) => playerMarkup(id, p, adm)).join("") || emptyState("👥", "Nenhum jogador", "Os jogadores conectados aparecerão aqui.");
  const transferSelect = $("#transferAdminPlayer");
  if (transferSelect) {
    const currentValue = transferSelect.value;
    transferSelect.innerHTML = `<option value="">Selecione um jogador online</option>${ps.filter(([id, player]) => id !== me && player.connected).map(([id, player]) => `<option value="${id}">${player.name}</option>`).join("")}`;
    if ([...transferSelect.options].some((option) => option.value === currentValue)) transferSelect.value = currentValue;
  }
  document
    .querySelectorAll("[data-kick]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          confirm("Expulsar jogador?") &&
          room.send("kick", { id: b.dataset.kick })),
    );
  document
    .querySelectorAll("[data-remove]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          confirm("Remover perfil offline?") &&
          room.send("remove_offline", { id: b.dataset.remove })),
    );
  $("#to").innerHTML = $("#creditor").innerHTML = opts;
  $("#propose").disabled = !opts;
  const p = room.state.players.get(me);
  if (p) assets(p, opts);
  pending(adm);
  debts();
  events();
}
function assets(p, opts) {
  $("#myAssets").innerHTML = p.assets.length
    ? [...p.assets]
        .map(
          (a) =>
            `<div class="asset ${a.mortgaged ? "mortgaged" : ""}"><strong>${a.name}</strong><div>${a.kind === "property" ? (a.development === 5 ? "Condomínio" : a.development + " casas") : "Instituição"}${a.mortgaged ? ` • HIPOTECADA • Valor ${fmt(a.mortgage)}` : ""}</div>${a.mortgaged ? `<div class="small">Construções, ofertas e acordos ficam bloqueados até retirar a hipoteca.</div>` : ""}<div class="row">${a.kind === "property" ? `<button data-dev="${a.id}" data-v="${Math.max(0, a.development - 1)}">−</button><button data-dev="${a.id}" data-v="${Math.min(5, a.development + 1)}">+</button>` : ""}<button data-mort="${a.id}">Hipoteca</button><select data-offer="${a.id}"><option value="">Oferecer...</option>${opts}</select></div></div>`,
        )
        .join("")
    : '<div class="empty">Nenhum patrimônio.</div>';
  document.querySelectorAll("[data-dev]").forEach(
    (b) =>
      (b.onclick = () =>
        room.send("development", {
          id: b.dataset.dev,
          value: Number(b.dataset.v),
        })),
  );
  document
    .querySelectorAll("[data-mort]")
    .forEach(
      (b) => (b.onclick = () => room.send("mortgage", { id: b.dataset.mort })),
    );
  document
    .querySelectorAll("[data-offer]")
    .forEach(
      (s) =>
        (s.onchange = () =>
          s.value &&
          room.send("offer", { assetId: s.dataset.offer, to: s.value })),
    );
  const el = [...p.assets].filter((a) => !a.mortgaged && a.development === 0);
  $("#eligible").innerHTML = el.length
    ? el
        .map(
          (a) =>
            `<label class="asset"><input class="eligible" type="checkbox" value="${a.id}" style="width:auto;min-height:auto"> ${a.name}<div class="small">Elegível para acordo</div></label>`,
        )
        .join("")
    : '<div class="empty">Nenhum item elegível.</div>';
}
function pending(adm) {
  const all = [...room.state.pending.values()],
    vis = all.filter((q) => q.fromId === me || q.toId === me || adm);
  $("#count").textContent = vis.length;
  $("#count").classList.toggle("hidden", !vis.length);
  $("#pending").innerHTML = vis.length
    ? vis
        .map((q) => {
          const can = q.kind === "money" ? q.toId === me : adm;
          return `<div class="pending ${can ? "incoming" : ""}"><strong>${q.fromName}</strong> • ${q.kind}<div>${q.name || fmt(q.amount)} • ${q.reason}</div><div class="row">${can ? `<button data-y="${q.id}">Aprovar</button><button data-n="${q.id}">Recusar</button>` : `<button data-c="${q.id}">Cancelar</button>`}</div></div>`;
        })
        .join("")
    : '<div class="empty">Nenhuma aprovação.</div>';
  document
    .querySelectorAll("[data-y]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          room.send("respond", { id: b.dataset.y, accept: true })),
    );
  document
    .querySelectorAll("[data-n]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          room.send("respond", { id: b.dataset.n, accept: false })),
    );
  document
    .querySelectorAll("[data-c]")
    .forEach(
      (b) => (b.onclick = () => room.send("cancel", { id: b.dataset.c })),
    );
}
function debts() {
  const ds = [...room.state.debts.values()].filter(
    (d) => d.debtorId === me || d.creditorId === me,
  );
  $("#debtList").innerHTML = ds.length
    ? ds
        .map(
          (d) =>
            `<div class="pending ${d.creditorId === me ? "incoming" : ""}"><strong>${d.creditorId === me ? "AÇÃO NECESSÁRIA" : "AGUARDANDO"}</strong><div>Dívida ${fmt(d.originalAmount)} • Dinheiro ${fmt(d.cashOffered)}</div><div class="row">${d.creditorId === me ? `<button data-dy="${d.id}">Aceitar</button><button data-dn="${d.id}">Recusar</button>` : `<button data-dc="${d.id}">Cancelar</button>`}</div></div>`,
        )
        .join("")
    : emptyState("🤝", "Nenhuma proposta de dívida", "Novos acordos aparecerão aqui.");
  document
    .querySelectorAll("[data-dy]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          room.send("respond_debt", { id: b.dataset.dy, accept: true })),
    );
  document
    .querySelectorAll("[data-dn]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          room.send("respond_debt", { id: b.dataset.dn, accept: false })),
    );
  document
    .querySelectorAll("[data-dc]")
    .forEach(
      (b) => (b.onclick = () => room.send("cancel_debt", { id: b.dataset.dc })),
    );
}
function events() {
  const query = $("#search").value.toLocaleLowerCase("pt-BR");
  const filtered = [...room.state.events].reverse().slice(0, lowPowerDevice ? 40 : 100).filter((event) => !query || event.message.toLocaleLowerCase("pt-BR").includes(query));
  $("#events").innerHTML = filtered.length ? filtered.map((event) => {
    const [type, label] = eventCategory(event.message);
    return `<div class="event" data-event-type="${type}"><span class="event-kind">${label}</span><strong>#${String(event.seq).padStart(3, "0")}</strong> ${event.message}<div class="small">${new Date(event.at).toLocaleTimeString("pt-BR")}</div></div>`;
  }).join("") : emptyState("🔍", "Nenhum evento encontrado", "Tente buscar por outra palavra.");
}
function calculatePlayerRanking(player) {
  const assets = [...player.assets];
  const propertyCount = assets.filter((asset) => asset.kind === "property").length;
  const organizationCount = assets.filter((asset) => asset.kind === "organization").length;
  const assetValue = assets.reduce((sum, asset) => {
    const purchase = Number(asset.purchase || 0);
    if (asset.kind !== "property") return sum + purchase;
    return sum + purchase + (asset.mortgaged ? 0 : propertyDevelopmentCost(asset, asset.development));
  }, 0);
  return {
    money: Number(player.balance || 0),
    general: Number(player.balance || 0) + assetValue,
    assetCount: assets.length,
    propertyCount,
    organizationCount,
  };
}
function rankingMarkup(players, value, detail) {
  return players
    .map(({ id, player, metrics }, index) =>
      `<li class="ranking-item ${id === me ? "me" : ""}"><span class="rank-position">${index + 1}º</span><span>${player.name}${id === me ? " (você)" : ""}${player.bankrupt ? " • 🔒 Falido" : ""}<small class="small">${detail(metrics)}</small></span><strong>${value(metrics)}</strong></li>`)
    .join("");
}
function renderRankings() {
  if (!room?.state?.players) return;
  const players = [...room.state.players.entries()].map(([id, player]) => ({
    id, player, metrics: calculatePlayerRanking(player),
  }));
  const general = [...players].sort((a, b) => b.metrics.general - a.metrics.general || a.player.name.localeCompare(b.player.name, "pt-BR"));
  const money = [...players].sort((a, b) => b.metrics.money - a.metrics.money || a.player.name.localeCompare(b.player.name, "pt-BR"));
  const assets = [...players].sort((a, b) => b.metrics.assetCount - a.metrics.assetCount || b.metrics.general - a.metrics.general || a.player.name.localeCompare(b.player.name, "pt-BR"));
  const generalBox = $("#rankGeneral"), moneyBox = $("#rankMoney"), assetsBox = $("#rankAssets");
  if (generalBox) generalBox.innerHTML = rankingMarkup(general, (m) => fmt(m.general), (m) => `<br>Saldo + bens e construções`);
  if (moneyBox) moneyBox.innerHTML = rankingMarkup(money, (m) => fmt(m.money), () => `<br>Saldo disponível`);
  if (assetsBox) assetsBox.innerHTML = rankingMarkup(assets, (m) => String(m.assetCount), (m) => `<br>${m.propertyCount} propriedades • ${m.organizationCount} organizações`);
}

function propertyDevelopmentCost(property, development) {
  const level = Math.max(0, Math.min(5, Number(development) || 0));
  return level === 5
    ? 4 * Number(property.houseCost || 0) + Number(property.condominiumCost || 0)
    : level * Number(property.houseCost || 0);
}
function showCatalog() {
  const p = P($("#prop").value),
    o = O($("#org").value),
    development = Number($("#dev").value || 0),
    construction = propertyDevelopmentCost(p, development),
    total = Number(p.purchase || 0) + construction,
    currentPlayer = room?.state?.players?.get(me),
    balanceAfter = currentPlayer ? Number(currentPlayer.balance) - total : null;
  $("#propInfo").innerHTML =
    `Compra ${fmt(p.purchase)} • Casa ${fmt(p.houseCost)} • Condomínio ${fmt(p.condominiumCost)} • Hipoteca ${fmt(p.mortgage)}`;
  $("#propEstimate").innerHTML =
    `<strong>Total previsto: ${fmt(total)}</strong><div>Propriedade ${fmt(p.purchase)} + construções ${fmt(construction)}</div>${balanceAfter === null ? "" : `<div>Seu saldo após aprovação: ${fmt(balanceAfter)}</div>`}`;
  $("#orgInfo").innerHTML =
    `Compra ${fmt(o.purchase)} • Dados × ${fmt(o.multiplier)} • Hipoteca ${fmt(o.mortgage)}`;
}
function calcRules() {
  const p = P($("#rentProp").value),
    v = p.rent[Number($("#rentDev").value)];
  $("#rentResult").textContent = `Aluguel sugerido: ${fmt(v)}`;
  $("#fmiResult").textContent =
    `${$("#diceSum").value} × 2.000 = ${fmt(Number($("#diceSum").value) * 2000)}`;
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
function download(x) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([x], { type: "application/json" }));
  a.download = "Banco-Mundo-0.3.3.json";
  a.click();
}
$("#create").onclick = () => connect(true);
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
$("#pause").onclick = () =>
  confirm("Pausar e salvar a partida para continuar outro dia?") &&
  room.send("pause_room");
$("#backup").onclick = () =>
  window.open(`${apiBase}/api/saves/${room.state.saveCode}`, "_blank");
$("#report").onclick = () => room.send("report");
$("#end").onclick = () => $("#endModal").classList.remove("hidden");
$("#endBack").onclick = () => $("#endModal").classList.add("hidden");
$("#endConfirm").onclick = () => room.send("end_room");
$("#buyProp").onclick = () => {
  const p = P($("#prop").value);
  room.send("asset", {
    kind: "property",
    catalogId: p.id,
    name: p.name,
    development: Number($("#dev").value),
    purchase: p.purchase,
    houseCost: p.houseCost,
    condominiumCost: p.condominiumCost,
    mortgageValue: p.mortgage,
    reason: $("#propReason").value,
  });
};
$("#buyOrg").onclick = () => {
  const o = O($("#org").value);
  room.send("asset", {
    kind: "organization",
    catalogId: o.id,
    name: o.name,
    purchase: o.purchase,
    mortgageValue: o.mortgage,
    reason: $("#orgReason").value,
  });
};
$("#send").onclick = () =>
  room.send("money", {
    to: $("#to").value,
    amount: Number($("#amount").value),
    reason: $("#reason").value,
  });
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
$("#propose").onclick = () =>
  room.send("debt", {
    creditorId: $("#creditor").value,
    originalAmount: Number($("#debtAmount").value),
    cashOffered: Number($("#cash").value),
    assetIds: [...document.querySelectorAll(".eligible:checked")].map(
      (x) => x.value,
    ),
    note: $("#note").value,
  });
$("#prop").onchange = showCatalog;
$("#dev").onchange = showCatalog;
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
const manualTopics = [
  ["Criar e entrar", "Crie uma sala com nome, saldo e PIN. Para entrar, use o código temporário ou permanente e o mesmo PIN."],
  ["Códigos", "O código temporário identifica a sala ativa. O permanente restaura a partida. O código pessoal recupera somente o seu perfil em outro aparelho."],
  ["ADM", "O ADM aprova banco, patrimônio e falência. O ADM permanece responsável quando offline e pode transferir a administração para outro jogador online."],
  ["Dinheiro e banco", "Pagamentos exigem saldo e aprovação do destinatário. Operações com o banco exigem aprovação do ADM."],
  ["Propriedades e instituições", "Cada item possui um único proprietário. Solicitações duplicadas são bloqueadas."],
  ["Casas e condomínio", "Compre um nível por vez pelo valor oficial. Ao vender, receba 50% do valor oficial. Propriedade hipotecada não aceita construções."],
  ["Aluguel e FMI", "Use as calculadoras da aba Regras. O valor do FMI é a soma dos dados multiplicada por 2.000, conforme restituição ou dívida."],
  ["Hipoteca", "Venda todas as construções antes de hipotecar. Um patrimônio hipotecado não pode receber construções, ser oferecido ou integrar acordo de dívida."],
  ["Dívidas", "O devedor pode oferecer dinheiro e patrimônios elegíveis. O credor aceita ou recusa. Itens hipotecados ou com construções não são elegíveis."],
  ["Falência", "Solicite falência para aprovação do ADM. Construções são liquidadas por 50%, pendências são canceladas e patrimônios retornam ao banco. O perfil falido vira espectador. O ADM pode desfazer usando o retrato anterior."],
  ["Salvar e backup", "Pausar e salvar grava o estado. Baixe o backup JSON e guarde em local privado. Ao importar, um novo código permanente é gerado."],
  ["Segurança", "Não compartilhe PIN e código pessoal publicamente. Cada jogador deve guardar o próprio código pessoal."],
  ["Solução de problemas", "Use navegador normal ou APK para preservar o perfil. Em aparelho novo, informe o código pessoal. Se a versão parecer antiga, recarregue o site."],
];
function renderManual() {
  const term = $("#manualSearch").value.trim().toLocaleLowerCase("pt-BR");
  const topics = manualTopics.filter(([title, text]) => !term || `${title} ${text}`.toLocaleLowerCase("pt-BR").includes(term));
  $("#manualContent").innerHTML = topics.length ? topics.map(([title, text], index) => `<details class="manual-topic" ${term || index === 0 ? "open" : ""}><summary>${title}</summary><p>${text}</p></details>`).join("") : emptyState("📖", "Nenhum assunto encontrado", "Tente buscar por outro termo.");
}
init();
renderManual();

$("#manualSearch").oninput = renderManual;
$("#requestBankruptcy").onclick = () => confirm("Solicitar falência ao ADM? As operações serão bloqueadas após aprovação.") && room.send("request_bankruptcy");
document.addEventListener("click", (event) => {
  const declareButton = event.target.closest("[data-declare-bankrupt]");
  if (declareButton && confirm("Declarar falência? Construções serão liquidadas por 50%, patrimônios voltarão ao banco e o perfil ficará bloqueado.")) {
    if (confirm("Confirma definitivamente a falência deste jogador?")) room.send("declare_bankruptcy", { playerId: declareButton.dataset.declareBankrupt });
  }
  const restoreButton = event.target.closest("[data-restore-bankrupt]");
  if (restoreButton && confirm("Restaurar o retrato anterior à falência?")) room.send("restore_bankruptcy", { playerId: restoreButton.dataset.restoreBankrupt });
});

$("#toggleRecovery").onclick = () => {
  const visible = $("#myRecoveryCode").dataset.visible === "true";
  updateRecoveryCard(!visible);
};
$("#copyRecovery").onclick = copyRecoveryCode;
$("#shareRecovery").onclick = shareRecoveryCode;
$("#transferAdmin").onclick = () => {
  const playerId = $("#transferAdminPlayer").value;
  if (!playerId) return toast("Selecione um jogador online.");
  room.send("transfer_admin", { playerId });
};
$("#importBackup").onclick = async () => {
  const f = $("#importFile").files?.[0];
  if (!f) return toast("Selecione um backup JSON.");
  try {
    const raw = JSON.parse(await f.text());
    const r = await fetch(`${apiBase}/api/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(raw),
    });
    const x = await r.json();
    if (!r.ok) throw Error(x.error);
    $("#code").value = x.saveCode;
    const result = $("#importResult");
    result.classList.remove("hidden");
    result.innerHTML = `<strong>Backup importado com sucesso.</strong><div>Código da nova partida: <b>${x.saveCode}</b></div><div class="small">Informe o nome e o PIN original, depois selecione Entrar.</div>`;
    toast(`Backup importado com código ${x.saveCode}`);
  } catch (e) {
    toast(e.message);
  }
};

// PWA: instalação, conectividade e atualização segura da interface.
let deferredInstallPrompt = null;
let waitingServiceWorker = null;

function updateConnectionUI() {
  const offline = !navigator.onLine;
  const banner = document.querySelector("#offlineBanner");
  if (banner) banner.classList.toggle("hidden", !offline);
  document.documentElement.dataset.online = offline ? "false" : "true";
}

window.addEventListener("online", () => {
  updateConnectionUI();
  if (typeof toast === "function") toast("Conexão restaurada.");
});
window.addEventListener("offline", updateConnectionUI);
updateConnectionUI();

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  document.querySelector("#installApp")?.classList.remove("hidden");
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  document.querySelector("#installApp")?.classList.add("hidden");
  if (typeof toast === "function") toast("Banco Mundo instalado.");
});

document.querySelector("#installApp")?.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    if (typeof toast === "function") toast("Use 'Adicionar à tela inicial' no menu do navegador.");
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.querySelector("#installApp")?.classList.add("hidden");
});

document.querySelector("#updateApp")?.addEventListener("click", () => {
  if (waitingServiceWorker) {
    waitingServiceWorker.postMessage({ type: "SKIP_WAITING" });
  } else {
    location.reload();
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const showUpdate = (worker) => {
        waitingServiceWorker = worker;
        document.querySelector("#updateCard")?.classList.remove("hidden");
      };
      if (registration.waiting) showUpdate(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdate(worker);
        });
      });
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        location.reload();
      });
    } catch (error) {
      console.warn("Não foi possível registrar a PWA.", error);
    }
  });
}

// Sem servidor, ações que mudariam a partida são bloqueadas; navegação e manual continuam disponíveis.
document.addEventListener("click", (event) => {
  if (navigator.onLine) return;
  const button = event.target.closest("button");
  if (!button) return;
  const allowed = button.matches(".tab, #theme, #installApp, #updateApp");
  if (allowed) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (typeof toast === "function") toast("Operação indisponível sem conexão com o servidor.");
}, true);


document.querySelector(".tabs")?.addEventListener("click", () => {
  requestAnimationFrame(() => document.querySelectorAll(".tab").forEach((tab) => {
    tab.setAttribute("aria-selected", String(tab.classList.contains("active")));
  }));
});


const moreTabButton = document.querySelector("#moreTab");
const moreMenu = document.querySelector("#moreMenu");
moreTabButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  const open = moreMenu.classList.toggle("hidden") === false;
  moreTabButton.setAttribute("aria-expanded", String(open));
});
moreMenu?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-jump-tab]");
  if (!button) return;
  document.querySelector(`.tab[data-tab="${button.dataset.jumpTab}"]`)?.click();
  moreMenu.classList.add("hidden");
  moreTabButton?.setAttribute("aria-expanded", "false");
});
document.addEventListener("click", (event) => {
  if (!event.target.closest("#moreMenu,#moreTab")) {
    moreMenu?.classList.add("hidden");
    moreTabButton?.setAttribute("aria-expanded", "false");
  }
});
document.querySelectorAll("input,select,textarea").forEach((control) => {
  control.addEventListener("input", () => clearFieldError(control));
  control.addEventListener("change", () => clearFieldError(control));
});
