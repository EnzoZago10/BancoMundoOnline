export type LiquidAsset={kind:string;development:number;houseCost:number;condominiumCost:number;mortgaged:boolean;purchase:number};
export function constructionLiquidation(a:LiquidAsset, housesBeforeCondo=4){
  if(a.kind!=="property")return 0;
  if(a.development===5)return Math.floor(a.houseCost/2)*housesBeforeCondo+Math.floor(a.condominiumCost/2);
  return Math.floor(a.houseCost/2)*a.development;
}
export function nominalAssets(assets:LiquidAsset[]){return assets.reduce((sum,a)=>sum+a.purchase,0);}
export function investedValue(assets:LiquidAsset[], housesBeforeCondo=4){return assets.reduce((sum,a)=>sum+(a.kind==="property"?(a.development===5?a.houseCost*housesBeforeCondo+a.condominiumCost:a.houseCost*a.development):0),0);}
export function liquidationValue(balance:number,assets:LiquidAsset[], housesBeforeCondo=4){return balance+assets.reduce((sum,a)=>sum+(a.mortgaged?0:a.purchase)+constructionLiquidation(a,housesBeforeCondo),0);}
