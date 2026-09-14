import crypto from "node:crypto";
import type { PropertyData } from "./catalog.js";

export const INITIAL_BALANCE = 2_558_000;
export const START_BONUS = 200_000;
export const JAIL_FINE = 50_000;
export const HOUSE_STOCK = 80;

export function rollDice(randomInt = crypto.randomInt) {
  const first = randomInt(1, 7), second = randomInt(1, 7);
  return { first, second, sum: first + second, doubles: first === second };
}
export function organizationFee(diceSum:number, multiplier:number, ownsAll:boolean) {
  if (!Number.isInteger(diceSum) || diceSum < 2 || diceSum > 12) throw Error("Soma dos dados inválida.");
  return diceSum * multiplier * (ownsAll ? 2 : 1);
}
export function mortgageRedeemCost(mortgage:number, interest=0.20) { return Math.ceil(mortgage * (1 + interest)); }
export function developmentCost(property:PropertyData, from:number, to:number, housesBeforeCondo=4) {
  if (from === to) return 0;
  if (to === 5 && from === housesBeforeCondo) return property.condominiumCost;
  if (from === 5 && to === housesBeforeCondo) return -Math.floor(property.condominiumCost / 2);
  if (to === from + 1 && to <= 4) return property.houseCost;
  if (to === from - 1 && from <= 4) return -Math.floor(property.houseCost / 2);
  throw Error("A construção deve avançar ou recuar um nível permitido por operação.");
}
export function validateBalancedDevelopment(levels:number[], targetIndex:number, targetLevel:number) {
  const next = [...levels]; next[targetIndex] = targetLevel;
  if (next.length && Math.max(...next) - Math.min(...next) > 1) throw Error("As construções do grupo devem permanecer distribuídas uniformemente.");
  return true;
}
