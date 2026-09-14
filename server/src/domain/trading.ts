export type TradableAsset={id:string;development:number;mortgaged:boolean};
export function validateTrade(players:{bankrupt:boolean;jailed:boolean}[], offered:TradableAsset[]){
  if(players.some(p=>p.bankrupt||p.jailed)) throw Error("Jogadores falidos ou presos não podem negociar.");
  if(offered.some(a=>a.development>0)) throw Error("Venda as construções antes de negociar a propriedade.");
  if(offered.some(a=>a.mortgaged)) throw Error("No Banco Mundo Online, patrimônio hipotecado deve ser resgatado antes da negociação (interpretação APP_BEHAVIOR documentada).");
  return true;
}
