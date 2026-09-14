import test from "node:test";import assert from "node:assert/strict";
import { INITIAL_BALANCE,HOUSE_STOCK,mortgageRedeemCost,organizationFee,validateBalancedDevelopment,developmentCost } from "../src/domain/rules.ts";
import { catalog } from "../src/domain/catalog.ts";
test("dinheiro inicial e estoque oficiais",()=>{assert.equal(INITIAL_BALANCE,2558000);assert.equal(HOUSE_STOCK,80);});
test("instituição dobra com as seis",()=>{assert.equal(organizationFee(7,50000,false),350000);assert.equal(organizationFee(7,50000,true),700000);});
test("resgate de hipoteca custa 120%",()=>assert.equal(mortgageRedeemCost(100000),120000));
test("construção uniforme rejeita 2/0/0",()=>assert.throws(()=>validateBalancedDevelopment([1,0,0],0,2)));test("construção uniforme aceita 2/1/1",()=>assert.doesNotThrow(()=>validateBalancedDevelopment([1,1,1],0,2)));
test("venda devolve 50%",()=>{const p=catalog.properties.find(x=>x.id==="londres")!;assert.equal(developmentCost(p,1,0),-75000);});
