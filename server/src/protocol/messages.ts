import { money, stringArray, text } from "../domain/commands.js";

function record(value: unknown, label="payload"): Record<string,unknown>{if(!value||typeof value!=="object"||Array.isArray(value))throw Error(`${label} inválido.`);return value as Record<string,unknown>;}
const reqText=(o:Record<string,unknown>,key:string,max=80)=>{const v=text(o[key],max);if(!v)throw Error(`${key} é obrigatório.`);return v;};
const optText=(o:Record<string,unknown>,key:string,max=200)=>text(o[key],max);
const int=(value:unknown,min:number,max:number,label:string)=>{const n=Number(value);if(!Number.isInteger(n)||n<min||n>max)throw Error(`${label} inválido.`);return n;};
const bool=(value:unknown,label:string)=>{if(typeof value!=="boolean")throw Error(`${label} inválido.`);return value;};

export const parsePurchase=(v:unknown)=>{const o=record(v);return{catalogId:reqText(o,"catalogId"),reason:optText(o,"reason")};};
export const parseDevelopment=(v:unknown)=>{const o=record(v);return{id:reqText(o,"id"),value:int(o.value,0,5,"development")};};
export const parseMortgage=(v:unknown)=>{const o=record(v);const action=optText(o,"action",20);if(action&&action!=="mortgage"&&action!=="redeem")throw Error("Ação de hipoteca inválida.");return{id:reqText(o,"id"),action};};
export const parseTrade=(v:unknown)=>{const o=record(v);return{recipientId:reqText(o,"recipientId"),proposerCash:money(o.proposerCash??0),recipientCash:money(o.recipientCash??0),proposerAssetIds:stringArray(o.proposerAssetIds??[]),recipientAssetIds:stringArray(o.recipientAssetIds??[]),proposerHabeasCount:int(o.proposerHabeasCount??0,0,20,"Habeas Corpus ofertado"),recipientHabeasCount:int(o.recipientHabeasCount??0,0,20,"Habeas Corpus solicitado")};};
export const parseTradeResponse=(v:unknown)=>{const o=record(v);return{id:reqText(o,"id"),accept:bool(o.accept,"accept")};};
export const parseLiabilityPayment=(v:unknown)=>{const o=record(v);return{id:reqText(o,"id"),amount:o.amount===undefined?undefined:money(o.amount)};};
export const parseLiquidity=(v:unknown)=>{const o=record(v);return{id:reqText(o,"id")};};
export const parseSellAssetToBank=(v:unknown)=>{const o=record(v);return{id:reqText(o,"id"),liabilityId:reqText(o,"liabilityId")};};
export const parseRent=(v:unknown)=>{const o=record(v);return{catalogId:reqText(o,"catalogId")};};
export const parseInstitution=(v:unknown)=>{const o=record(v);return{catalogId:reqText(o,"catalogId"),diceSum:int(o.diceSum,2,12,"Soma dos dados")};};
export const parseSettlement=(v:unknown)=>{const o=record(v);return{liabilityId:reqText(o,"liabilityId"),cash:money(o.cash??0),assetIds:stringArray(o.assetIds??[]),note:optText(o,"note")};};
export const parseSettlementResponse=(v:unknown)=>{const o=record(v);return{id:reqText(o,"id"),accept:bool(o.accept,"accept")};};
export const parseBankruptcy=(v:unknown)=>{const o=record(v);return{playerId:optText(o,"playerId"),liabilityId:reqText(o,"liabilityId")};};
export const parseJailAction=(v:unknown)=>{const o=record(v);const action=reqText(o,"action",40);if(!["send","visit","failed_roll","pay_fine","habeas","grant_habeas"].includes(action))throw Error("Ação de cadeia inválida.");return{action,playerId:optText(o,"playerId")};};
export const parseTurnOrder=(v:unknown)=>{const o=record(v);return{order:stringArray(o.order??[],6)};};
export const parseAdminAdjust=(v:unknown)=>{const o=record(v);return{playerId:reqText(o,"playerId"),assetId:reqText(o,"assetId"),development:int(o.development,0,5,"development")};};

export const parseId=(v:unknown,key="id")=>{const o=record(v);return{[key]:reqText(o,key)} as Record<string,string>;};
export const parseMoneyTransfer=(v:unknown)=>{const o=record(v);return{to:reqText(o,"to"),amount:money(o.amount),reason:optText(o,"reason")};};
export const parseBankOperation=(v:unknown)=>{const o=record(v);const amount=Number(o.amount);if(!Number.isFinite(amount)||amount===0)throw Error("Valor inválido.");return{amount:Math.round(amount),reason:reqText(o,"reason",200)};};
export const parsePendingResponse=(v:unknown)=>{const o=record(v);return{id:reqText(o,"id"),accept:bool(o.accept,"accept")};};
export const parseFmi=(v:unknown)=>{const o=record(v);const kind=reqText(o,"kind",20);if(kind!=="debt"&&kind!=="refund")throw Error("Tipo FMI inválido.");return{kind,sum:int(o.sum,2,12,"Soma dos dados")};};
export const parseStartBonus=(v:unknown)=>{const o=record(v);return{playerId:optText(o,"playerId")};};
export const parseAdminLiability=(v:unknown)=>{const o=record(v);const creditorPlayerId=optText(o,"creditorPlayerId");return{debtorId:reqText(o,"debtorId"),creditorPlayerId,amount:money(o.amount),reason:optText(o,"reason",200)};};
export const parseLegacyDebt=(v:unknown)=>{const o=record(v);return{creditorId:reqText(o,"creditorId"),originalAmount:money(o.originalAmount),cashOffered:money(o.cashOffered??0),assetIds:stringArray(o.assetIds??[]),note:optText(o,"note")};};
export const parseSettings=(v:unknown)=>{const o=record(v);return{name:optText(o,"name",50)};};
export const parsePlayerTarget=(v:unknown)=>{const o=record(v);return{id:reqText(o,"id")};};
export const parseTransferAdmin=(v:unknown)=>{const o=record(v);return{playerId:reqText(o,"playerId")};};
export const parseInitialDistribution=(v:unknown)=>{const o=record(v);return{playerId:reqText(o,"playerId"),catalogId:reqText(o,"catalogId")};};
export const parseAuctionBid=(v:unknown)=>{const o=record(v);return{assetId:reqText(o,"assetId"),amount:money(o.amount)};};
export const parseRestoreBankruptcy=(v:unknown)=>{const o=record(v);return{playerId:reqText(o,"playerId")};};
export const parseLegacyOffer=(v:unknown)=>{const o=record(v);return{to:reqText(o,"to"),assetId:reqText(o,"assetId")};};

export const parseRoomName=(v:unknown)=>{const o=record(v);return{name:reqText(o,"name",50)};};
export const parseInitialDistributionAdmin=(v:unknown)=>{const o=record(v);return{playerId:reqText(o,"playerId"),catalogId:reqText(o,"catalogId")};};
export const parseHouseAuctionBid=(v:unknown)=>{const o=record(v);return{assetId:reqText(o,"assetId"),amount:money(o.amount)};};
