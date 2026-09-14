import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { catalog } from "../src/domain/catalog.ts";
test("catálogo possui 22 cidades e 6 instituições",()=>{assert.equal(catalog.properties.length,22);assert.equal(catalog.organizations.length,6);});
test("correções 0.7.0 permanecem canônicas",()=>{const p=(id:string)=>catalog.properties.find(x=>x.id===id)!;assert.equal(p("cidade-cabo").purchase,60000);assert.equal(p("doha").purchase,320000);assert.equal(p("cidade-mexico").purchase,280000);assert.deepEqual(p("wellington").rent,[35000,175000,500000,1100000,1300000,1500000]);assert.equal(p("canberra").name,"Camberra - Austrália");});
test("todos os títulos possuem valores positivos e aluguel completo",()=>{for(const p of catalog.properties){assert.equal(p.rent.length,6,p.name);for(const v of [p.purchase,p.houseCost,p.condominiumCost,p.mortgage,...p.rent])assert.ok(v>0,p.name);}for(const o of catalog.organizations){for(const v of [o.purchase,o.multiplier,o.mortgage])assert.ok(v>0,o.name);}});

test("catálogo inteiro coincide com o snapshot oficial auditado dos 28 títulos", () => {
  const expected = JSON.parse(fs.readFileSync(new URL("./fixtures/official-catalog-expected.json", import.meta.url), "utf8"));
  assert.deepEqual(catalog, expected);
});
