import { catalogById } from "./catalog.js";
import { HOUSE_STOCK } from "./rules.js";
import type { State } from "../state.js";

export function housePiecesForDevelopment(development:number,housesBeforeCondo=4){if(!Number.isInteger(development)||development<0||development>5)throw Error(`development inválido: ${development}`);return development===5?housesBeforeCondo+1:development;}
export function calculateUsedHouses(state:State){let used=0;for(const player of state.players.values())for(const asset of player.assets)if(asset.kind==="property")used+=housePiecesForDevelopment(asset.development,state.rules.housesBeforeCondo);return used;}
export function calculateHousesRemaining(state:State){return Math.max(0,HOUSE_STOCK-calculateUsedHouses(state));}
export type InvariantIssue={code:string;message:string};

export function collectGameInvariantIssues(state:State):InvariantIssue[]{
  const issues:InvariantIssue[]=[],ids=new Set(state.players.keys()),ownership=new Map<string,string>();
  if(state.players.size>6)issues.push({code:"TOO_MANY_PLAYERS",message:"A partida possui mais de 6 jogadores."});
  if(state.players.size&&(!state.hostId||!ids.has(state.hostId)))issues.push({code:"INVALID_HOST",message:"hostId referencia jogador inexistente."});
  if(!Number.isInteger(state.housesRemaining)||state.housesRemaining<0||state.housesRemaining>HOUSE_STOCK)issues.push({code:"INVALID_HOUSE_STOCK",message:"housesRemaining fora de 0..80."});
  for(const[id,p]of state.players){
    for(const [name,value] of [["balance",p.balance],["sent",p.sent],["received",p.received],["bankOps",p.bankOps],["habeasCorpus",p.habeasCorpus]] as const)if(!Number.isFinite(value)||value<0)issues.push({code:name==="balance"?"INVALID_BALANCE":"INVALID_PLAYER_COUNTER",message:`${name} inválido para ${id}.`});
    if(!Number.isInteger(p.jailAttempts)||p.jailAttempts<0)issues.push({code:"INVALID_JAIL_ATTEMPTS",message:`jailAttempts inválido para ${id}.`});
    for(const asset of p.assets){
      if(!catalogById.has(asset.catalogId))issues.push({code:"UNKNOWN_ASSET",message:`Patrimônio desconhecido no catálogo atual: ${asset.catalogId}.`});
      if(!Number.isInteger(asset.development)||asset.development<0||asset.development>5)issues.push({code:"INVALID_DEVELOPMENT",message:`development fora de 0..5 em ${asset.catalogId}.`});
      if(state.rules.housesBeforeCondo===3&&asset.development===4)issues.push({code:"INVALID_OPTIONAL_DEVELOPMENT",message:`${asset.catalogId} possui 4 casas em ruleset que converte 3 casas diretamente em condomínio.`});
      const owner=ownership.get(asset.catalogId);if(owner&&owner!==id)issues.push({code:"DUPLICATE_OWNER",message:`${asset.catalogId} possui dois proprietários.`});ownership.set(asset.catalogId,id);
    }
  }
  const used=calculateUsedHouses(state),expected=calculateHousesRemaining(state);if(state.rules.limitedHouseStock&&used>HOUSE_STOCK)issues.push({code:"HOUSE_STOCK_OVERCOMMITTED",message:`Construções usam ${used} peças para um estoque físico de ${HOUSE_STOCK}.`});if(state.rules.limitedHouseStock&&state.housesRemaining!==expected)issues.push({code:"HOUSE_STOCK_MISMATCH",message:`Estoque incompatível: salvo=${state.housesRemaining}, derivado=${expected}.`});
  for(const id of state.turnOrder)if(!ids.has(id))issues.push({code:"INVALID_TURN_ORDER",message:`turnOrder referencia jogador inexistente: ${id}.`});
  if(state.currentPlayerId&&!ids.has(state.currentPlayerId))issues.push({code:"INVALID_CURRENT_PLAYER",message:"currentPlayerId inexistente."});
  if(state.winnerId&&!ids.has(state.winnerId))issues.push({code:"INVALID_WINNER",message:"winnerId inexistente."});
  if(state.requiredActionPlayerId&&!ids.has(state.requiredActionPlayerId))issues.push({code:"INVALID_REQUIRED_ACTION_PLAYER",message:"Ação obrigatória referencia jogador inexistente."});
  if(state.requiredLiabilityId&&!state.liabilities.has(state.requiredLiabilityId))issues.push({code:"INVALID_REQUIRED_LIABILITY",message:"Ação obrigatória referencia Liability inexistente."});
  if(state.rules.timedGame&&state.gameStarted&&state.durationMs<=0)issues.push({code:"INVALID_TIMER",message:"Partida com tempo deve possuir duração positiva."});
  const pendingKinds=new Set(["money","bank","asset","bankruptcy"]);for(const q of state.pending.values()){if(!pendingKinds.has(q.kind)||!ids.has(q.fromId)||(q.toId&&!ids.has(q.toId))||!Number.isFinite(q.amount))issues.push({code:"INVALID_PENDING",message:`Pendência ${q.id} é inválida.`});if(q.kind==="asset"&&!catalogById.has(q.catalogId))issues.push({code:"INVALID_PENDING_ASSET",message:`Pendência ${q.id} referencia patrimônio inexistente.`});}
  for(const d of state.debts.values())if(!ids.has(d.debtorId)||!ids.has(d.creditorId)||!Number.isFinite(d.originalAmount))issues.push({code:"INVALID_DEBT",message:`Dívida legada ${d.id} referencia jogador/valor inexistente.`});
  for(const t of state.trades.values()){if(!ids.has(t.proposerId)||!ids.has(t.recipientId))issues.push({code:"INVALID_TRADE",message:`Trade ${t.id} referencia jogador inexistente.`});if(t.proposerHabeasCount<0||t.recipientHabeasCount<0)issues.push({code:"INVALID_TRADE_ITEM",message:`Trade ${t.id} possui Habeas Corpus inválido.`});}
  for(const l of state.liabilities.values()){if(!ids.has(l.debtorId)||(l.creditorType==="PLAYER"&&!ids.has(l.creditorPlayerId)))issues.push({code:"INVALID_LIABILITY",message:`Obrigação ${l.id} referencia jogador inexistente.`});if(!Number.isFinite(l.amount)||!Number.isFinite(l.remaining)||l.amount<0||l.remaining<0||l.remaining>l.amount)issues.push({code:"INVALID_LIABILITY_AMOUNT",message:`Obrigação ${l.id} possui valor inválido.`});}
  for(const s of state.settlements.values())if(!state.liabilities.has(s.liabilityId)||!ids.has(s.debtorId)||!ids.has(s.creditorPlayerId))issues.push({code:"INVALID_SETTLEMENT",message:`Settlement ${s.id} é inválido.`});
  return issues;
}
export function validateGameInvariants(state:State){const issues=collectGameInvariantIssues(state);if(issues.length)throw Error(`GAME_INVARIANT_FAILED: ${issues.map(i=>`${i.code}: ${i.message}`).join(" | ")}`);return true;}
