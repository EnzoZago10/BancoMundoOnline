import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { HOUSE_STOCK, INITIAL_BALANCE } from "./domain/rules.js";

export class Asset extends Schema {
  @type("string") id = "";
  @type("string") catalogId = "";
  @type("string") kind = "";
  @type("string") name = "";
  @type("number") development = 0;
  @type("boolean") mortgaged = false;
  @type("number") purchase = 0;
  @type("number") mortgage = 0;
  @type("number") houseCost = 0;
  @type("number") condominiumCost = 0;
}

export class PlayerStats extends Schema {
  @type("number") rentPaid = 0;
  @type("number") rentReceived = 0;
  @type("number") propertiesPurchased = 0;
  @type("number") housesBuilt = 0;
  @type("number") housesSold = 0;
  @type("number") mortgagesCreated = 0;
  @type("number") tradesCompleted = 0;
  @type("number") turnsPlayed = 0;
  @type("number") jailTurns = 0;
  @type("number") obligationsCreated = 0;
  @type("number") settlementsCompleted = 0;
}

export class Player extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("number") balance = INITIAL_BALANCE;
  @type("boolean") connected = true;
  @type("boolean") abandoned = false;
  @type("number") sent = 0;
  @type("number") received = 0;
  @type("number") bankOps = 0;
  @type("boolean") bankrupt = false;
  @type("boolean") spectator = false;
  @type("number") boardPosition = 0;
  @type("boolean") jailed = false;
  @type("boolean") jailVisiting = false;
  @type("number") jailAttempts = 0;
  @type("number") habeasCorpus = 0;
  @type("boolean") startBonusAvailable = false;
  @type(PlayerStats) stats = new PlayerStats();
  @type([Asset]) assets = new ArraySchema<Asset>();

  deviceTokenHash = "";
  recoveryTokenHash = "";
  bankruptcyBackup = "";
}

export class Pending extends Schema {
  @type("string") id = "";
  @type("string") kind = "";
  @type("string") fromId = "";
  @type("string") fromName = "";
  @type("string") toId = "";
  @type("string") toName = "";
  @type("number") amount = 0;
  @type("string") catalogId = "";
  @type("string") name = "";
  @type("number") development = 0;
  @type("boolean") mortgaged = false;
  @type("number") purchase = 0;
  @type("number") houseCost = 0;
  @type("number") condominiumCost = 0;
  @type("number") mortgageValue = 0;
  @type("string") reason = "";
  @type("number") at = 0;
}

// Estrutura legada da 0.7.x. Mantida somente para migração de saves antigos.
export class Debt extends Schema {
  @type("string") id = "";
  @type("string") debtorId = "";
  @type("string") debtorName = "";
  @type("string") creditorId = "";
  @type("string") creditorName = "";
  @type("number") originalAmount = 0;
  @type("number") cashOffered = 0;
  @type("string") note = "";
  @type(["string"]) assetIds = new ArraySchema<string>();
  @type("number") at = 0;
}

export class Trade extends Schema {
  @type("string") id = "";
  @type("string") proposerId = "";
  @type("string") recipientId = "";
  @type("number") proposerCash = 0;
  @type("number") recipientCash = 0;
  @type(["string"]) proposerAssetIds = new ArraySchema<string>();
  @type(["string"]) recipientAssetIds = new ArraySchema<string>();
  @type("number") proposerHabeasCount = 0;
  @type("number") recipientHabeasCount = 0;
  @type("string") status = "pending";
  @type("number") createdAt = 0;
  @type("number") revision = 0;
}

export class Liability extends Schema {
  @type("string") id = "";
  @type("string") debtorId = "";
  @type("string") creditorType = "BANK";
  @type("string") creditorPlayerId = "";
  @type("number") amount = 0;
  @type("number") remaining = 0;
  @type("string") reason = "";
  @type("string") sourceCode = "";
  @type("string") sourceEventId = "";
  @type("string") status = "open";
  @type("number") createdAt = 0;
}

