export const OFFICIAL_RULES = Object.freeze({
  preset: "official",
  requireFullGroupForBuilding: true,
  requireEvenBuilding: true,
  housesBeforeCondo: 4,
  limitedHouseStock: true,
  mortgageRedemptionInterest: 0.20,
  jailFine: 50000,
  allowEarlyJailFine: false,
  startSalary: 200000,
  autoCollectStart: false,
  houseStock: 80,
  useDigitalDice: false,
  alternateLiquidationVictory: false,
  initialPropertyDistribution: false,
  timedGame: false,
  timeLimitMs: 0,
});

export function collectRules(root = document) {
  const bool = (id, fallback) => root.querySelector(`#${id}`)?.checked ?? fallback;
  const num = (id, fallback) => Number(root.querySelector(`#${id}`)?.value ?? fallback);
  const timed = bool("ruleTimedGame", false);
  const minutes = Math.max(5, Math.min(1440, num("ruleTimeMinutes", 60)));
  const data = {
    ...OFFICIAL_RULES,
    requireFullGroupForBuilding: bool("ruleFullGroup", true),
    requireEvenBuilding: bool("ruleEvenBuilding", true),
    housesBeforeCondo: num("ruleCondoAfter", 4) === 3 ? 3 : 4,
    limitedHouseStock: bool("ruleLimitedStock", true),
    allowEarlyJailFine: bool("ruleEarlyJailFine", false),
    autoCollectStart: bool("ruleAutoStart", false),
    useDigitalDice: bool("ruleDigitalDice", false),
    alternateLiquidationVictory: bool("ruleLiquidationVictory", false),
    initialPropertyDistribution: bool("ruleInitialDistribution", false),
    timedGame: timed,
    timeLimitMs: timed ? minutes * 60_000 : 0,
  };
  data.preset = isOfficialRules(data) ? "official" : "custom";
  return data;
}

export function isOfficialRules(rules) {
  const r = rules || {};
  return r.requireFullGroupForBuilding === true && r.requireEvenBuilding === true && Number(r.housesBeforeCondo) === 4 && r.limitedHouseStock === true && Number(r.mortgageRedemptionInterest) === 0.20 && Number(r.jailFine) === 50000 && r.allowEarlyJailFine === false && Number(r.startSalary) === 200000 && r.autoCollectStart === false && Number(r.houseStock) === 80 && r.useDigitalDice === false && r.alternateLiquidationVictory === false && r.initialPropertyDistribution === false && r.timedGame === false;
}

export function applyOfficialRules(root = document) {
  const setChecked = (id, value) => { const el=root.querySelector(`#${id}`); if(el) el.checked=value; };
  const setValue = (id, value) => { const el=root.querySelector(`#${id}`); if(el) el.value=String(value); };
  setChecked("ruleFullGroup", true); setChecked("ruleEvenBuilding", true); setValue("ruleCondoAfter", 4);
  setChecked("ruleLimitedStock", true); setChecked("ruleEarlyJailFine", false); setChecked("ruleAutoStart", false);
  setChecked("ruleDigitalDice", false); setChecked("ruleLiquidationVictory", false); setChecked("ruleInitialDistribution", false); setChecked("ruleTimedGame", false); setValue("ruleTimeMinutes", 60);
}


export function synchronizedRules(source) {
  const state = source?.state || source;
  const snapshot = state?.rulesSnapshot;
  if (typeof snapshot === "string" && snapshot.trim()) {
    try {
      const parsed = JSON.parse(snapshot);
      if (parsed && typeof parsed.requireFullGroupForBuilding === "boolean") return parsed;
    } catch { /* fallback para Schema aninhado */ }
  }
  const nested = state?.rules;
  if (nested && typeof nested.requireFullGroupForBuilding === "boolean") return nested;
  return OFFICIAL_RULES;
}

export function rulesSummary(rules) {
  const r = rules || OFFICIAL_RULES;
  return [
    ["Grupo completo para construir", r.requireFullGroupForBuilding ? "SIM" : "NÃO"],
    ["Construção uniforme", r.requireEvenBuilding ? "SIM" : "NÃO"],
    ["Condomínio", `Após ${Number(r.housesBeforeCondo) === 3 ? 3 : 4} casas`],
    ["Estoque", r.limitedHouseStock ? `${Number(r.houseStock || 80)} casas` : "Ilimitado"],
    ["Hipoteca", `${Math.round(Number(r.mortgageRedemptionInterest ?? .2) * 100)}% de juros`],
    ["Fiança", `${Number(r.jailFine || 50000).toLocaleString("pt-BR")}${r.allowEarlyJailFine ? " • após 1 tentativa" : " • após 3 tentativas"}`],
    ["Pró-labore", `${Number(r.startSalary || 200000).toLocaleString("pt-BR")}${r.autoCollectStart ? " • automático" : " • manual"}`],
    ["Dados digitais", r.useDigitalDice ? "SIM" : "NÃO"],
    ["Distribuição inicial", r.initialPropertyDistribution ? "Habilitada" : "Desabilitada"],
    ["Final por liquidação", r.alternateLiquidationVictory ? "Habilitado" : "Desabilitado"],
    ["Jogo contra o relógio", r.timedGame ? `${Math.round(Number(r.timeLimitMs || 0)/60000)} min` : "Desabilitado"],
  ];
}
