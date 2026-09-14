const LABELS = {
  money: "Financeiro", bank: "Banco", property: "Patrimônio", organization: "Instituição",
  mortgage: "Hipoteca", development: "Construção", trade: "Negociação", liability: "Obrigação",
  bankruptcy: "Falência", jail: "Cadeia", turn: "Turno", admin: "Administração", security: "Segurança",
  system: "Sistema", fmi: "FMI", start: "Início"
};

export function eventPresentation(event) {
  const category = String(event?.category || "system").toLowerCase();
  return { type: category.replace(/[^a-z0-9_-]/g, "") || "system", label: LABELS[category] || "Sistema" };
}
