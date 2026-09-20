import { test, expect } from "@playwright/test";

const browserErrors = new WeakMap();
function watch(page){
  const errors=[];browserErrors.set(page,errors);
  page.on("pageerror",error=>{const text=error.stack||error.message;errors.push(`[pageerror] ${text}`);console.error("[browser pageerror]",text);});
  page.on("console",msg=>{if(msg.type()==="error"){const text=msg.text();errors.push(`[console] ${text}`);console.log(`[browser error] ${text}`);}else if(msg.type()==="warning")console.log(`[browser warning] ${msg.text()}`);});
}
function expectCleanBrowser(page){expect(browserErrors.get(page)||[]).toEqual([]);}
function money(text){return Number(String(text||"").replace(/\D/g,""));}
async function createRoom(page,{name="Alice",preset="classic"}={}){
  watch(page);await page.goto("/");await page.locator("#name").fill(name);
  if(preset==="free")await page.locator("#presetFree").click();
  await page.locator("#create").click();await expect(page.locator("#game")).toBeVisible();await expect(page.locator("#myProfileName")).toContainText(name);
  return (await page.locator("#roomCode").textContent()).split(" • ")[0].trim();
}
async function joinRoom(page,roomId,name="Bob"){
  watch(page);await page.goto("/");await page.locator("#name").fill(name);await page.locator("#code").fill(roomId);await page.locator("#join").click();await expect(page.locator("#game")).toBeVisible();await expect(page.locator("#myProfileName")).toContainText(name);await expect.poll(async()=>money(await page.locator("#balanceHero").textContent())).toBeGreaterThan(0);
}
async function landOn(page,name){
  await page.locator("#openLanded").click();await expect(page.locator("#landedModal")).toBeVisible();await page.locator("#landedSearch").fill(name);const row=page.locator("#landedList .search-result").filter({hasText:name}).first();await expect(row).toBeVisible();await row.click();
}
async function requestPurchase(page,name){
  await landOn(page,name);await expect(page.locator("#landedContext [data-context-buy]")).toBeVisible();await page.locator("#landedContext [data-context-buy]").click();
}

// Compra: jogador solicita, ADM aprova, só então patrimônio/saldo mudam.
test("compra simples continua transparente: jogador solicita e ADM aprova",async({page,browser})=>{
  const roomId=await createRoom(page,{name:"Alice"});
  const second=await browser.newContext();const bob=await second.newPage();await joinRoom(bob,roomId,"Bob");
  const before=money(await bob.locator("#balanceHero").textContent());
  await requestPurchase(bob,"Londres");
  await expect(page.locator("#pendingCard")).toBeVisible();await expect(page.locator("#pending")).toContainText(/Bob quer comprar Londres/i);await expect(page.locator("#pending")).toContainText(/240\.000/);
  await expect(bob.locator('.tab[data-tab="assets"]')).toBeVisible();await bob.locator('.tab[data-tab="assets"]').click();await expect(bob.locator('#myAssets .asset').filter({hasText:"Londres"})).toHaveCount(0);
  await page.locator("#pending [data-y]").first().click();
  await expect(bob.locator('#myAssets .asset').filter({hasText:"Londres"})).toBeVisible();await bob.locator('.tab[data-tab="catalog"]').click();await expect.poll(async()=>money(await bob.locator("#balanceHero").textContent())).toBe(before-240000);
  await expect(page.locator("#recentEvents")).toContainText(/Bob comprou Londres/i);
  expectCleanBrowser(page);expectCleanBrowser(bob);await second.close();
});

// Transferência: sem movimentação até o destinatário aceitar.
test("transferência voluntária mostra De/Para/Valor e só movimenta após aceite",async({page,browser})=>{
  const roomId=await createRoom(page,{name:"Alice"});const second=await browser.newContext();const bob=await second.newPage();await joinRoom(bob,roomId,"Bob");
  const beforeA=money(await page.locator("#balanceHero").textContent()),beforeB=money(await bob.locator("#balanceHero").textContent());
  await page.locator("#openTransfer").click();await page.locator("#to").selectOption({label:"Bob"});await page.locator("#amount").fill("100000");await expect(page.locator("#transferPreview")).toContainText(/De:.*Alice.*Para:.*Bob.*Valor:.*100\.000/is);await page.locator("#send").click();
  await expect(page.locator("#pendingCard")).toBeVisible();await expect(page.locator("#pending")).toContainText(/Transferência pendente para Bob/i);await expect(bob.locator("#pendingCard")).toBeVisible();await expect(bob.locator("#pending")).toContainText(/Alice quer transferir 100\.000 para você/i);
  expect(money(await page.locator("#balanceHero").textContent())).toBe(beforeA);expect(money(await bob.locator("#balanceHero").textContent())).toBe(beforeB);
  await bob.locator("#pending [data-y]").first().click();await expect.poll(async()=>money(await page.locator("#balanceHero").textContent())).toBe(beforeA-100000);await expect.poll(async()=>money(await bob.locator("#balanceHero").textContent())).toBe(beforeB+100000);await expect(page.locator("#toast")).toContainText(/Transferência concluída/i);
  expectCleanBrowser(page);expectCleanBrowser(bob);await second.close();
});

