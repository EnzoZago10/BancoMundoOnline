import { Player, State } from "../src/state.ts";
import { OFFICIAL_RULES } from "../src/domain/ruleset.ts";

export function stateWithPlayers(...ids:string[]) {
  const state=new State(); state.saveCode="TEST0001"; Object.assign(state.rules,OFFICIAL_RULES);
  for(const id of ids){const p=new Player();p.id=id;p.name=id.toUpperCase();p.balance=2_558_000;state.players.set(id,p);}
  state.hostId=ids[0]||""; return state;
}

export function fakeClient(sessionId:string){
  const messages:any[]=[];
  return {sessionId,messages,send(type:string,data:any){messages.push({type,data});}} as any;
}
