import { JAIL_FINE } from "./rules.js";
export type JailState={jailed:boolean;jailAttempts:number;habeasCorpus:number;balance:number;jailVisiting?:boolean};
export function useHabeasCorpus(p:JailState){if(!p.jailed||p.habeasCorpus<1)throw Error("Habeas Corpus indisponível.");p.habeasCorpus--;p.jailed=false;p.jailAttempts=0;p.jailVisiting=false;}
export function failedJailRoll(p:JailState){if(!p.jailed)throw Error("Jogador não está preso.");p.jailAttempts++;return p.jailAttempts>=3;}
export function canPayJailFine(p:JailState, allowEarly=false){if(!p.jailed)throw Error("Jogador não está preso.");if(allowEarly){if(p.jailAttempts<1)throw Error("A fiança antecipada só pode ser paga após pelo menos uma tentativa/rodada sem sucesso.");}else if(p.jailAttempts<3)throw Error("Fiança obrigatória apenas após a terceira tentativa.");return true;}
export function releaseFromJail(p:JailState){p.jailed=false;p.jailAttempts=0;p.jailVisiting=false;}
export function payJailFine(p:JailState, fine=JAIL_FINE, allowEarly=false){canPayJailFine(p,allowEarly);if(p.balance<fine)throw Error("Saldo insuficiente.");p.balance-=fine;releaseFromJail(p);}
export const payThirdAttemptFine = (p:JailState) => payJailFine(p, JAIL_FINE, false);