test("transferência sem saldo não cria solicitação nem dívida",async({page,browser})=>{
  const roomId=await createRoom(page,{name:"Alice"});const second=await browser.newContext();const bob=await second.newPage();await joinRoom(bob,roomId,"Bob");
  await page.locator("#openTransfer").click();await page.locator("#to").selectOption({label:"Bob"});await page.locator("#amount").fill("999999999");await page.locator("#send").click();await expect(page.locator("#transferError")).toContainText(/Saldo insuficiente/i);await expect(page.locator("#transferModal")).toBeVisible();await expect(page.locator("#pendingCard")).toBeHidden();await expect(page.locator("#debtCard")).toBeHidden();expectCleanBrowser(page);expectCleanBrowser(bob);await second.close();
});

test("pró-labore do Início funciona sem iniciar turnos e depende do ADM",async({page,browser})=>{
  const roomId=await createRoom(page,{name:"Alice"});const second=await browser.newContext();const bob=await second.newPage();await joinRoom(bob,roomId,"Bob");const before=money(await bob.locator("#balanceHero").textContent());
  await expect(bob.locator("#turnTitle")).toContainText(/Partida pronta/i);await bob.locator('.tab[data-tab="rules"]').click();await bob.locator("#openFinancialMore").click();await expect(bob.locator("#start")).toContainText(/Passei pelo Início/i);await bob.locator("#start").click();
  await expect(page.locator("#pendingCard")).toBeVisible();await expect(page.locator("#pending")).toContainText(/Bob solicita o pró-labore do Início/i);await page.locator("#pending [data-y]").first().click();await bob.locator('.tab[data-tab="catalog"]').click();await expect.poll(async()=>money(await bob.locator("#balanceHero").textContent())).toBe(before+200000);await expect(bob.locator("#toast")).toContainText(/Pró-labore.*aprovado/i);expectCleanBrowser(page);expectCleanBrowser(bob);await second.close();
});

test("Construção livre fica simples e uniformidade continua independente",async({page})=>{
  await createRoom(page,{preset:"free"});await page.locator('.tab[data-tab="rules"]').click();await expect(page.locator("#roomRulesSummary")).toContainText(/Grupo completo para construir.*NÃO/is);await expect(page.locator("#roomRulesSummary")).toContainText(/Construção uniforme.*SIM/is);
  await page.locator('.tab[data-tab="catalog"]').click();await requestPurchase(page,"Londres");await page.locator("#pending [data-y]").first().click();await page.locator("#openBuild").click();const london=page.locator('#buildList .build-row').filter({hasText:"Londres"});await expect(london.locator("button")).toBeVisible();await london.locator("button").click();await page.locator("#buildClose").click();await requestPurchase(page,"Berlim");await page.locator("#pending [data-y]").first().click();await page.locator("#openBuild").click();const londonAfter=page.locator('#buildList .build-row').filter({hasText:"Londres"});const berlin=page.locator('#buildList .build-row').filter({hasText:"Berlim"});await expect(berlin.locator("button")).toBeVisible();await expect(londonAfter.locator("button")).toHaveCount(0);expectCleanBrowser(page);
});



