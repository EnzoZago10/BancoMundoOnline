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
