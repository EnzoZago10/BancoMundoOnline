import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "../src/domain/game-engine.ts";
import { calculateHousesRemaining, calculateUsedHouses, validateGameInvariants } from "../src/domain/invariants.ts";
import { stateWithPlayers } from "./helpers.ts";

test("estoque derivado sempre soma 80 no ruleset oficial", () => {
  const s = stateWithPlayers("a", "b");
  const g = new GameEngine(s);
  s.rules.requireFullGroupForBuilding = false;
  s.rules.requireEvenBuilding = false;

  const a = g.purchaseAsset("a", "cidade-cabo");
  for (let i = 1; i <= 4; i++) g.changeDevelopment("a", a.id, i);

  assert.equal(calculateUsedHouses(s), 4);
  assert.equal(calculateHousesRemaining(s), 76);
  assert.equal(s.housesRemaining + calculateUsedHouses(s), 80);
  validateGameInvariants(s);
});

test("invariantes detectam saldo inválido e host/turno inexistentes", () => {
  const s = stateWithPlayers("a");
  s.players.get("a")!.balance = Number.NaN;
  s.hostId = "ghost";
  s.turnOrder.push("ghost");

  assert.throws(
    () => validateGameInvariants(s),
    /INVALID_BALANCE.*INVALID_HOST|INVALID_HOST.*INVALID_BALANCE/,
  );
});

test("invariantes detectam sobrecomprometimento de peças", () => {
  const s = stateWithPlayers("a");
  s.players.get("a")!.balance = 100_000_000;
  s.rules.requireFullGroupForBuilding = false;
  s.rules.requireEvenBuilding = false;
  const g = new GameEngine(s);

  const ids = [
    "cidade-cabo", "cairo", "luanda", "sao-jose", "pequim", "toquio", "seul",
    "londres", "berlim", "paris", "doha", "abu-dhabi", "riade", "santiago",
    "montevideu", "buenos-aires", "cidade-mexico",
  ];

  // Primeiro compra todos os títulos em um estado válido. Só depois montamos
  // propositalmente um estado impossível (17 condomínios = 85 peças) para
  // testar se o checker o rejeita. Alterar development entre compras faria o
  // próprio purchaseAsset detectar o mismatch antes de o cenário estar pronto.
  const assets = ids.map((id) => g.purchaseAsset("a", id));
  for (const asset of assets) asset.development = 5;
  s.housesRemaining = 0;

  assert.throws(
    () => validateGameInvariants(s),
    /HOUSE_STOCK_OVERCOMMITTED/,
  );
});