test("patrimônio: venda voluntária ao banco passa pelo ADM e título volta ao mercado",async({page,browser})=>{
  const roomId=await createRoom(page,{name:"Alice"});const second=await browser.newContext();const bob=await second.newPage();await joinRoom(bob,roomId,"Bob");
  await requestPurchase(bob,"Londres");await expect(page.locator("#pending")).toContainText(/Bob quer comprar Londres/i);await page.locator("#pending [data-y]").first().click();
  await bob.locator('.tab[data-tab="assets"]').click();const card=bob.locator('#myAssets .asset').filter({hasText:"Londres"});await expect(card).toBeVisible();const before=money(await bob.locator("#summaryBalance").textContent());
  await card.locator('[data-bank-sell]').click();await expect(bob.locator("#assetSellModal")).toBeVisible();await expect(bob.locator("#assetSellSummary")).toContainText(/Londres/);await expect(bob.locator("#assetSellSummary")).toContainText(/240\.000/);await bob.locator("#assetSellConfirm").click();
  await expect(page.locator("#pendingCard")).toBeVisible();await expect(page.locator("#pending")).toContainText(/Bob quer vender Londres(?:\s*-\s*Inglaterra)? ao banco/i);await page.locator("#pending [data-y]").first().click();await expect(card).toHaveCount(0);await expect.poll(async()=>money(await bob.locator("#summaryBalance").textContent())).toBe(before+240000);
  await page.locator('.tab[data-tab="catalog"]').click();await requestPurchase(page,"Londres");await expect(page.locator("#pending")).toContainText(/Alice quer comprar Londres/i);await page.locator("#pending [data-y]").first().click();await page.locator('.tab[data-tab="assets"]').click();await expect(page.locator('#myAssets .asset').filter({hasText:"Londres"})).toBeVisible();
  expectCleanBrowser(page);expectCleanBrowser(bob);await second.close();
});

test("patrimônio: Transferir reutiliza negociação, exige aceite e mantém saldos",async({page,browser})=>{
  const roomId=await createRoom(page,{name:"Alice"});const second=await browser.newContext();const bob=await second.newPage();await joinRoom(bob,roomId,"Bob");
  await requestPurchase(bob,"Londres");await page.locator("#pending [data-y]").first().click();await bob.locator('.tab[data-tab="assets"]').click();const card=bob.locator('#myAssets .asset').filter({hasText:"Londres"});await expect(card).toBeVisible();const beforeAlice=money(await page.locator("#summaryBalance").textContent()),beforeBob=money(await bob.locator("#summaryBalance").textContent());
  await card.locator('[data-asset-transfer]').click();await expect(bob.locator("#assetTransferModal")).toBeVisible();await bob.locator("#assetTransferRecipient").selectOption({label:"Alice"});await expect(bob.locator("#assetTransferModal")).toContainText(/Nenhum dinheiro será movimentado/i);await bob.locator("#assetTransferConfirm").click();
  await expect(page.locator("#pendingCard")).toBeVisible();await expect(page.locator("#pending")).toContainText(/Bob quer transferir Londres(?:\s*-\s*Inglaterra)? para você/i);await expect(card).toBeVisible();await page.locator("#pending [data-trade-y]").click();await expect(card).toHaveCount(0);await page.locator('.tab[data-tab="assets"]').click();await expect(page.locator('#myAssets .asset').filter({hasText:"Londres"})).toBeVisible();expect(money(await page.locator("#summaryBalance").textContent())).toBe(beforeAlice);expect(money(await bob.locator("#summaryBalance").textContent())).toBe(beforeBob);
  expectCleanBrowser(page);expectCleanBrowser(bob);await second.close();
});

