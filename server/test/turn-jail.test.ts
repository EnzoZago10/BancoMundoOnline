import test from "node:test";import assert from "node:assert/strict";
import { rollForTurn } from "../src/domain/turn-engine.ts";
import { failedJailRoll,payThirdAttemptFine,useHabeasCorpus } from "../src/domain/jail.ts";
const doubles=()=>2;
test("terceira dupla envia à cadeia",()=>{const s:any={currentPlayerId:"p",phase:"WAITING_FOR_ROLL",consecutiveDoubles:0,die1:0,die2:0,jailed:false};for(let i=0;i<3;i++){const r:any=rollForTurn(s,"p",doubles as any);if(i<2)s.phase="WAITING_FOR_ROLL";else assert.equal(r.sentToJail,true);}assert.equal(s.jailed,true);});
test("terceira tentativa permite fiança de 50 mil",()=>{const p:any={jailed:true,jailAttempts:0,habeasCorpus:0,balance:100000};failedJailRoll(p);failedJailRoll(p);assert.equal(failedJailRoll(p),true);payThirdAttemptFine(p);assert.equal(p.balance,50000);assert.equal(p.jailed,false);});
test("Habeas Corpus sai da cadeia",()=>{const p:any={jailed:true,jailAttempts:2,habeasCorpus:1,balance:0};useHabeasCorpus(p);assert.equal(p.jailed,false);assert.equal(p.habeasCorpus,0);});
