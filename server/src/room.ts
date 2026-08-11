import { Client, Room } from "@colyseus/core";

import { Asset, Debt, Event, Pending, Player, State } from "./state.js";

import {
  atomicSave,
  code,
  hash,
  loadSaveWithFallback,
  restore,
} from "./persistence.js";

const t = (value: unknown, maxLength = 120) =>
  String(value ?? "")
    .trim()
    .slice(0, maxLength);

const uid = () => crypto.randomUUID();

export class BankRoom extends Room<{
  state: State;
}> {
  maxClients = 6;
  autoDispose = false;

  private pin = "";
  private pinHash = "";

  private kicked = new Set<string>();

  private processedRequests = new Set<string>();

  private processingAssets = new Set<string>();

  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  async onCreate(options: { pin?: string; resumeCode?: string }) {
    if (options.resumeCode) {
      const raw = await loadSaveWithFallback(t(options.resumeCode, 30));

      this.pinHash = raw.pinHash || "";

      this.setState(restore(raw));
    } else {
      this.pin = t(options.pin, 8);
      this.pinHash = hash(this.pin);

      const state = new State();

      state.saveCode = code();

      this.setState(state);

      this.saveNow();
    }

    const handlers: Record<string, (client: Client, data: any) => void> = {
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
      transfer_admin: this.transferAdmin,
      request_bankruptcy: this.requestBankruptcy,
      declare_bankruptcy: this.declareBankruptcy,
      restore_bankruptcy: this.restoreBankruptcy,
      settings: this.settings,
      report: this.report,
      end_room: this.endRoom,
      pause_room: this.pauseRoom,
    };

    for (const [message, handler] of Object.entries(handlers)) {
      this.onMessage(message, (client: Client, data: any) => {
        handler.call(this, client, data);

        this.scheduleSave();
      });
    }

    this.setSimulationInterval(() => {
      this.scheduleSave();
    }, 30000);
  }

  onAuth(
    _client: Client,
    options: {
      pin?: string;
    },
  ) {
    if (this.state?.locked) {
      throw Error("Sala bloqueada para novas entradas.");
    }

    if (this.pinHash && hash(t(options.pin, 8)) !== this.pinHash) {
      throw Error("PIN incorreto.");
    }

    return true;
  }

  onJoin(
    client: Client,
    options: {
      name?: string;
      initialBalance?: number;
      deviceToken?: string;
      recoveryCode?: string;
    },
  ) {
    if (this.state.ended) {
      throw Error("Sala encerrada.");
    }

    const deviceToken = t(options.deviceToken, 80);

    const recoveryCode = t(options.recoveryCode, 30);

    const previousProfile = [...this.state.players.entries()].find(
      ([, player]) =>
        (deviceToken && player.deviceToken === deviceToken) ||
        (recoveryCode && player.recoveryCode === recoveryCode),
    );

    if (previousProfile) {
      const [oldSessionId, player] = previousProfile;

      if (oldSessionId !== client.sessionId) {
        this.state.players.delete(oldSessionId);

        player.id = client.sessionId;

        this.state.players.set(client.sessionId, player);

        for (const request of this.state.pending.values()) {
          if (request.fromId === oldSessionId) {
            request.fromId = client.sessionId;
          }

          if (request.toId === oldSessionId) {
            request.toId = client.sessionId;
          }
        }

        for (const agreement of this.state.debts.values()) {
          if (agreement.debtorId === oldSessionId) {
            agreement.debtorId = client.sessionId;
          }

          if (agreement.creditorId === oldSessionId) {
            agreement.creditorId = client.sessionId;
          }
        }

        if (this.state.hostId === oldSessionId) {
          this.state.hostId = client.sessionId;
        }
      }

      player.connected = true;

      this.ev(
        "presence",
        player.name,
        `${player.name} recuperou o perfil salvo.`,
        "info",
      );

      client.send("profile_recovered", {
        name: player.name,
        recoveryCode: player.recoveryCode,
      });

      this.saveNow();

      return;
    }

    if (this.state.players.size >= this.state.maxPlayers) {
      throw Error("Limite oficial de 6 jogadores.");
    }

    const player = new Player();

    player.id = client.sessionId;

    player.deviceToken = deviceToken || uid();

    player.recoveryCode = code();

    player.name = t(options.name, 24) || "Jogador";

    player.balance = Math.max(0, Number(options.initialBalance) || 2558000);

    this.state.players.set(player.id, player);

    if (!this.state.hostId) {
      this.state.hostId = player.id;
    }

    this.ev("presence", player.name, `${player.name} entrou na sala.`, "info");

    client.send("profile_recovered", {
      name: player.name,
      recoveryCode: player.recoveryCode,
    });

    this.saveNow();
  }

  async onDrop(client: Client) {
    const player = this.state.players.get(client.sessionId);

    if (player) {
      player.connected = false;

      this.ev(
        "presence",
        player.name,
        `${player.name} perdeu a conexão; vaga reservada por 60 segundos.`,
        "info",
      );
    }

    await this.allowReconnection(client, 60);
  }

  onReconnect(client: Client) {
    const player = this.state.players.get(client.sessionId);

    if (!player) {
      return;
    }

    player.connected = true;

    this.ev(
      "presence",
      player.name,
      `${player.name} reconectou à sala.`,
      "info",
    );
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);

    if (!player) {
      return;
    }

    if (this.kicked.delete(client.sessionId)) {
      this.clearPlayer(client.sessionId);

      this.state.players.delete(client.sessionId);

      this.saveNow();

      return;
    }

    player.connected = false;

    this.ev(
      "presence",
      player.name,
      `${player.name} saiu; perfil preservado para continuação.`,
      "info",
    );

    this.saveNow();
  }

  private me(client: Client) {
    const player = this.state.players.get(client.sessionId);

    if (!player) {
      throw Error("Jogador inválido.");
    }

    return player;
  }

  private activePlayer(client: Client) {
    const player = this.me(client);
    if (player.bankrupt) {
      client.send("error", "Perfil falido: operações financeiras e patrimoniais estão bloqueadas.");
      return undefined;
    }
    return player;
  }

  private adm(client: Client) {
    if (client.sessionId !== this.state.hostId) {
      client.send("error", "Somente o ADM pode realizar esta ação.");

      return false;
    }

    return true;
  }

  private ev(category: string, actor: string, message: string, type: string) {
    const event = new Event();

    event.seq = ++this.state.seq;

    event.category = category;
    event.actor = actor;
    event.message = message;
    event.type = type;
    event.at = Date.now();

    this.state.events.push(event);

    while (this.state.events.length > 250) {
      this.state.events.shift();
    }
  }

  private clearPlayer(playerId: string) {
    for (const [requestId, request] of this.state.pending) {
      if (request.fromId === playerId || request.toId === playerId) {
        this.state.pending.delete(requestId);
      }
    }

    for (const [agreementId, agreement] of this.state.debts) {
      if (
        agreement.debtorId === playerId ||
        agreement.creditorId === playerId
      ) {
        this.state.debts.delete(agreementId);
      }
    }
  }

  private pend(
    kind: string,
    player: Player,
    destination: Player | undefined,
    data: any,
  ) {
    const request = new Pending();

    request.id = uid();
    request.kind = kind;

    request.fromId = player.id;
    request.fromName = player.name;

    request.toId = destination?.id ?? this.state.hostId;

    request.toName = destination?.name ?? "ADM";

    request.amount = Number(data.amount) || 0;

    request.catalogId = t(data.catalogId, 50);

    request.name = t(data.name, 80);

    request.development = Math.max(
      0,
      Math.min(5, Number(data.development) || 0),
    );

    request.mortgaged = !!data.mortgaged;

    request.purchase = Math.max(0, Number(data.purchase) || 0);

    request.houseCost = Math.max(0, Number(data.houseCost) || 0);

    request.condominiumCost = Math.max(0, Number(data.condominiumCost) || 0);

    request.mortgageValue = Math.max(0, Number(data.mortgageValue) || 0);

    request.reason = t(data.reason);

    request.at = Date.now();

    this.state.pending.set(request.id, request);

    return request;
  }

  private findCatalogOwner(catalogId: string) {
    if (!catalogId) {
      return undefined;
    }

    for (const player of this.state.players.values()) {
      const asset = player.assets.find((item) => item.catalogId === catalogId);

      if (asset) {
        return player;
      }
    }

    return undefined;
  }

  private hasPendingCatalogRequest(catalogId: string) {
    if (!catalogId) {
      return false;
    }

    for (const request of this.state.pending.values()) {
      if (request.kind === "asset" && request.catalogId === catalogId) {
        return true;
      }
    }

    return false;
  }

  private money(client: Client, data: any) {
    const player = this.activePlayer(client);

    if (!player) return;

    const destination = this.state.players.get(t(data.to, 50));

    const amount = Number(data.amount) || 0;

    if (!destination || destination.bankrupt || amount <= 0 || player.balance < amount) {
      return client.send("error", "Pagamento inválido.");
    }

    this.pend("money", player, destination, data);

    this.ev(
      "money",
      player.name,
      `${player.name} solicitou pagar ${amount.toLocaleString("pt-BR")} a ${destination.name}.`,
      "pending",
    );
  }

  private bank(client: Client, data: any) {
    const player = this.activePlayer(client);

    if (!player) return;

    const amount = Number(data.amount) || 0;

    if (!amount || !data.reason) {
      return client.send("error", "Valor e motivo obrigatórios.");
    }

    this.pend("bank", player, this.state.players.get(this.state.hostId), data);

    this.ev(
      "bank",
      player.name,
      `${player.name} solicitou operação de ${amount.toLocaleString("pt-BR")} com o banco.`,
      "pending",
    );
  }

  private asset(client: Client, data: any) {
    const player = this.activePlayer(client);

    if (!player) return;

    const catalogId = t(data.catalogId, 50);

    const itemName = t(data.name, 80);

    if (!catalogId || !itemName || !data.reason) {
      return client.send(
        "error",
        "Item, identificador e motivo são obrigatórios.",
      );
    }

    const currentOwner = this.findCatalogOwner(catalogId);

    if (currentOwner) {
      return client.send(
        "error",
        `${itemName} já pertence a ${currentOwner.name}.`,
      );
    }

    if (this.hasPendingCatalogRequest(catalogId)) {
      return client.send(
        "error",
        `${itemName} já possui uma solicitação de compra pendente.`,
      );
    }

    const request = this.pend(
      "asset",
      player,
      this.state.players.get(this.state.hostId),
      data,
    );

    this.ev(
      data.kind,
      player.name,
      `${player.name} solicitou ${request.name}${
        data.kind === "property"
          ? ` com ${
              request.development === 5
                ? "Condomínio"
                : request.development + " casas"
            }`
          : ""
      }.`,
      "pending",
    );
  }

  private respond(client: Client, data: any) {
    const responder = this.me(client);

    const requestId = t(data.id, 50);

    if (!requestId || this.processedRequests.has(requestId)) {
      return;
    }

    const request = this.state.pending.get(requestId);

    if (!request) {
      return;
    }

    if (request.kind === "money" && request.toId !== responder.id) {
      return;
    }

    if (request.kind !== "money" && !this.adm(client)) {
      return;
    }

    const player = this.state.players.get(request.fromId);

    if (!player) {
      this.state.pending.delete(request.id);

      return;
    }

    this.processedRequests.add(request.id);

    this.state.pending.delete(request.id);

    if (!data.accept) {
      this.ev(
        request.kind,
        responder.name,
        `${responder.name} recusou solicitação de ${player.name}.`,
        "rejected",
      );

      return;
    }

    if (request.kind === "bankruptcy") {
      return this.applyBankruptcy(client, player);
    }

    if (request.kind === "money") {
      if (responder.bankrupt) return client.send("error", "Perfil falido não pode receber pagamentos.");
      if (request.amount <= 0 || player.balance < request.amount) {
        client.send("error", "Saldo insuficiente ou pagamento inválido.");

        this.ev(
          "money",
          responder.name,
          `Pagamento de ${player.name} não foi realizado por saldo insuficiente ou valor inválido.`,
          "rejected",
        );

        return;
      }

      const previousPlayerBalance = player.balance;

      const previousDestinationBalance = responder.balance;

      try {
        player.balance -= request.amount;

        responder.balance += request.amount;

        player.sent += request.amount;

        responder.received += request.amount;

        this.ev(
          "money",
          responder.name,
          `${responder.name} aprovou pagamento de ${request.amount.toLocaleString("pt-BR")} enviado por ${player.name}.`,
          "approved",
        );
      } catch (error) {
        player.balance = previousPlayerBalance;

        responder.balance = previousDestinationBalance;

        throw error;
      }

      return;
    }

    if (request.kind === "bank") {
      if (!request.amount || player.balance + request.amount < 0) {
        client.send(
          "error",
          "Saldo insuficiente ou operação bancária inválida.",
        );

        this.ev(
          "bank",
          responder.name,
          `Operação bancária de ${player.name} não foi realizada.`,
          "rejected",
        );

        return;
      }

      const previousBalance = player.balance;

      try {
        player.balance += request.amount;

        player.bankOps++;

        this.ev(
          "bank",
          responder.name,
          `${responder.name} aprovou operação bancária de ${request.amount.toLocaleString("pt-BR")} para ${player.name}.`,
          "approved",
        );
      } catch (error) {
        player.balance = previousBalance;

        throw error;
      }

      return;
    }

    if (request.kind !== "asset") {
      client.send("error", "Tipo de solicitação inválido.");

      return;
    }

    const organization =
      request.kind === "asset" &&
      /^(ONU|OIT|OMC|OTAN|IPCC|OMS)$/.test(request.name);

    const currentOwner = this.findCatalogOwner(request.catalogId);

    if (currentOwner) {
      this.ev(
        organization ? "organization" : "property",
        responder.name,
        `${request.name} não foi aprovada para ${player.name}, pois já pertence a ${currentOwner.name}.`,
        "rejected",
      );

      return client.send(
        "error",
        `${request.name} já pertence a ${currentOwner.name}. Nenhum valor foi descontado.`,
      );
    }

    const constructionCost = organization
      ? 0
      : request.development === 5
        ? 4 * request.houseCost + request.condominiumCost
        : request.development * request.houseCost;

    const total = request.purchase + constructionCost;

    if (total <= 0 || player.balance < total) {
      this.ev(
        organization ? "organization" : "property",
        responder.name,
        `${request.name} não foi aprovada para ${player.name} por saldo insuficiente ou custo inválido.`,
        "rejected",
      );

      return client.send(
        "error",
        `Saldo insuficiente ou custo inválido. Total: ${total.toLocaleString("pt-BR")}.`,
      );
    }

    const previousBalance = player.balance;

    const asset = new Asset();

    asset.id = uid();
    asset.catalogId = request.catalogId;

    asset.kind = organization ? "organization" : "property";

    asset.name = request.name;

    asset.development = organization ? 0 : request.development;

    asset.mortgaged = request.mortgaged;

    asset.purchase = request.purchase;

    asset.mortgage = request.mortgageValue;

    asset.houseCost = organization ? 0 : request.houseCost;

    asset.condominiumCost = organization ? 0 : request.condominiumCost;

    try {
      player.balance -= total;

      player.bankOps++;

      player.assets.push(asset);

      this.ev(
        organization ? "organization" : "property",
        responder.name,
        `${responder.name} aprovou ${request.name} para ${player.name}; total descontado ${total.toLocaleString("pt-BR")}.`,
        "approved",
      );
    } catch (error) {
      player.balance = previousBalance;

      const assetIndex = player.assets.findIndex(
        (item) => item.id === asset.id,
      );

      if (assetIndex >= 0) {
        player.assets.splice(assetIndex, 1);
      }

      throw error;
    }
  }

  private cancel(client: Client, data: any) {
    const player = this.me(client);

    const request = this.state.pending.get(t(data.id, 50));

    if (request && request.fromId === player.id) {
      this.state.pending.delete(request.id);

      this.ev(
        request.kind,
        player.name,
        `${player.name} cancelou uma solicitação.`,
        "cancelled",
      );
    }
  }

  private development(client: Client, data: any) {
    const player = this.activePlayer(client);

    if (!player) return;

    const assetId = t(data.id, 80);

    if (!assetId || this.processingAssets.has(assetId)) {
      return client.send("error", "Esta operação já está sendo processada.");
    }

    const asset = player.assets.find((item) => item.id === assetId);

    if (!asset || asset.kind !== "property") {
      return client.send("error", "Propriedade inválida.");
    }

    if (asset.mortgaged) {
      return client.send(
        "error",
        "Não é possível construir ou vender construções em uma propriedade hipotecada.",
      );
    }

    const currentDevelopment = asset.development;

    const targetDevelopment = Number(data.value);

    if (
      !Number.isInteger(targetDevelopment) ||
      targetDevelopment < 0 ||
      targetDevelopment > 5
    ) {
      return client.send("error", "Nível de construção inválido.");
    }

    if (targetDevelopment === currentDevelopment) {
      return client.send(
        "error",
        "A propriedade já está nesse nível de construção.",
      );
    }

    if (Math.abs(targetDevelopment - currentDevelopment) !== 1) {
      return client.send(
        "error",
        "Altere apenas um nível de construção por operação.",
      );
    }

    if (asset.houseCost <= 0 || asset.condominiumCost <= 0) {
      return client.send(
        "error",
        "Os custos oficiais de construção não estão disponíveis para esta propriedade.",
      );
    }

    const buying = targetDevelopment > currentDevelopment;

    let operationValue = 0;

    let operationDescription = "";

    if (buying) {
      if (currentDevelopment === 4 && targetDevelopment === 5) {
        operationValue = asset.condominiumCost;

        operationDescription = "construiu um condomínio";
      } else {
        operationValue = asset.houseCost;

        operationDescription = "comprou uma casa";
      }

      if (player.balance < operationValue) {
        return client.send(
          "error",
          `Saldo insuficiente. Esta construção custa ${operationValue.toLocaleString("pt-BR")}.`,
        );
      }
    } else {
      if (currentDevelopment === 5 && targetDevelopment === 4) {
        operationValue = Math.floor(asset.condominiumCost * 0.5);

        operationDescription = "vendeu o condomínio";
      } else {
        operationValue = Math.floor(asset.houseCost * 0.5);

        operationDescription = "vendeu uma casa";
      }
    }

    if (operationValue <= 0) {
      return client.send("error", "Valor da operação inválido.");
    }

    this.processingAssets.add(assetId);

    const previousBalance = player.balance;

    const previousDevelopment = asset.development;

    try {
      if (buying) {
        player.balance -= operationValue;
      } else {
        player.balance += operationValue;
      }

      asset.development = targetDevelopment;

      player.bankOps++;

      this.ev(
        "property",
        player.name,
        buying
          ? `${player.name} ${operationDescription} em ${asset.name}; foram descontados ${operationValue.toLocaleString("pt-BR")}.`
          : `${player.name} ${operationDescription} em ${asset.name}; foram devolvidos ${operationValue.toLocaleString("pt-BR")} ao saldo, correspondentes a 50% do valor oficial.`,
        buying ? "purchase" : "sale",
      );
    } catch (error) {
      player.balance = previousBalance;

      asset.development = previousDevelopment;

      throw error;
    } finally {
      this.processingAssets.delete(assetId);
    }
  }

  private mortgage(client: Client, data: any) {
    const player = this.activePlayer(client);

    if (!player) return;

    const asset = player.assets.find((item) => item.id === data.id);

    if (!asset) {
      return client.send("error", "Patrimônio inválido.");
    }

    if (asset.development > 0) {
      return client.send(
        "error",
        "Venda todas as construções antes de hipotecar.",
      );
    }

    asset.mortgaged = !asset.mortgaged;

    this.ev(
      "asset",
      player.name,
      `${player.name} ${
        asset.mortgaged ? "hipotecou" : "retirou a hipoteca de"
      } ${asset.name}.`,
      "item",
    );
  }

  private offer(client: Client, data: any) {
    const player = this.activePlayer(client);

    if (!player) return;

    const destination = this.state.players.get(t(data.to, 50));

    const asset = player.assets.find((item) => item.id === data.assetId);

    if (!destination || destination.bankrupt || !asset || asset.mortgaged || asset.development > 0) {
      return client.send(
        "error",
        "Somente item sem construção e não hipotecado.",
      );
    }

    const request = this.pend("offer", player, destination, {
      name: asset.name,
      reason: "oferta",
    });

    request.catalogId = asset.id;

    this.ev(
      "asset",
      player.name,
      `${player.name} ofereceu ${asset.name} para ${destination.name}.`,
      "pending",
    );
  }

  private debt(client: Client, data: any) {
    const player = this.activePlayer(client);

    if (!player) return;

    const creditor = this.state.players.get(t(data.creditorId, 50));

    const cash = Math.max(0, Number(data.cashOffered) || 0);

    const assetIds = Array.isArray(data.assetIds)
      ? data.assetIds.map((id: unknown) => t(id, 50))
      : [];

    if (!creditor || creditor.bankrupt || creditor.id === player.id || cash > player.balance) {
      return client.send("error", "Acordo inválido.");
    }

    const items: (Asset | undefined)[] = assetIds.map((id: string) =>
      player.assets.find((asset) => asset.id === id),
    );

    if (
      items.some((asset) => !asset || asset.mortgaged || asset.development > 0)
    ) {
      return client.send(
        "error",
        "Item ausente, hipotecado ou com construção.",
      );
    }

    for (const agreement of this.state.debts.values()) {
      if ([...agreement.assetIds].some((id) => assetIds.includes(id))) {
        return client.send("error", "Item já usado em outro acordo.");
      }
    }

    const agreement = new Debt();

    agreement.id = uid();

    agreement.debtorId = player.id;

    agreement.debtorName = player.name;

    agreement.creditorId = creditor.id;

    agreement.creditorName = creditor.name;

    agreement.originalAmount = Math.max(1, Number(data.originalAmount) || 0);

    agreement.cashOffered = cash;

    agreement.note = t(data.note);

    agreement.at = Date.now();

    assetIds.forEach((id: string) => agreement.assetIds.push(id));

    this.state.debts.set(agreement.id, agreement);

    this.ev(
      "debt",
      player.name,
      `${player.name} propôs acordo para dívida de ${agreement.originalAmount.toLocaleString("pt-BR")}.`,
      "pending",
    );
  }

  private respondDebt(client: Client, data: any) {
    const creditor = this.activePlayer(client);
    if (!creditor) return;

    const agreementId = t(data.id, 50);

    if (!agreementId || this.processedRequests.has(agreementId)) {
      return;
    }

    const agreement = this.state.debts.get(agreementId);

    if (!agreement || agreement.creditorId !== creditor.id) {
      return;
    }

    const debtor = this.state.players.get(agreement.debtorId);

    if (!debtor) {
      this.state.debts.delete(agreement.id);

      return;
    }

    this.processedRequests.add(agreement.id);

    this.state.debts.delete(agreement.id);

    if (!data.accept) {
      this.ev(
        "debt",
        creditor.name,
        `${creditor.name} recusou acordo de ${debtor.name}.`,
        "rejected",
      );

      return;
    }

    if (debtor.balance < agreement.cashOffered) {
      return client.send("error", "Dinheiro indisponível.");
    }

    const items = [...agreement.assetIds].map((id) =>
      debtor.assets.find((asset) => asset.id === id),
    );

    if (
      items.some((asset) => !asset || asset.mortgaged || asset.development > 0)
    ) {
      return client.send("error", "Acordo alterado; nada foi transferido.");
    }

    const previousDebtorBalance = debtor.balance;

    const previousCreditorBalance = creditor.balance;

    const transferredAssets: {
      asset: Asset;
      originalIndex: number;
    }[] = [];

    try {
      debtor.balance -= agreement.cashOffered;

      creditor.balance += agreement.cashOffered;

      for (const asset of items as Asset[]) {
        const originalIndex = debtor.assets.findIndex(
          (item) => item.id === asset.id,
        );

        if (originalIndex < 0) {
          throw Error("Patrimônio do acordo não encontrado.");
        }

        transferredAssets.push({
          asset,
          originalIndex,
        });

        debtor.assets.splice(originalIndex, 1);

        creditor.assets.push(asset);
      }

      this.ev(
        "debt",
        creditor.name,
        `${creditor.name} aceitou acordo de ${debtor.name}; dívida encerrada.`,
        "approved",
      );
    } catch (error) {
      debtor.balance = previousDebtorBalance;

      creditor.balance = previousCreditorBalance;

      for (const { asset, originalIndex } of transferredAssets.reverse()) {
        const creditorIndex = creditor.assets.findIndex(
          (item) => item.id === asset.id,
        );

        if (creditorIndex >= 0) {
          creditor.assets.splice(creditorIndex, 1);
        }

        debtor.assets.splice(originalIndex, 0, asset);
      }

      throw error;
    }
  }

  private cancelDebt(client: Client, data: any) {
    const player = this.me(client);

    const agreement = this.state.debts.get(t(data.id, 50));

    if (agreement && agreement.debtorId === player.id) {
      this.state.debts.delete(agreement.id);

      this.ev(
        "debt",
        player.name,
        `${player.name} cancelou acordo.`,
        "cancelled",
      );
    }
  }

  private startBonus(client: Client) {
    const player = this.activePlayer(client);

    if (!player) return;

    this.pend("bank", player, this.state.players.get(this.state.hostId), {
      amount: 200000,
      reason: "Passagem pelo Início",
    });
  }

  private fmi(client: Client, data: any) {
    const player = this.activePlayer(client);

    if (!player) return;

    const diceSum = Math.max(2, Math.min(12, Number(data.sum) || 2));

    const value = diceSum * 2000 * (data.kind === "debt" ? -1 : 1);

    this.pend("bank", player, this.state.players.get(this.state.hostId), {
      amount: value,
      reason: `FMI ${diceSum} × 2.000`,
    });
  }

  private kick(client: Client, data: any) {
    if (!this.adm(client)) {
      return;
    }

    const playerId = t(data.id, 50);

    const player = this.state.players.get(playerId);

    const connection = this.clients.find((item) => item.sessionId === playerId);

    if (!player || !connection || playerId === client.sessionId) {
      return client.send("error", "Jogador inválido.");
    }

    this.ev(
      "admin",
      this.me(client).name,
      `${this.me(client).name} expulsou ${player.name}.`,
      "settings",
    );

    this.kicked.add(playerId);

    connection.send("kicked", "Você foi expulso da sala pelo ADM.");

    connection.leave(4000);
  }

  private removeOffline(client: Client, data: any) {
    if (!this.adm(client)) {
      return;
    }

    const playerId = t(data.id, 50);

    const player = this.state.players.get(playerId);

    if (!player || player.connected) {
      return client.send("error", "O jogador não está offline.");
    }

    this.clearPlayer(playerId);

    this.state.players.delete(playerId);

    this.ev(
      "admin",
      this.me(client).name,
      `${this.me(client).name} removeu ${player.name}, que estava offline.`,
      "settings",
    );
  }

  private requestBankruptcy(client: Client) {
    const player = this.activePlayer(client);
    if (!player) return;
    for (const request of this.state.pending.values()) {
      if (request.kind === "bankruptcy" && request.fromId === player.id) {
        return client.send("error", "Já existe uma solicitação de falência pendente.");
      }
    }
    this.pend("bankruptcy", player, this.state.players.get(this.state.hostId), {
      reason: "Solicitação de falência",
    });
    this.ev("bankruptcy", player.name, `${player.name} solicitou declaração de falência.`, "pending");
  }

  private declareBankruptcy(client: Client, data: any) {
    if (!this.adm(client)) return;
    const player = this.state.players.get(t(data.playerId, 50));
    if (!player || player.bankrupt) return client.send("error", "Jogador inválido ou já falido.");
    this.applyBankruptcy(client, player);
  }

  private applyBankruptcy(client: Client, player: Player) {
    if (player.bankrupt) return client.send("error", "O jogador já está falido.");
    const snapshot = {
      balance: player.balance,
      bankOps: player.bankOps,
      sent: player.sent,
      received: player.received,
      assets: [...player.assets].map((asset) => ({
        id: asset.id, catalogId: asset.catalogId, kind: asset.kind, name: asset.name,
        development: asset.development, mortgaged: asset.mortgaged,
        purchase: asset.purchase, mortgage: asset.mortgage,
        houseCost: asset.houseCost, condominiumCost: asset.condominiumCost,
      })),
    };
    player.bankruptcyBackup = JSON.stringify(snapshot);
    let refund = 0;
    for (const asset of player.assets) {
      if (asset.kind === "property") {
        if (asset.development === 5) refund += Math.floor(asset.condominiumCost * 0.5) + Math.floor(asset.houseCost * 0.5) * 4;
        else refund += Math.floor(asset.houseCost * 0.5) * asset.development;
      }
    }
    player.balance += refund;
    player.assets.clear();
    player.bankrupt = true;
    for (const [id, request] of this.state.pending) {
      if (request.fromId === player.id || request.toId === player.id) this.state.pending.delete(id);
    }
    for (const [id, agreement] of this.state.debts) {
      if (agreement.debtorId === player.id || agreement.creditorId === player.id) this.state.debts.delete(id);
    }
    this.ev("bankruptcy", this.me(client).name, `${player.name} foi declarado falido. Construções liquidadas por 50% (${refund.toLocaleString("pt-BR")}) e patrimônios devolvidos ao banco.`, "bankrupt");
    this.saveNow();
  }

  private restoreBankruptcy(client: Client, data: any) {
    if (!this.adm(client)) return;
    const player = this.state.players.get(t(data.playerId, 50));
    if (!player?.bankrupt || !player.bankruptcyBackup) return client.send("error", "Não há falência reversível para este jogador.");
    try {
      const snapshot = JSON.parse(player.bankruptcyBackup);
      const conflicts = (snapshot.assets || []).filter((raw: any) => {
        const owner = this.findCatalogOwner(String(raw.catalogId || ""));
        return owner && owner.id !== player.id;
      });
      if (conflicts.length) return client.send("error", "Não é possível desfazer: um patrimônio já possui novo proprietário.");
      player.balance = Number(snapshot.balance) || 0;
      player.bankOps = Number(snapshot.bankOps) || 0;
      player.sent = Number(snapshot.sent) || 0;
      player.received = Number(snapshot.received) || 0;
      player.assets.clear();
      for (const raw of snapshot.assets || []) {
        const asset = new Asset();
        Object.assign(asset, raw);
        player.assets.push(asset);
      }
      player.bankrupt = false;
      player.bankruptcyBackup = "";
      this.ev("bankruptcy", this.me(client).name, `${this.me(client).name} desfez a falência de ${player.name} e restaurou o retrato anterior.`, "restored");
      this.saveNow();
    } catch {
      client.send("error", "Não foi possível restaurar o retrato anterior à falência.");
    }
  }

  private transferAdmin(client: Client, data: any) {
    if (!this.adm(client)) return;
    const currentAdmin = this.me(client);
    const playerId = t(data.playerId, 50);
    const nextAdmin = this.state.players.get(playerId);
    if (!nextAdmin || nextAdmin.id === currentAdmin.id) return client.send("error", "Selecione outro jogador válido.");
    if (!nextAdmin.connected) return client.send("error", "O novo ADM precisa estar online.");
    this.state.hostId = nextAdmin.id;
    this.ev("admin", currentAdmin.name, `${currentAdmin.name} transferiu a administração para ${nextAdmin.name}.`, "settings");
    this.saveNow();
    this.broadcast("admin_transferred", { from: currentAdmin.name, to: nextAdmin.name });
  }

  private toggleLock(client: Client) {
    if (!this.adm(client)) {
      return;
    }

    this.state.locked = !this.state.locked;

    if (this.state.locked) {
      this.lock();
    } else {
      this.unlock();
    }

    this.ev(
      "admin",
      this.me(client).name,
      this.state.locked ? "Entradas bloqueadas." : "Entradas reabertas.",
      "settings",
    );
  }

  private settings(client: Client, data: any) {
    if (!this.adm(client)) {
      return;
    }

    this.state.roomName = t(data.name, 50) || this.state.roomName;

    this.ev(
      "admin",
      this.me(client).name,
      "Nome da partida atualizado.",
      "settings",
    );
  }

  private report(client: Client) {
    if (!this.adm(client)) {
      return;
    }

    client.send(
      "report",
      JSON.stringify(
        {
          version: "0.5.2",
          roomId: this.roomId,
          state: this.state,
        },
        null,
        2,
      ),
    );
  }

  private endRoom(client: Client) {
    if (!this.adm(client)) {
      return;
    }

    this.state.ended = true;
    this.state.locked = true;

    this.lock();

    this.state.pending.clear();

    this.state.debts.clear();

    this.ev(
      "admin",
      this.me(client).name,
      `${this.me(client).name} encerrou a sala.`,
      "settings",
    );

    this.broadcast("room_ended", "A sala foi encerrada pelo ADM.");

    setTimeout(() => {
      this.disconnect(4001);
    }, 700);
  }

  private scheduleSave() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveNow();
    }, 250);
  }

  private saveNow() {
    try {
      atomicSave(this.state, this.pinHash);
    } catch (error) {
      console.error("Falha ao salvar", error);
    }
  }

  private pauseRoom(client: Client) {
    if (!this.adm(client)) {
      return;
    }

    this.state.paused = true;

    this.ev(
      "admin",
      this.me(client).name,
      `${this.me(client).name} pausou e salvou a partida.`,
      "settings",
    );

    this.saveNow();

    this.broadcast("room_paused", {
      saveCode: this.state.saveCode,
      message: "Partida pausada e salva.",
    });
  }
}
