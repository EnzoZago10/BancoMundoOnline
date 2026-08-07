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
  recoveryCode = "";
const recentKey = "bm-recent-033",
  sessionKey = "bm-session-033",
  fmt = (n) => Number(n).toLocaleString("pt-BR"),
  P = (id) => catalog.properties.find((x) => x.id === id),
  O = (id) => catalog.organizations.find((x) => x.id === id),
  toast = (m) => {
    $("#toast").textContent = m;
    $("#toast").style.display = "block";
    setTimeout(() => ($("#toast").style.display = "none"), 1900);
  };
function init() {
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
async function connect(create, override) {
  try {
    const wsUrl = isLocal
      ? `ws://${location.hostname}:2567`
      : "wss://bancomundoonline.onrender.com";
    ``;
    const client = new Client(wsUrl),
      data = override || {
        name: $("#name").value,
        initialBalance: Number($("#balance").value),
        pin: (pin = $("#pin").value),
        deviceToken:
          localStorage.deviceToken ||
          (localStorage.deviceToken = crypto.randomUUID()),
        recoveryCode,
      };
    if (override?.resumeCode) room = await client.create("bank_room", data);
    else
      room = create
        ? await client.create("bank_room", data)
        : await client.joinById(override?.roomId || $("#code").value, data);
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
    $("#savedCard").classList.add("hidden");
    $("#returnCard").classList.add("hidden");
    $("#game").classList.remove("hidden");
    bind();
  } catch (e) {
    toast(e.message);
  }
}
function bind() {
  const c = Callbacks.get(room);
  c.onAdd("players", (p) => {
    c.listen(p, "balance", render);
    c.listen(p, "connected", render);
    c.onAdd(p, "assets", render);
    c.onRemove(p, "assets", render);
    render();
  });
  c.onRemove("players", render);
  c.onAdd("pending", render);
  c.onRemove("pending", render);
  c.onAdd("debts", render);
  c.onRemove("debts", render);
  c.onAdd("events", render);
  c.listen(room.state, "hostId", render);
  c.listen(room.state, "locked", render);
  room.onMessage("error", toast);
  room.onMessage("profile_recovered", (d) => {
    recoveryCode = d.recoveryCode;
    const s = JSON.parse(localStorage.getItem(sessionKey) || "{}");
    s.recoveryCode = recoveryCode;
    s.saveCode = room.state.saveCode;
    localStorage.setItem(sessionKey, JSON.stringify(s));
    toast(`Perfil protegido. Código pessoal: ${recoveryCode}`);
  });
  room.onMessage("room_paused", (d) => {
    toast(d.message);
    loadSaves();
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
  render();
}
function render() {
  const ps = [...room.state.players.entries()],
    adm = room.state.hostId === me,
    opts = ps
      .filter(([id, p]) => id !== me && p.connected)
      .map(([id, p]) => `<option value="${id}">${p.name}</option>`)
      .join("");
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
  $("#players").innerHTML = ps
    .map(
      ([id, p]) =>
        `<div class="player"><strong>${p.name}${id === me ? " (você)" : ""}${id === room.state.hostId ? " 👑 ADM" : ""}</strong> • ${fmt(p.balance)}<div class="small">${p.connected ? "🟢 Online" : "⚪ Offline"} • Enviado ${fmt(p.sent)} • Recebido ${fmt(p.received)}</div>${adm && id !== me ? (p.connected ? `<button class="danger" data-kick="${id}">Expulsar</button>` : `<button class="danger" data-remove="${id}">Remover offline</button>`) : ""}</div>`,
    )
    .join("");
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
            `<div class="asset"><strong>${a.name}</strong><div>${a.kind === "property" ? (a.development === 5 ? "Condomínio" : a.development + " casas") : "Instituição"}${a.mortgaged ? " • HIPOTECADO" : ""}</div><div class="row">${a.kind === "property" ? `<button data-dev="${a.id}" data-v="${Math.max(0, a.development - 1)}">−</button><button data-dev="${a.id}" data-v="${Math.min(5, a.development + 1)}">+</button>` : ""}<button data-mort="${a.id}">Hipoteca</button><select data-offer="${a.id}"><option value="">Oferecer...</option>${opts}</select></div></div>`,
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
    : '<div class="empty">Nenhum acordo.</div>';
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
  const q = $("#search").value.toLowerCase();
  $("#events").innerHTML = [...room.state.events]
    .reverse()
    .filter((e) => !q || e.message.toLowerCase().includes(q))
    .map(
      (e) =>
        `<div class="event"><strong>#${String(e.seq).padStart(3, "0")}</strong> ${e.message}<div class="small">${new Date(e.at).toLocaleTimeString("pt-BR")}</div></div>`,
    )
    .join("");
}
function showCatalog() {
  const p = P($("#prop").value),
    o = O($("#org").value);
  $("#propInfo").innerHTML =
    `Compra ${fmt(p.purchase)} • Casa ${fmt(p.houseCost)} • Hipoteca ${fmt(p.mortgage)}`;
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
loadSaves();
init();

async function loadSaves() {
  try {
    const list = await fetch(`${apiBase}/api/saves`).then((r) => r.json());
    $("#savedGames").innerHTML = list.length
      ? list
          .map(
            (x) =>
              `<div class="player"><strong>${x.roomName}</strong><div>Código permanente: ${x.saveCode}</div><div class="small">${x.players} perfis • Salvo em ${x.lastSavedAt ? new Date(x.lastSavedAt).toLocaleString("pt-BR") : "sem data"}</div><div class="row"><button data-resume="${x.saveCode}">Continuar partida</button><button data-download="${x.saveCode}">Baixar backup</button></div></div>`,
          )
          .join("")
      : "Nenhuma partida salva.";
    document.querySelectorAll("[data-resume]").forEach(
      (b) =>
        (b.onclick = () => {
          const s = JSON.parse(
            localStorage.getItem(sessionKey) ||
              localStorage.getItem(recentKey) ||
              "{}",
          );
          const name =
            prompt("Nome do perfil", s.name || "") || s.name || "Jogador";
          const pinValue = prompt("PIN da partida", s.pin || "") ?? "";
          const rec =
            prompt(
              "Código pessoal de recuperação (se estiver em outro navegador)",
              s.recoveryCode || "",
            ) ||
            s.recoveryCode ||
            "";
          pin = pinValue;
          connect(false, {
            resumeCode: b.dataset.resume,
            name,
            pin: pinValue,
            deviceToken:
              localStorage.deviceToken ||
              (localStorage.deviceToken = crypto.randomUUID()),
            recoveryCode: rec,
            initialBalance: 2558000,
          });
        }),
    );
    document
      .querySelectorAll("[data-download]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            window.open(
              `${apiBase}/api/saves/${b.dataset.download}`,
              "_blank",
            )),
      );
  } catch {
    $("#savedGames").textContent =
      "Servidor indisponível ou nenhum salvamento carregado.";
  }
}
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
    toast(`Backup importado com código ${x.saveCode}`);
    loadSaves();
  } catch (e) {
    toast(e.message);
  }
};