export class Settlement extends Schema {
  @type("string") id = "";
  @type("string") liabilityId = "";
  @type("string") debtorId = "";
  @type("string") creditorPlayerId = "";
  @type("number") cash = 0;
  @type(["string"]) assetIds = new ArraySchema<string>();
  @type("string") note = "";
  @type("string") status = "pending";
  @type("number") createdAt = 0;
}

export class Event extends Schema {
  @type("string") id = "";
  @type("number") seq = 0;
  @type("string") code = "";
  @type("string") type = "";
  @type("string") category = "";
  @type("string") actorId = "";
  @type("string") actor = "";
  @type("string") targetPlayerId = "";
  @type("string") catalogId = "";
  @type("number") amount = 0;
  @type("string") metadata = "";
  @type("string") message = "";
  @type("number") at = 0;
}

export class GameRules extends Schema {
  @type("string") preset = "official";
  @type("boolean") requireFullGroupForBuilding = true;
  @type("boolean") requireEvenBuilding = true;
  @type("number") housesBeforeCondo = 4;
  @type("boolean") limitedHouseStock = true;
  @type("number") mortgageRedemptionInterest = 0.20;
  @type("number") jailFine = 50_000;
  @type("boolean") allowEarlyJailFine = false;
  @type("number") startSalary = 200_000;
  @type("boolean") autoCollectStart = false;
  @type("number") houseStock = HOUSE_STOCK;
  @type("boolean") useDigitalDice = false;
  @type("boolean") alternateLiquidationVictory = false;
  @type("boolean") initialPropertyDistribution = false;
  @type("boolean") timedGame = false;
  @type("number") timeLimitMs = 0;
}

export class State extends Schema {
  @type("string") saveCode = "";
  @type("string") hostId = "";
  @type("string") roomName = "Partida Banco Mundo";
  @type("string") mode = "assisted";
  @type("boolean") locked = false;
  @type("boolean") ended = false;
  @type("boolean") paused = false;
  @type("boolean") gameStarted = false;
  @type("boolean") rulesLocked = false;
  @type("number") lastSavedAt = 0;
  @type("number") revision = 0;
  @type("number") maxPlayers = 6;
  @type("number") seq = 0;
  @type("number") housesRemaining = HOUSE_STOCK;
  @type("string") gamePhase = "LOBBY";
  @type(["string"]) turnOrder = new ArraySchema<string>();
  @type("string") currentPlayerId = "";
  @type("number") round = 0;
  @type("number") turnNumber = 0;
  @type("number") die1 = 0;
  @type("number") die2 = 0;
  @type("number") consecutiveDoubles = 0;
  @type("string") requiredAction = "";
  @type("string") requiredActionPlayerId = "";
  @type("string") requiredLiabilityId = "";
  @type("string") winnerId = "";
  @type("number") startedAt = 0;
  @type("number") durationMs = 0;
  @type("number") pausedAt = 0;
  @type("number") totalPausedMs = 0;
  @type("number") gameFinishedAt = 0;
  @type("boolean") houseAuctionAvailable = false;
  @type("string") houseAuctionId = "";
  @type("string") houseAuctionStatus = "";
  @type("number") houseAuctionBid = 0;
  @type("string") houseAuctionBidderId = "";
  @type("string") houseAuctionAssetId = "";
  // Snapshot derivado e somente-leitura para clientes. Evita depender da hidratação
  // do Schema aninhado para exibir o Ruleset; a fonte de verdade continua sendo `rules`.
  @type("string") rulesSnapshot = "";
  @type(GameRules) rules = new GameRules();
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Pending }) pending = new MapSchema<Pending>();
  @type({ map: Debt }) debts = new MapSchema<Debt>();
  @type({ map: Trade }) trades = new MapSchema<Trade>();
  @type({ map: Liability }) liabilities = new MapSchema<Liability>();
  @type({ map: Settlement }) settlements = new MapSchema<Settlement>();
  @type([Event]) events = new ArraySchema<Event>();
}