test("backup do ADM baixa o estado atual e pode ser restaurado pela Home antes de entrar",async({page})=>{
  await createRoom(page,{name:"Alice"});
  await page.locator('.tab[data-tab="rules"]').click();await page.locator("#adminDetails summary").click();await expect(page.locator("#backup")).toBeVisible();
  const downloadPromise=page.waitForEvent("download");await page.locator("#backup").click();const download=await downloadPromise;expect(download.suggestedFilename()).toMatch(/BancoMundo-.*-v0\.9\.3\.json/);const backupPath=await download.path();expect(backupPath).toBeTruthy();await expect(page.locator("#toast")).toContainText(/Backup baixado com sucesso/i);
  const preflight=await page.request.fetch("http://127.0.0.1:2567/api/import",{method:"OPTIONS",headers:{Origin:"http://127.0.0.1:5173","Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"content-type,x-room-pin"}});expect(preflight.status()).toBe(204);expect(preflight.headers()["access-control-allow-headers"]||"").toMatch(/x-room-pin/i);
  await page.goto("/");await expect(page.locator("#lobbyBackupCard")).toBeVisible();await page.locator("#lobbyImportFile").setInputFiles(backupPath);await page.locator("#lobbyImportPin").fill("5678");await page.locator("#lobbyImportBackup").click();await expect(page.locator("#lobbyImportResult")).toContainText(/Backup restaurado com sucesso/i);await expect(page.locator("#lobbyImportResult")).toContainText(/Código da nova partida/i);
  const enter=page.locator("#lobbyImportResult button").filter({hasText:"Entrar como Alice"});await expect(enter).toBeVisible();await enter.click();await expect(page.locator("#game")).toBeVisible();await expect(page.locator("#myProfileName")).toContainText("Alice");await expect(page.locator("#summaryRoom")).toContainText(/Pausada/i);
  await page.locator('.tab[data-tab="rules"]').click();await page.locator("#adminDetails summary").click();await expect(page.locator("#pause")).toContainText(/Retomar partida/i);await page.locator("#pause").click();await expect(page.locator("#summaryRoom")).toContainText(/Aberta/i);expectCleanBrowser(page);
});

test("PWA usa prompt nativo quando beforeinstallprompt existe e oculta CTA após appinstalled",async({page})=>{
  watch(page);await page.goto("/");await expect(page.locator("#installApp")).toBeVisible();
  await page.evaluate(()=>{window.__installPromptCalls=0;const event=new Event("beforeinstallprompt");Object.defineProperty(event,"prompt",{value:async()=>{window.__installPromptCalls++;}});Object.defineProperty(event,"userChoice",{value:Promise.resolve({outcome:"accepted"})});window.dispatchEvent(event);});
  await page.locator("#installApp").click();await expect.poll(()=>page.evaluate(()=>window.__installPromptCalls)).toBe(1);await page.evaluate(()=>window.dispatchEvent(new Event("appinstalled")));await expect(page.locator("#installApp")).toBeHidden();await expect(page.locator("#toast")).toContainText(/instalado com sucesso/i);expectCleanBrowser(page);
});

test("PWA Android mantém instalação acessível sem beforeinstallprompt e mostra fallback",async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},userAgent:"Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36"});const page=await context.newPage();watch(page);await page.goto("/");await expect(page.locator("#installApp")).toBeVisible();await page.locator("#installApp").click();await expect(page.locator("#installHelpModal")).toBeVisible();await expect(page.locator("#installHelpContent")).toContainText(/menu do navegador/i);await expect(page.locator("#installHelpContent")).toContainText(/Adicionar à tela inicial|Instalar aplicativo/i);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);expectCleanBrowser(page);await context.close();
});

test("PWA iOS orienta Adicionar à Tela de Início sem depender de prompt nativo",async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"});const page=await context.newPage();watch(page);await page.goto("/");await page.locator("#installApp").click();await expect(page.locator("#installHelpModal")).toBeVisible();await expect(page.locator("#installHelpContent")).toContainText(/Compartilhar/);await expect(page.locator("#installHelpContent")).toContainText(/Adicionar à Tela de Início/);expectCleanBrowser(page);await context.close();
});

test("PWA em modo standalone não mostra ação de instalar",async({page})=>{
  await page.addInitScript(()=>{const native=window.matchMedia.bind(window);window.matchMedia=(query)=>query.includes("display-mode: standalone")?{matches:true,media:query,onchange:null,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return true;}}:native(query);});watch(page);await page.goto("/");await expect(page.locator("#installApp")).toBeHidden();expectCleanBrowser(page);
});

test.describe("mobile 390x844",()=>{
  test.use({viewport:{width:390,height:844}});
  test("home e partida cabem sem navegação horizontal e ações principais ficam visíveis",async({page})=>{
    watch(page);await page.goto("/");await expect(page.locator("#ruleFullGroup")).toBeHidden();await expect(page.locator("#create")).toBeVisible();await expect(page.locator("#installApp")).toBeVisible();const homeText=await page.locator("body").innerText();expect(homeText).not.toMatch(/SOURCE_MISSING|LEGACY_UNVERIFIED|APP_BEHAVIOR|Transaction Integrity|Game Engine/);await page.locator("#name").fill("Mobile");await page.locator("#create").click();await expect(page.locator("#game")).toBeVisible();await expect(page.locator(".tabs .tab")).toHaveCount(4);await expect(page.locator("#openLanded")).toBeVisible();await expect(page.locator("#openTransfer")).toBeVisible();await expect(page.locator("#openBuild")).toBeVisible();const noHorizontalScroll=await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);expect(noHorizontalScroll).toBe(true);await page.locator("#openLanded").click();const box=await page.locator("#landedModal .modalbox").boundingBox();expect(box.width).toBeLessThanOrEqual(390);expectCleanBrowser(page);
  });
});
