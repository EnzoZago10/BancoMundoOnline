export type PurchaseAssetCommand = { type:"PURCHASE_ASSET"; playerId:string; catalogId:string };
export type BuildCommand = { type:"CHANGE_DEVELOPMENT"; playerId:string; assetId:string; target:number };
export type MortgageCommand = { type:"MORTGAGE"; playerId:string; assetId:string };
export type RedeemMortgageCommand = { type:"REDEEM_MORTGAGE"; playerId:string; assetId:string };
export type ProposeTradeCommand = { type:"PROPOSE_TRADE"; proposerId:string; recipientId:string; proposerCash:number; recipientCash:number; proposerAssetIds:string[]; recipientAssetIds:string[]; proposerHabeasCount:number; recipientHabeasCount:number };
export type RespondTradeCommand = { type:"RESPOND_TRADE"; playerId:string; tradeId:string; accept:boolean };
export type ResolveRentCommand = { type:"RESOLVE_RENT"; playerId:string; catalogId:string };
export type ResolveInstitutionCommand = { type:"RESOLVE_INSTITUTION"; playerId:string; catalogId:string; diceSum:number };
export type PayLiabilityCommand = { type:"PAY_LIABILITY"; playerId:string; liabilityId:string; amount?:number };
export type SellAssetToBankCommand = { type:"SELL_ASSET_TO_BANK"; playerId:string; liabilityId:string; assetId:string };
export type PayJailFineCommand = { type:"PAY_JAIL_FINE"; playerId:string };
export type RollAssistiveDiceCommand = { type:"ROLL_ASSISTIVE_DICE"; playerId:string };
export type DeclareBankruptcyCommand = { type:"DECLARE_BANKRUPTCY"; playerId:string; liabilityId:string };
export type GameCommand = PurchaseAssetCommand|BuildCommand|MortgageCommand|RedeemMortgageCommand|ProposeTradeCommand|RespondTradeCommand|ResolveRentCommand|ResolveInstitutionCommand|PayLiabilityCommand|SellAssetToBankCommand|PayJailFineCommand|RollAssistiveDiceCommand|DeclareBankruptcyCommand;

export function text(value: unknown, max=120) { return String(value ?? "").trim().slice(0,max); }
export function money(value: unknown) { const n=Number(value); if(!Number.isFinite(n)||n<0) throw Error("Valor monetário inválido."); return Math.round(n); }
export function stringArray(value: unknown, maxItems=28) { if(!Array.isArray(value)||value.length>maxItems) throw Error("Lista inválida."); return value.map(v=>text(v,80)).filter(Boolean); }
