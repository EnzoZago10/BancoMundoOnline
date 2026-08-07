import { Client, Room } from "@colyseus/core";
import { Asset, Debt, Event, Pending, Player, State } from "./state.js";
import {
  atomicSave,
  code,
  hash,
  loadSaveWithFallback,
  restore,
} from "./persistence.js";
const t = (v: unknown, n = 120) =>
    String(v ?? "")
      .trim()
      .slice(0, n),
  uid = () => crypto.randomUUID();
export class BankRoom extends Room<{ state: State }> {
  maxClients = 6;
  autoDispose = false;
  private pin = "";
  private pinHash = "";
  private kicked = new Set<string>();
  private saveTimer: any;
  async onCreate(o: { pin?: string; resumeCode?: string }) {
    if (o.resumeCode) {
      const raw = await loadSaveWithFallback(t(o.resumeCode, 30));
      this.pinHash = raw.pinHash || "";
      this.setState(restore(raw));
    } else {
      this.pin = t(o.pin, 8);
      this.pinHash = hash(this.pin);
      const st = new State();
      st.saveCode = code();
      this.setState(st);
      this.saveNow();
    }
    const map: any = {
      money: this.money,
      bank: this.bank,
      asset: this.asset,
      respond: this.respond,
      cancel: this.cancel,
      development: this.development,
      mortgage: this.mortgage,
      offer: this.offer,
      debt: this.debt,
      respond_debt: this.respondDebt,
      cancel_debt: this.cancelDebt,
      start_bonus: this.startBonus,
      fmi: this.fmi,
      kick: this.kick,
      remove_offline: this.removeOffline,
      toggle_lock: this.toggleLock,
      settings: this.settings,
      report: this.report,
      end_room: this.endRoom,
      pause_room: this.pauseRoom,
    };
    for (const [k, f] of Object.entries(map))
      this.onMessage(k, (c, d) => {
        (f as any).call(this, c, d);
        this.scheduleSave();
      });
    this.setSimulationInterval(() => this.scheduleSave(), 30000);
  }
  onAuth(_c: Client, o: { pin?: string }) {
    if (this.state?.locked) throw Error("Sala bloqueada para novas entradas.");
    if (this.pinHash && hash(t(o.pin, 8)) !== this.pinHash)
      throw Error("PIN incorreto.");
    return true;
  }
  onJoin(
    c: Client,
    o: {
      name?: string;
      initialBalance?: number;
      deviceToken?: string;
      recoveryCode?: string;
    },
  ) {
    if (this.state.ended) throw Error("Sala encerrada.");
    const token = t(o.deviceToken, 80),
      recovery = t(o.recoveryCode, 30);
    const found = [...this.state.players.entries()].find(
      ([, p]) =>
        (token && p.deviceToken === token) ||
        (recovery && p.recoveryCode === recovery),
    );
    if (found) {
      const [oldId, p] = found;
      if (oldId !== c.sessionId) {
        this.state.players.delete(oldId);
        p.id = c.sessionId;
        this.state.players.set(c.sessionId, p);
        for (const q of this.state.pending.values()) {
          if (q.fromId === oldId) q.fromId = c.sessionId;
          if (q.toId === oldId) q.toId = c.sessionId;
        }
        for (const q of this.state.debts.values()) {
          if (q.debtorId === oldId) q.debtorId = c.sessionId;
          if (q.creditorId === oldId) q.creditorId = c.sessionId;
        }
        if (this.state.hostId === oldId) this.state.hostId = c.sessionId;
      }
      p.connected = true;
      this.ev(
        "presence",
        p.name,
        `${p.name} recuperou o perfil salvo.`,
        `info`,
      );
      c.send("profile_recovered", {
        name: p.name,
        recoveryCode: p.recoveryCode,
      });
      this.saveNow();
      return;
    }
    if (this.state.players.size >= this.state.maxPlayers)
      throw Error("Limite oficial de 6 jogadores.");
    const p = new Player();
    p.id = c.sessionId;
    p.deviceToken = token || uid();
    p.recoveryCode = code();
    p.name = t(o.name, 24) || "Jogador";
    p.balance = Math.max(0, Number(o.initialBalance) || 2558000);
    this.state.players.set(p.id, p);
    if (!this.state.hostId) this.state.hostId = p.id;
    this.ev("presence", p.name, `${p.name} entrou na sala.`, `info`);
    c.send("profile_recovered", { name: p.name, recoveryCode: p.recoveryCode });
    this.saveNow();
  }
  async onDrop(c: Client) {
    const p = this.state.players.get(c.sessionId);
    if (p) {
      p.connected = false;
      this.ev(
        "presence",
        p.name,
        `${p.name} perdeu a conexão; vaga reservada por 60 segundos.`,
        `info`,
      );
    }
    await this.allowReconnection(c, 60);
  }
  onReconnect(c: Client) {
    const p = this.state.players.get(c.sessionId);
    if (p) {
      p.connected = true;
      this.ev("presence", p.name, `${p.name} reconectou à sala.`, `info`);
    }
  }
  onLeave(c: Client) {
    const p = this.state.players.get(c.sessionId);
    if (!p) return;
    if (this.kicked.delete(c.sessionId)) {
      this.clearPlayer(c.sessionId);
      this.state.players.delete(c.sessionId);
      this.saveNow();
      return;
    }
    p.connected = false;
    this.ev(
      "presence",
      p.name,
      `${p.name} saiu; perfil preservado para continuação.`,
      `info`,
    );
    if (this.state.hostId === p.id) this.assignAdmin(p.name);
    this.saveNow();
  }
  private me(c: Client) {
    const p = this.state.players.get(c.sessionId);
    if (!p) throw Error("Jogador inválido.");
    return p;
  }
  private adm(c: Client) {
    if (c.sessionId !== this.state.hostId) {
      c.send("error", "Somente o ADM pode realizar esta ação.");
      return false;
    }
    return true;
  }
  private ev(cat: string, actor: string, msg: string, type: string) {
    const e = new Event();
    e.seq = ++this.state.seq;
    e.category = cat;
    e.actor = actor;
    e.message = msg;
    e.type = type;
    e.at = Date.now();
    this.state.events.push(e);
    while (this.state.events.length > 250) this.state.events.shift();
  }
  private assignAdmin(old: string) {
    const n =
      [...this.state.players.values()].find((x) => x.connected) ??
      [...this.state.players.values()][0];
    if (n) {
      this.state.hostId = n.id;
      this.ev(
        "admin",
        n.name,
        `${old} saiu; ${n.name} agora é o ADM.`,
        `settings`,
      );
    } else this.state.hostId = "";
  }
  private clearPlayer(id: string) {
    for (const [k, q] of this.state.pending)
      if (q.fromId === id || q.toId === id) this.state.pending.delete(k);
    for (const [k, q] of this.state.debts)
      if (q.debtorId === id || q.creditorId === id) this.state.debts.delete(k);
  }
  private pend(kind: string, p: Player, to: Player | undefined, d: any) {
    const q = new Pending();
    q.id = uid();
    q.kind = kind;
    q.fromId = p.id;
    q.fromName = p.name;
    q.toId = to?.id ?? this.state.hostId;
    q.toName = to?.name ?? "ADM";
    q.amount = Number(d.amount) || 0;
    q.catalogId = t(d.catalogId, 50);
    q.name = t(d.name, 80);
    q.development = Math.max(0, Math.min(5, Number(d.development) || 0));
    q.mortgaged = !!d.mortgaged;
    q.purchase = Math.max(0, Number(d.purchase) || 0);
    q.houseCost = Math.max(0, Number(d.houseCost) || 0);
    q.condominiumCost = Math.max(0, Number(d.condominiumCost) || 0);
    q.mortgageValue = Math.max(0, Number(d.mortgageValue) || 0);
    q.reason = t(d.reason);
    q.at = Date.now();
    this.state.pending.set(q.id, q);
    return q;
  }
  private money(c: Client, d: any) {
    const p = this.me(c),
      to = this.state.players.get(t(d.to, 50)),
      v = Number(d.amount) || 0;
    if (!to || v <= 0 || p.balance < v)
      return c.send("error", "Pagamento inválido.");
    this.pend("money", p, to, d);
    this.ev(
      "money",
      p.name,
      `${p.name} solicitou pagar ${v.toLocaleString("pt-BR")} a ${to.name}.`,
      `pending`,
    );
  }
  private bank(c: Client, d: any) {
    const p = this.me(c),
      v = Number(d.amount) || 0;
    if (!v || !d.reason) return c.send("error", "Valor e motivo obrigatórios.");
    this.pend("bank", p, this.state.players.get(this.state.hostId), d);
    this.ev(
      "bank",
      p.name,
      `${p.name} solicitou operação de ${v.toLocaleString("pt-BR")} com o banco.`,
      `pending`,
    );
  }
  private asset(c: Client, d: any) {
    const p = this.me(c);
    if (!d.name || !d.reason)
      return c.send("error", "Item e motivo obrigatórios.");
    const q = this.pend(
      "asset",
      p,
      this.state.players.get(this.state.hostId),
      d,
    );
    this.ev(
      d.kind,
      p.name,
      `${p.name} solicitou ${q.name}${d.kind === "property" ? ` com ${q.development === 5 ? "Condomínio" : q.development + " casas"}` : ""}.`,
      `pending`,
    );
  }
  private respond(c: Client, d: any) {
    const u = this.me(c),
      q = this.state.pending.get(t(d.id, 50));
    if (!q) return;
    if (q.kind === "money" && q.toId !== u.id) return;
    if (q.kind !== "money" && !this.adm(c)) return;
    const p = this.state.players.get(q.fromId);
    if (!p) return;
    if (!d.accept) {
      this.ev(
        q.kind,
        u.name,
        `${u.name} recusou solicitação de ${p.name}.`,
        `rejected`,
      );
      this.state.pending.delete(q.id);
      return;
    }
    if (q.kind === "money") {
      if (p.balance < q.amount) return c.send("error", "Saldo insuficiente.");
      p.balance -= q.amount;
      u.balance += q.amount;
      p.sent += q.amount;
      u.received += q.amount;
    } else if (q.kind === "bank") {
      if (p.balance + q.amount < 0)
        return c.send("error", "Saldo insuficiente.");
      p.balance += q.amount;
      p.bankOps++;
    } else {
      const org = /^(ONU|OIT|OMC|OTAN|IPCC|OMS)$/.test(q.name);
      const construction = org
        ? 0
        : q.development === 5
          ? 4 * q.houseCost + q.condominiumCost
          : q.development * q.houseCost;
      const total = q.purchase + construction;
      if (total <= 0 || p.balance < total)
        return c.send(
          "error",
          `Saldo insuficiente ou custo inválido. Total: ${total.toLocaleString("pt-BR")}.`,
        );
      p.balance -= total;
      p.bankOps++;
      const a = new Asset();
      a.id = uid();
      a.catalogId = q.catalogId;
      a.kind = org ? "organization" : "property";
      a.name = q.name;
      a.development = q.development;
      a.mortgaged = q.mortgaged;
      a.purchase = q.purchase;
      a.mortgage = q.mortgageValue;
      p.assets.push(a);
      this.ev(
        org ? "organization" : "property",
        u.name,
        `${u.name} aprovou ${q.name} para ${p.name}; total descontado ${total.toLocaleString("pt-BR")}.`,
        `approved`,
      );
    }
    this.state.pending.delete(q.id);
  }
  private cancel(c: Client, d: any) {
    const p = this.me(c),
      q = this.state.pending.get(t(d.id, 50));
    if (q && q.fromId === p.id) {
      this.state.pending.delete(q.id);
      this.ev(
        q.kind,
        p.name,
        `${p.name} cancelou uma solicitação.`,
        `cancelled`,
      );
    }
  }
  private development(c: Client, d: any) {
    const p = this.me(c),
      a = p.assets.find((x) => x.id === d.id),
      v = Math.max(0, Math.min(5, Number(d.value) || 0));
    if (!a || a.kind !== "property" || a.mortgaged)
      return c.send("error", "Alteração bloqueada.");
    a.development = v;
    this.ev(
      "property",
      p.name,
      `${p.name} alterou ${a.name} para ${v === 5 ? "Condomínio" : v + " casas"}.`,
      `item`,
    );
  }
  private mortgage(c: Client, d: any) {
    const p = this.me(c),
      a = p.assets.find((x) => x.id === d.id);
    if (!a || a.development > 0)
      return c.send("error", "Venda construções antes de hipotecar.");
    a.mortgaged = !a.mortgaged;
    this.ev(
      "asset",
      p.name,
      `${p.name} ${a.mortgaged ? "hipotecou" : "retirou a hipoteca de"} ${a.name}.`,
      `item`,
    );
  }
  private offer(c: Client, d: any) {
    const p = this.me(c),
      to = this.state.players.get(t(d.to, 50)),
      a = p.assets.find((x) => x.id === d.assetId);
    if (!to || !a || a.mortgaged || a.development > 0)
      return c.send("error", "Somente item sem construção e não hipotecado.");
    const q = this.pend("offer", p, to, { name: a.name, reason: "oferta" });
    q.catalogId = a.id;
    this.ev(
      "asset",
      p.name,
      `${p.name} ofereceu ${a.name} para ${to.name}.`,
      `pending`,
    );
  }
  private debt(c: Client, d: any) {
    const p = this.me(c),
      to = this.state.players.get(t(d.creditorId, 50)),
      cash = Math.max(0, Number(d.cashOffered) || 0),
      ids = Array.isArray(d.assetIds)
        ? d.assetIds.map((x: any) => t(x, 50))
        : [];
    if (!to || to.id === p.id || cash > p.balance)
      return c.send("error", "Acordo inválido.");
    const items: (Asset | undefined)[] = ids.map((x: string) =>
      p.assets.find((a: Asset) => a.id === x),
    );
    if (items.some((a) => !a || a.mortgaged || a.development > 0))
      return c.send("error", "Item ausente, hipotecado ou com construção.");
    for (const x of this.state.debts.values())
      if ([...x.assetIds].some((i) => ids.includes(i)))
        return c.send("error", "Item já usado em outro acordo.");
    const q = new Debt();
    q.id = uid();
    q.debtorId = p.id;
    q.debtorName = p.name;
    q.creditorId = to.id;
    q.creditorName = to.name;
    q.originalAmount = Math.max(1, Number(d.originalAmount) || 0);
    q.cashOffered = cash;
    q.note = t(d.note);
    q.at = Date.now();
    ids.forEach((x: string) => q.assetIds.push(x));
    this.state.debts.set(q.id, q);
    this.ev(
      "debt",
      p.name,
      `${p.name} propôs acordo para dívida de ${q.originalAmount.toLocaleString("pt-BR")}.`,
      `pending`,
    );
  }
  private respondDebt(c: Client, d: any) {
    const to = this.me(c),
      q = this.state.debts.get(t(d.id, 50));
    if (!q || q.creditorId !== to.id) return;
    const from = this.state.players.get(q.debtorId);
    if (!from) return;
    if (!d.accept) {
      this.state.debts.delete(q.id);
      this.ev(
        "debt",
        to.name,
        `${to.name} recusou acordo de ${from.name}.`,
        `rejected`,
      );
      return;
    }
    if (from.balance < q.cashOffered)
      return c.send("error", "Dinheiro indisponível.");
    const items = [...q.assetIds].map((id) =>
      from.assets.find((a) => a.id === id),
    );
    if (items.some((a) => !a || a.mortgaged || a.development > 0))
      return c.send("error", "Acordo alterado; nada foi transferido.");
    from.balance -= q.cashOffered;
    to.balance += q.cashOffered;
    for (const a of items as Asset[]) {
      const i = from.assets.findIndex((x) => x.id === a.id);
      from.assets.splice(i, 1);
      to.assets.push(a);
    }
    this.state.debts.delete(q.id);
    this.ev(
      "debt",
      to.name,
      `${to.name} aceitou acordo de ${from.name}; dívida encerrada.`,
      `approved`,
    );
  }
  private cancelDebt(c: Client, d: any) {
    const p = this.me(c),
      q = this.state.debts.get(t(d.id, 50));
    if (q && q.debtorId === p.id) {
      this.state.debts.delete(q.id);
      this.ev("debt", p.name, `${p.name} cancelou acordo.`, `cancelled`);
    }
  }
  private startBonus(c: Client) {
    const p = this.me(c);
    this.pend("bank", p, this.state.players.get(this.state.hostId), {
      amount: 200000,
      reason: "Passagem pelo Início",
    });
  }
  private fmi(c: Client, d: any) {
    const p = this.me(c),
      sum = Math.max(2, Math.min(12, Number(d.sum) || 2)),
      value = sum * 2000 * (d.kind === "debt" ? -1 : 1);
    this.pend("bank", p, this.state.players.get(this.state.hostId), {
      amount: value,
      reason: `FMI ${sum} × 2.000`,
    });
  }
  private kick(c: Client, d: any) {
    if (!this.adm(c)) return;
    const id = t(d.id, 50),
      p = this.state.players.get(id),
      x = this.clients.find((v) => v.sessionId === id);
    if (!p || !x || id === c.sessionId)
      return c.send("error", "Jogador inválido.");
    this.ev(
      "admin",
      this.me(c).name,
      `${this.me(c).name} expulsou ${p.name}.`,
      `settings`,
    );
    this.kicked.add(id);
    x.send("kicked", "Você foi expulso da sala pelo ADM.");
    x.leave(4000);
  }
  private removeOffline(c: Client, d: any) {
    if (!this.adm(c)) return;
    const id = t(d.id, 50),
      p = this.state.players.get(id);
    if (!p || p.connected)
      return c.send("error", "O jogador não está offline.");
    this.clearPlayer(id);
    this.state.players.delete(id);
    this.ev(
      "admin",
      this.me(c).name,
      `${this.me(c).name} removeu ${p.name}, que estava offline.`,
      `settings`,
    );
  }
  private toggleLock(c: Client) {
    if (!this.adm(c)) return;
    this.state.locked = !this.state.locked;
    if (this.state.locked) this.lock();
    else this.unlock();
    this.ev(
      "admin",
      this.me(c).name,
      this.state.locked ? "Entradas bloqueadas." : "Entradas reabertas.",
      "settings",
    );
  }
  private settings(c: Client, d: any) {
    if (!this.adm(c)) return;
    this.state.roomName = t(d.name, 50) || this.state.roomName;
    this.ev(
      "admin",
      this.me(c).name,
      "Nome da partida atualizado.",
      "settings",
    );
  }
  private report(c: Client) {
    if (!this.adm(c)) return;
    c.send(
      "report",
      JSON.stringify(
        { version: "0.3.3", roomId: this.roomId, state: this.state },
        null,
        2,
      ),
    );
  }
  private endRoom(c: Client) {
    if (!this.adm(c)) return;
    this.state.ended = true;
    this.state.locked = true;
    this.lock();
    this.state.pending.clear();
    this.state.debts.clear();
    this.ev(
      "admin",
      this.me(c).name,
      `${this.me(c).name} encerrou a sala.`,
      `settings`,
    );
    this.broadcast("room_ended", "A sala foi encerrada pelo ADM.");
    setTimeout(() => this.disconnect(4001), 700);
  }
  private scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), 250);
  }
  private saveNow() {
    try {
      atomicSave(this.state, this.pinHash);
    } catch (e) {
      console.error("Falha ao salvar", e);
    }
  }
  private pauseRoom(c: Client) {
    if (!this.adm(c)) return;
    this.state.paused = true;
    this.ev(
      "admin",
      this.me(c).name,
      `${this.me(c).name} pausou e salvou a partida.`,
      `settings`,
    );
    this.saveNow();
    this.broadcast("room_paused", {
      saveCode: this.state.saveCode,
      message: "Partida pausada e salva.",
    });
  }
}
