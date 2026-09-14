/** Public protocol reference for Banco Mundo Online.
 * Runtime validation is authoritative in server/src/protocol/messages.ts.
 * Financial/rule values are intentionally absent from client commands.
 */
export type PurchaseAssetMessage={catalogId:string;reason?:string};
export type ChangeDevelopmentMessage={id:string;value:0|1|2|3|4|5};
export type MortgageMessage={id:string;action?:"mortgage"|"redeem"};
export type ResolveRentMessage={catalogId:string};
export type ResolveInstitutionMessage={catalogId:string;diceSum:number};
export type PayLiabilityMessage={id:string;amount?:number};
export type SellAssetToBankMessage={id:string;liabilityId:string};
export type TradeMessage={recipientId:string;proposerCash:number;recipientCash:number;proposerAssetIds:string[];recipientAssetIds:string[];proposerHabeasCount:number;recipientHabeasCount:number};
export type TradeResponseMessage={id:string;accept:boolean};
export type SettlementMessage={liabilityId:string;cash:number;assetIds:string[];note?:string};
export type JailActionMessage={action:"send"|"visit"|"failed_roll"|"pay_fine"|"habeas"|"grant_habeas";playerId?:string};
export type BankruptcyMessage={playerId?:string;liabilityId:string};
