import crypto from "node:crypto";
import type { Client } from "@colyseus/core";
import { Event, Pending, Player, State } from "../state.js";
import { GameEngine } from "../domain/game-engine.js";
import { CommandDispatcher } from "../domain/dispatcher.js";
import { text } from "../domain/commands.js";

export type EventInput={code:string;category:string;type?:string;actorId?:string;targetPlayerId?:string;catalogId?:string;amount?:number;metadata?:Record<string,unknown>;message:string};

export class RoomRuntime {
  readonly engine:GameEngine;
  readonly dispatcher:CommandDispatcher;
  readonly sessionToPlayer=new Map<string,string>();
  readonly processedRequests=new Set<string>();
  private dirty=false;
  constructor(readonly state:State){this.engine=new GameEngine(state);this.dispatcher=new CommandDispatcher(this.engine);}
  markDirty(){this.dirty=true;}
  takeDirty(){const d=this.dirty;this.dirty=false;return d;}
  isDirty(){return this.dirty;}
  playerForSession(sessionId:string){const id=this.sessionToPlayer.get(sessionId);return id?this.state.players.get(id):undefined;}
  me(client:Client){const p=this.playerForSession(client.sessionId);if(!p)throw Error("Jogador inválido.");return p;}
  active(client:Client){const p=this.me(client);if(p.bankrupt||p.spectator){client.send("error","Perfil falido/espectador: operação bloqueada.");return undefined;}return p;}
  isAdmin(client:Client){return this.me(client).id===this.state.hostId;}
  requireAdmin(client:Client){if(!this.isAdmin(client)){client.send("error","Somente o ADM pode realizar esta ação.");return false;}return true;}
  event(input:EventInput){const e=new Event();e.id=crypto.randomUUID();e.seq=++this.state.seq;e.code=input.code;e.category=input.category;e.type=input.type||input.code;e.actorId=input.actorId||"";e.actor=input.actorId?this.state.players.get(input.actorId)?.name||"":"Sistema";e.targetPlayerId=input.targetPlayerId||"";e.catalogId=input.catalogId||"";e.amount=Number.isFinite(input.amount)?Number(input.amount):0;e.metadata=input.metadata?JSON.stringify(input.metadata):"";e.message=input.message;e.at=Date.now();this.state.events.push(e);while(this.state.events.length>250)this.state.events.shift();this.markDirty();return e;}
  pend(kind:string,from:Player,to:Player|undefined,data:Record<string,unknown>){const r=new Pending();r.id=crypto.randomUUID();r.kind=kind;r.fromId=from.id;r.fromName=from.name;r.toId=to?.id||this.state.hostId;r.toName=to?.name||"ADM";r.amount=Number.isFinite(Number(data.amount))?Number(data.amount):0;r.catalogId=text(data.catalogId,80);r.name=text(data.name,100);r.development=0;r.mortgaged=false;r.purchase=Number.isFinite(Number(data.purchase))?Math.max(0,Number(data.purchase)):0;r.houseCost=0;r.condominiumCost=0;r.mortgageValue=Number.isFinite(Number(data.mortgageValue))?Math.max(0,Number(data.mortgageValue)):0;r.reason=text(data.reason,200);r.at=Date.now();this.state.pending.set(r.id,r);this.markDirty();return r;}

}
