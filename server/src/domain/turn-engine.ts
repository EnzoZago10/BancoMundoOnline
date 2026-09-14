import { rollDice } from "./rules.js";
export type TurnPhase = "WAITING_FOR_ROLL"|"MOVING"|"RESOLVING_SPACE"|"OPTIONAL_ACTIONS"|"END_TURN"|"JAILED";
export type TurnState = { currentPlayerId:string; phase:TurnPhase; consecutiveDoubles:number; die1:number; die2:number; jailed:boolean };
export function rollForTurn(state:TurnState, playerId:string, randomInt?:typeof import("node:crypto").randomInt) {
  if(state.currentPlayerId!==playerId) throw Error("Não é a vez deste jogador.");
  if(state.phase!=="WAITING_FOR_ROLL" && state.phase!=="JAILED") throw Error("Ação incompatível com a fase atual.");
  const dice=rollDice(randomInt); state.die1=dice.first; state.die2=dice.second;
  if(state.phase==="JAILED") return dice;
  state.consecutiveDoubles=dice.doubles?state.consecutiveDoubles+1:0;
  if(state.consecutiveDoubles>=3){state.jailed=true;state.phase="JAILED";state.consecutiveDoubles=0;return {...dice,sentToJail:true};}
  state.phase="MOVING"; return {...dice,sentToJail:false};
}
export function finishTurn(state:TurnState, rolledDoubles:boolean){ if(state.phase==="JAILED") return; state.phase=rolledDoubles?"WAITING_FOR_ROLL":"END_TURN"; if(!rolledDoubles) state.consecutiveDoubles=0; }
