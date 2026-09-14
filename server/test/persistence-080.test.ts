import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "../src/domain/game-engine.ts";
import { validateGameInvariants } from "../src/domain/invariants.ts";
import { restore, serialize, migrateSave } from "../src/persistence.ts";
import { stateWithPlayers } from "./helpers.ts";

test("housesRemaining 0 sobrevive serialize + restore", () => {
  const s = stateWithPlayers("a");
  s.players.get("a")!.balance = 100_000_000;
  s.rules.requireFullGroupForBuilding = false;
  s.rules.requireEvenBuilding = false;
  const g = new GameEngine(s);

  const ids = [
    "cidade-cabo", "cairo", "luanda", "sao-jose", "pequim", "toquio", "seul",
    "londres", "berlim", "paris", "doha", "abu-dhabi", "riade", "santiago",
    "montevideu", "buenos-aires",
  ];

  // 16 condomínios no ruleset oficial usam exatamente 80 peças. Compramos os
  // títulos primeiro para não criar um estado temporariamente inconsistente
  // entre chamadas de purchaseAsset(), que valida invariantes imediatamente.
  const assets = ids.map((id) => g.purchaseAsset("a", id));
  for (const asset of assets) asset.development = 5;
  s.housesRemaining = 0;

  // Garante que o cenário salvo é válido antes de testar o bug 0 -> 80.
  validateGameInvariants(s);

  const restored = restore(serialize(s, "hash"));
  assert.equal(restored.housesRemaining, 0);
  validateGameInvariants(restored);
});

test("restore canonicaliza campos financeiros pelo catálogo", () => {
  const s = stateWithPlayers("a");
  const g = new GameEngine(s);
  const a = g.purchaseAsset("a", "londres");
  const raw = serialize(s, "hash");
  raw.state.players.a.assets[0].name = "Londres hack";
  raw.state.players.a.assets[0].purchase = 1;
  raw.state.players.a.assets[0].mortgage = 1;
  raw.state.players.a.assets[0].houseCost = 1;

  const r = restore(raw);
  const x = r.players.get("a")!.assets[0];
  assert.equal(x.name, "Londres - Inglaterra");
  assert.equal(x.purchase, 240000);
  assert.equal(x.mortgage, 120000);
  assert.equal(x.houseCost, 150000);
  assert.equal(x.id, a.id);
});

test("unknown asset é rejeitado, não inventado", () => {
  const s = stateWithPlayers("a");
  const raw = serialize(s, "hash");
  raw.state.players.a.assets = [{ id:"x", catalogId:"hack", development:0, mortgaged:false }];
  assert.throws(() => restore(raw), /Patrimônio desconhecido/);
});

test("imports impossíveis são rejeitados", () => {
  const s = stateWithPlayers("a");
  const raw = serialize(s, "hash");
  raw.state.housesRemaining = -500;
  assert.throws(() => restore(raw), /housesRemaining/);

  const raw2 = serialize(s, "hash");
  raw2.state.hostId = "ghost";
  assert.throws(() => restore(raw2), /INVALID_HOST/);

  const raw3 = serialize(s, "hash");
  raw3.state.players.a.balance = null;
  assert.throws(() => restore(raw3), /saldo/);
});

test("ruleset customizado sobrevive restore", () => {
  const s = stateWithPlayers("a");
  s.rules.preset = "custom";
  s.rules.requireFullGroupForBuilding = false;
  s.rules.requireEvenBuilding = true;
  s.rules.housesBeforeCondo = 3;
  const r = restore(serialize(s, "hash"));
  assert.equal(r.rules.preset, "custom");
  assert.equal(r.rules.requireFullGroupForBuilding, false);
  assert.equal(r.rules.requireEvenBuilding, true);
  assert.equal(r.rules.housesBeforeCondo, 3);
});

test("save legado migra para assisted e ruleset legacy", () => {
  const s = stateWithPlayers("a");
  const raw: any = serialize(s, "hash");
  raw.version = 2;
  delete raw.state.rules;
  const m = migrateSave(raw);
  assert.equal(m.state.mode, "assisted");
  assert.equal(m.state.rules.preset, "legacy");
});
