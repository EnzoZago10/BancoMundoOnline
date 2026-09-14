import { HOUSE_STOCK, JAIL_FINE, START_BONUS } from "./rules.js";

export type RulesPreset = "official" | "custom" | "legacy";
export type GameRulesData = {
  preset: RulesPreset;
  requireFullGroupForBuilding: boolean;
  requireEvenBuilding: boolean;
  housesBeforeCondo: 3 | 4;
  limitedHouseStock: boolean;
  mortgageRedemptionInterest: number;
  jailFine: number;
  allowEarlyJailFine: boolean;
  startSalary: number;
  autoCollectStart: boolean;
  houseStock: number;
  useDigitalDice: boolean;
  alternateLiquidationVictory: boolean;
  initialPropertyDistribution: boolean;
  timedGame: boolean;
  timeLimitMs: number;
};

export const OFFICIAL_RULES: GameRulesData = Object.freeze({
  preset: "official",
  requireFullGroupForBuilding: true,
  requireEvenBuilding: true,
  housesBeforeCondo: 4,
  limitedHouseStock: true,
  mortgageRedemptionInterest: 0.20,
  jailFine: JAIL_FINE,
  allowEarlyJailFine: false,
  startSalary: START_BONUS,
  autoCollectStart: false,
  houseStock: HOUSE_STOCK,
  useDigitalDice: false,
  alternateLiquidationVictory: false,
  initialPropertyDistribution: false,
  timedGame: false,
  timeLimitMs: 0,
});

const bool = (value: unknown, fallback: boolean) => typeof value === "boolean" ? value : fallback;
const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const timeLimit = (value: unknown) => {
  const n = Math.round(finite(value, 0));
  if (!n) return 0;
  return Math.max(5 * 60_000, Math.min(24 * 60 * 60_000, n));
};

export function normalizeRules(input: any, presetHint?: RulesPreset): GameRulesData {
  const requestedPreset: RulesPreset = presetHint === "legacy" || input?.preset === "legacy"
    ? "legacy"
    : input?.preset === "custom"
      ? "custom"
      : "official";
  const official = { ...OFFICIAL_RULES, preset: requestedPreset };
  if (requestedPreset === "official") return official;

  const housesBefore = finite(input?.housesBeforeCondo ?? input?.building?.housesBeforeCondo, 4);
  const interest = finite(input?.mortgageRedemptionInterest ?? input?.mortgage?.redemptionInterest, 0.20);
  const jailFine = finite(input?.jailFine ?? input?.jail?.fine, JAIL_FINE);
  const startSalary = finite(input?.startSalary ?? input?.start?.salary, START_BONUS);
  const timed = bool(input?.timedGame ?? input?.timed?.enabled, false);
  const duration = timeLimit(input?.timeLimitMs ?? input?.timed?.durationMs);

  return {
    preset: requestedPreset,
    requireFullGroupForBuilding: bool(input?.requireFullGroupForBuilding ?? input?.building?.requireFullGroup, true),
    requireEvenBuilding: bool(input?.requireEvenBuilding ?? input?.building?.requireEvenBuilding, true),
    housesBeforeCondo: housesBefore === 3 ? 3 : 4,
    limitedHouseStock: bool(input?.limitedHouseStock ?? input?.building?.limitedHouseStock, true),
    mortgageRedemptionInterest: Math.max(0, Math.min(1, interest)),
    jailFine: Math.max(0, Math.min(1_000_000, Math.round(jailFine))),
    allowEarlyJailFine: bool(input?.allowEarlyJailFine ?? input?.jail?.allowEarlyFine, false),
    startSalary: Math.max(0, Math.min(5_000_000, Math.round(startSalary))),
    autoCollectStart: bool(input?.autoCollectStart ?? input?.start?.autoCollect, false),
    houseStock: HOUSE_STOCK,
    useDigitalDice: bool(input?.useDigitalDice ?? input?.assisted?.digitalDice, false),
    alternateLiquidationVictory: bool(input?.alternateLiquidationVictory ?? input?.victory?.liquidation, false),
    initialPropertyDistribution: bool(input?.initialPropertyDistribution ?? input?.setup?.initialPropertyDistribution, false),
    timedGame: timed,
    timeLimitMs: timed ? (duration || 60 * 60_000) : 0,
  };
}

export function isOfficialRules(rules: GameRulesData) {
  return rules.requireFullGroupForBuilding === OFFICIAL_RULES.requireFullGroupForBuilding
    && rules.requireEvenBuilding === OFFICIAL_RULES.requireEvenBuilding
    && rules.housesBeforeCondo === OFFICIAL_RULES.housesBeforeCondo
    && rules.limitedHouseStock === OFFICIAL_RULES.limitedHouseStock
    && rules.mortgageRedemptionInterest === OFFICIAL_RULES.mortgageRedemptionInterest
    && rules.jailFine === OFFICIAL_RULES.jailFine
    && rules.allowEarlyJailFine === OFFICIAL_RULES.allowEarlyJailFine
    && rules.startSalary === OFFICIAL_RULES.startSalary
    && rules.autoCollectStart === OFFICIAL_RULES.autoCollectStart
    && rules.useDigitalDice === OFFICIAL_RULES.useDigitalDice
    && rules.alternateLiquidationVictory === OFFICIAL_RULES.alternateLiquidationVictory
    && rules.initialPropertyDistribution === OFFICIAL_RULES.initialPropertyDistribution
    && rules.timedGame === OFFICIAL_RULES.timedGame
    && rules.timeLimitMs === OFFICIAL_RULES.timeLimitMs;
}
