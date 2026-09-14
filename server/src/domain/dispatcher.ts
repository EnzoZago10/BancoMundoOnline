import type { GameCommand } from "./commands.js";
import type { GameEngine } from "./game-engine.js";

export class CommandDispatcher {
  constructor(private readonly engine: GameEngine) {}
  dispatch(command: GameCommand): any {
    switch(command.type){
      case "PURCHASE_ASSET": return this.engine.purchaseAsset(command.playerId,command.catalogId);
      case "CHANGE_DEVELOPMENT": return this.engine.changeDevelopment(command.playerId,command.assetId,command.target);
      case "MORTGAGE": return this.engine.mortgage(command.playerId,command.assetId);
      case "REDEEM_MORTGAGE": return this.engine.redeemMortgage(command.playerId,command.assetId);
      case "PROPOSE_TRADE": return this.engine.proposeTrade(command);
      case "RESPOND_TRADE": return this.engine.respondTrade(command.playerId,command.tradeId,command.accept);
      case "RESOLVE_RENT": return this.engine.resolveRent(command.playerId,command.catalogId);
      case "RESOLVE_INSTITUTION": return this.engine.resolveInstitution(command.playerId,command.catalogId,command.diceSum);
      case "PAY_LIABILITY": return this.engine.payLiability(command.playerId,command.liabilityId,command.amount);
      case "SELL_ASSET_TO_BANK": return this.engine.sellAssetToBank(command.playerId,command.assetId,command.liabilityId);
      case "PAY_JAIL_FINE": return this.engine.payJailFine(command.playerId);
      case "ROLL_ASSISTIVE_DICE": return this.engine.rollAssistiveDice(command.playerId);
      case "DECLARE_BANKRUPTCY": return this.engine.declareBankruptcy(command.playerId,command.liabilityId);
      default: { const neverCommand: never = command; throw Error(`Comando não suportado: ${String(neverCommand)}`); }
    }
  }
}
