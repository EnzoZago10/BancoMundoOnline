import { escapeHtml as esc } from "../ui/safe.js";
import { schemaValues } from "../ui/schema-safe.js";
import { synchronizedRules } from "./ruleset.js";

function commitmentReason(room,asset){
  if(schemaValues(room?.state?.pending).some(q=>q.catalogId===asset.catalogId&&(q.kind==="asset"||q.kind==="bank_sale")))return "Este título já está envolvido em uma solicitação pendente.";
  if(schemaValues(room?.state?.trades).some(t=>schemaValues(t.proposerAssetIds).includes(asset.id)||schemaValues(t.recipientAssetIds).includes(asset.id)))return "Este título já está envolvido em uma negociação.";
  if(schemaValues(room?.state?.settlements).some(s=>schemaValues(s.assetIds).includes(asset.id)))return "Este título já está envolvido em um acordo de dívida.";
  return "";
}
function dispositionReason({room,player,asset,catalog}){
  if(asset.mortgaged)return "Resgate a hipoteca antes de transferir ou vender.";
  if(Number(asset.development)>0)return "Venda as construções antes de transferir ou vender este título.";
  const committed=commitmentReason(room,asset);if(committed)return committed;
  const rules=synchronizedRules(room);
  if(asset.kind==="property"&&rules.requireFullGroupForBuilding){const prop=catalog?.properties?.find(x=>x.id===asset.catalogId);if(prop){const group=catalog.properties.filter(x=>x.group===prop.group);if(group.some(x=>x.id!==asset.catalogId&&schemaValues(player?.assets).some(a=>a.catalogId===x.id&&Number(a.development)>0)))return "Venda as construções do grupo antes de negociar este título.";}}
  return "";
}
function developmentLabel(asset){if(asset.kind!=="property")return "Instituição";if(Number(asset.development)===5)return "Condomínio";if(Number(asset.development)===0)return "nenhuma";return `${asset.development} casa(s)`;}

export function renderAssets({room,$,player,fmt,catalog,onSell,onTransfer}){
  const assets=schemaValues(player?.assets),box=$("#myAssets");if(!box)return;
  box.innerHTML=assets.length?assets.map(a=>{
    const reason=dispositionReason({room,player,asset:a,catalog});
    const canDisposition=!reason;
    const canMortgage=!a.mortgaged&&Number(a.development)===0;
    return `<div class="asset ${a.mortgaged?"mortgaged":""}" data-asset-card="${esc(a.id)}">
      <div class="asset-summary"><strong>${esc(a.name)}</strong><span>${a.kind==="property"?"Propriedade":"Instituição"}</span></div>
      <div class="asset-facts"><span>Valor: <b>${fmt(a.purchase)}</b></span><span>Hipoteca: <b>${fmt(a.mortgage)}</b></span><span>Construções: <b>${esc(developmentLabel(a))}</b></span></div>
      ${a.kind==="property"?`<div class="asset-construction"><span>Gerenciar construções</span><div class="row"><button data-dev="${a.id}" data-v="${Math.max(0,a.development-1)}" ${a.mortgaged||a.development===0?"disabled":""}>−</button><button data-dev="${a.id}" data-v="${Math.min(5,a.development+1)}" ${a.mortgaged||a.development>=5?"disabled":""}>+</button></div></div>`:""}
      <div class="asset-actions">
        ${a.mortgaged?`<button data-mort="${a.id}">Resgatar hipoteca</button>`:canMortgage?`<button data-mort="${a.id}">Hipotecar</button>`:""}
        ${canDisposition?`<button data-bank-sell="${a.id}">Vender ao banco</button><button data-asset-transfer="${a.id}">Transferir</button>`:""}
      </div>
      ${reason?`<div class="small asset-action-reason">${esc(reason)}</div>`:""}
      ${!a.mortgaged&&!canMortgage&&Number(a.development)>0?'<div class="small">Venda as construções antes de hipotecar.</div>':""}
    </div>`;
  }).join(""):'<div class="empty">Nenhum patrimônio.</div>';
  box.querySelectorAll("[data-dev]").forEach(b=>b.onclick=()=>room.send("development",{id:b.dataset.dev,value:Number(b.dataset.v)}));
  box.querySelectorAll("[data-mort]").forEach(b=>b.onclick=()=>{const a=assets.find(x=>x.id===b.dataset.mort);room.send("mortgage",{id:b.dataset.mort,action:a?.mortgaged?"redeem":"mortgage"});});
  box.querySelectorAll("[data-bank-sell]").forEach(b=>b.onclick=()=>{const a=assets.find(x=>x.id===b.dataset.bankSell);if(a)onSell?.(a);});
  box.querySelectorAll("[data-asset-transfer]").forEach(b=>b.onclick=()=>{const a=assets.find(x=>x.id===b.dataset.assetTransfer);if(a)onTransfer?.(a);});
}
