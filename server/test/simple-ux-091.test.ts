import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const clientRoot = path.resolve(process.cwd(), "../client");
const html = fs.readFileSync(path.join(clientRoot, "index.html"), "utf8");
const simpleUx = fs.readFileSync(path.join(clientRoot, "src/features/simple-ux.js"), "utf8");
const session = fs.readFileSync(path.join(clientRoot, "src/features/session.js"), "utf8");
const css = fs.readFileSync(path.join(clientRoot, "src/styles/app.css"), "utf8");

function assertHiddenElement(id: string) {
  const tag = html.match(new RegExp(`<[^>]*\\bid="${id}"[^>]*>`));
  assert.ok(tag, `Elemento #${id} não encontrado.`);
  assert.match(tag[0], /\bclass="[^"]*\bhidden\b[^"]*"/);
}

test("0.9.1 reduz a navegação principal a Jogo, Patrimônio, Jogadores e Mais", () => {
  const tabs = [...html.matchAll(/class="[^"]*\btab\b[^"]*"[^>]*data-tab="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)];
  assert.equal(tabs.length, 4);
  const text = tabs.map((m) => m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).join(" | ");
  assert.match(text, /Jogo/);
  assert.match(text, /Patrimônio/);
  assert.match(text, /Jogadores/);
  assert.match(text, /Mais/);
  assert.doesNotMatch(text, /Aprovações|Dívidas|Histórico|Manual/);
});

test("home oferece criação rápida e presets simples sem expor recovery permanentemente", () => {
  assert.match(html, /id="name"/);
  assert.match(html, /id="create"[^>]*>[\s\S]*?Criar partida/);
  assert.match(html, /id="code"/);
  assert.match(html, /id="join"[^>]*>[\s\S]*?Entrar na partida/);
  assert.match(html, /id="presetClassic"/);
  assert.match(html, /id="presetFree"/);
  assert.match(html, /id="presetCustom"/);
  assertHiddenElement("recoveryJoinBox");
  assertHiddenElement("joinPinWrap");
});

test("preset Construção livre desliga grupo completo e mantém construção uniforme", () => {
  assert.match(simpleUx, /presetFree[^\n]*applyOfficialRules\(document\)[^\n]*setChecked\("ruleFullGroup",false\)/);
  assert.match(simpleUx, /applyOfficialRules\(document\)/);
});

test("criar sala sem proteção não reaproveita PIN antigo", () => {
  assert.match(session, /pin:create\?\(\$\("#protectRoomToggle"\)\?\.checked\?\$\("#pin"\)\.value:""\):\$\("#pin"\)\.value/);
});

test("UX mobile possui navegação inferior e breakpoint de smartphone", () => {
  assert.match(css, /position:fixed/);
  assert.match(css, /bottom:/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /@media\s*\(max-width:\s*390px\)/);
  assert.match(css, /\.action-grid/);
});


test("0.9.2 mantém confirmação de transferência e banco contextual", () => {
  assert.match(html, /id="transferPreview"/);
  assert.match(html, /id="transferError"/);
  assert.match(html, /id="send"[^>]*>[\s\S]*?Enviar solicitação/);
  assert.match(html, /id="openFinancialMore"[^>]*>[\s\S]*?Banco/);
  assert.match(html, /id="start"[^>]*>[\s\S]*?Passei pelo Início/);
  assert.match(html, /Hipotecar ou resgatar patrimônio/);
  assert.match(html, /Resolver dívida com o banco/);
  assert.match(simpleUx, /start_bonus/);
});

test("0.9.3 mantém patrimônio contextual e instalação PWA encontrável",()=>{const assets=fs.readFileSync(path.join(clientRoot,"src/features/assets.js"),"utf8"),shell=fs.readFileSync(path.join(clientRoot,"src/shell.js"),"utf8");assert.match(assets,/Vender ao banco/);assert.match(assets,/Transferir/);assert.match(assets,/Resgatar hipoteca/);assert.match(html,/id="assetSellModal"/);assert.match(html,/id="assetTransferModal"/);assert.match(html,/id="installHelpModal"/);assert.match(shell,/beforeinstallprompt/);assert.match(shell,/Adicionar à Tela de Início/);});

test("0.9.3 fixa Node 22 e preserva Save Format 4 e Protocol 3",()=>{const root=path.resolve(process.cwd(),".."),pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8")),version=fs.readFileSync(path.join(root,"server/src/version.ts"),"utf8"),workflow=fs.readFileSync(path.join(root,".github/workflows/ci.yml"),"utf8");assert.equal(pkg.version,"0.9.3");assert.equal(pkg.engines.node,">=22 <23");assert.equal(pkg.devDependencies["@playwright/test"],"1.63.0");assert.equal(pkg.overrides?.nanoid,"3.3.19");assert.equal(pkg.overrides?.qs,"6.16.0");assert.match(version,/APP_VERSION = "0\.9\.3"/);assert.match(version,/SAVE_FORMAT_VERSION = 4/);assert.match(version,/PROTOCOL_VERSION = 3/);assert.match(workflow,/actions\/checkout@v7/);assert.match(workflow,/actions\/setup-node@v7/);});


test("FIX4 alinha tipos ao Node 22, ignora artefatos locais e audita produção na CI",()=>{
  const root=path.resolve(process.cwd(),".."),serverPkg=JSON.parse(fs.readFileSync(path.join(root,"server/package.json"),"utf8")),ignore=fs.readFileSync(path.join(root,".gitignore"),"utf8"),workflow=fs.readFileSync(path.join(root,".github/workflows/ci.yml"),"utf8");
  assert.match(serverPkg.devDependencies["@types/node"],/^\^22/);
  for(const entry of ["server/dist/","client/dist/","playwright-report/","test-results/","node_modules/"])assert.match(ignore,new RegExp(entry.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.match(workflow,/npm audit --omit=dev/);
  const main=fs.readFileSync(path.join(root,"client/src/main.js"),"utf8");
  assert.match(html,/id="assetTransferAvailability"/);
  assert.match(main,/Nenhum jogador disponível para receber este título\./);
  assert.match(main,/confirm\.disabled=!recipients\.length/);
});


test("FIX5 permite baixar backup ativo e restaurar antes de entrar",()=>{
  const main=fs.readFileSync(path.join(clientRoot,"src/main.js"),"utf8"),backup=fs.readFileSync(path.join(clientRoot,"src/features/backup.js"),"utf8"),binding=fs.readFileSync(path.join(clientRoot,"src/features/room-binding.js"),"utf8"),room=fs.readFileSync(path.resolve(process.cwd(),"src/room.ts"),"utf8");
  assert.match(html,/id="lobbyBackupCard"/);assert.match(html,/id="lobbyImportFile"/);assert.match(html,/id="lobbyImportBackup"/);assert.match(html,/id="lobbyImportResult"/);
  assert.match(main,/room\.send\("backup"\)/);assert.match(main,/resume_room/);assert.match(main,/wakeBackend/);assert.match(backup,/Entrar como/);
  assert.match(binding,/onMessage\("backup"/);assert.match(room,/backup:this\.backup/);assert.match(room,/sanitizeForExport\(serialize\(this\.state,this\.pinHash\)\)/);
  assert.match(backup,/document\.body\.append\(a\)/);assert.match(backup,/onChooseProfile/);assert.doesNotMatch(backup,/if\(!pin\)/);
});


test("FIX6/FIX8 mantém preflight CORS para X-Room-Pin com headers centralizados",()=>{
  const root=path.resolve(process.cwd(),".."),serverIndex=fs.readFileSync(path.join(root,"server/src/index.ts"),"utf8");
  assert.match(serverIndex,/const corsAllowedHeaders=\[[^\]]*"Content-Type"[^\]]*"X-Room-Pin"[^\]]*\]/);
  assert.match(serverIndex,/allowedHeaders:corsAllowedHeaders/);
  assert.match(serverIndex,/matchMaker\.controller\.DEFAULT_CORS_HEADERS\["Access-Control-Allow-Headers"\]=corsAllowedHeadersValue/);
  assert.match(serverIndex,/app\.post\("\/api\/import"/);
});

test("FIX7 responde preflight real e não reutiliza servidor E2E antigo",()=>{
  const root=path.resolve(process.cwd(),".."),serverIndex=fs.readFileSync(path.join(root,"server/src/index.ts"),"utf8"),pw=fs.readFileSync(path.join(root,"client/playwright.config.mjs"),"utf8");
  assert.match(serverIndex,/req\.method!=="OPTIONS"/);
  assert.match(serverIndex,/Access-Control-Allow-Methods/);
  assert.doesNotMatch(pw,/reuseExistingServer: true/);
  assert.match(pw,/reuseExistingServer: false/);
});

test("FIX8 alinha CORS do Colyseus e importa PIN no corpo JSON",()=>{
  const root=path.resolve(process.cwd(),".."),serverIndex=fs.readFileSync(path.join(root,"server/src/index.ts"),"utf8"),backup=fs.readFileSync(path.join(root,"client/src/features/backup.js"),"utf8");
  assert.match(serverIndex,/Server, matchMaker/);
  assert.match(serverIndex,/matchMaker\.controller\.DEFAULT_CORS_HEADERS\["Access-Control-Allow-Headers"\]=corsAllowedHeadersValue/);
  assert.match(serverIndex,/X-Room-Pin/);
  assert.match(serverIndex,/const wrapped=Boolean/);
  assert.match(serverIndex,/wrapped\?q\.body\.pin/);
  assert.match(backup,/JSON\.stringify\(\{backup:raw,pin\}\)/);
  assert.doesNotMatch(backup,/headers\["X-Room-Pin"\]/);
});

test("FIX10 entra diretamente no save restaurado sem gerar 522 de roomId inválido",()=>{
  const root=path.resolve(process.cwd(),".."),main=fs.readFileSync(path.join(root,"client/src/main.js"),"utf8"),session=fs.readFileSync(path.join(root,"client/src/features/session.js"),"utf8");
  assert.match(main,/recoveryCode:profile\.recoveryToken,resumeCode:data\.saveCode/);
  assert.doesNotMatch(main,/recoveryCode:profile\.recoveryToken,roomId:data\.saveCode/);
  assert.match(session,/if\(override\?\.resumeCode\)room=await client\.joinOrCreate\("bank_room",data\)/);
});
