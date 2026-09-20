# Changelog
### 0.9.3 FIX9 — manutenção do teste CORS

- FIX10: perfis de backup restaurado entram diretamente pelo `resumeCode`, evitando uma tentativa `joinById` com o código permanente e o erro transitório Colyseus 522 no console.
- Atualiza a regressão herdada da FIX6 para validar a configuração CORS centralizada usada pela FIX8 (`corsAllowedHeaders`), sem exigir a forma literal antiga de `allowedHeaders`.
- Não altera a lógica de backup/restauração, regras do jogo, banco, migrations, PWA, Save Format ou Protocol Version.

### 0.9.3 FIX8 — CORS Colyseus e restauração robusta
- Alinha `matchMaker.controller.DEFAULT_CORS_HEADERS` do Colyseus com o CORS da API, incluindo `X-Room-Pin` no preflight que realmente responde na porta compartilhada.
- Mantém a allowlist de origens também na camada de matchmaking.
- A restauração pela Home envia o novo PIN dentro do JSON (`{ backup, pin }`), preservando compatibilidade com o header legado no servidor e removendo a dependência do frontend em header customizado.
- O E2E continua verificando o preflight real e agora restaura também com PIN não vazio.

### 0.9.3 FIX7 — preflight de restauração de backup
- Responde explicitamente `OPTIONS` para as APIs HTTP com `Access-Control-Allow-Headers: Content-Type, X-Room-Pin`, preservando a allowlist de origens.
- A importação não envia `X-Room-Pin` quando o PIN está vazio, evitando preflight desnecessário por header customizado.
- Playwright não reutiliza servidores locais antigos; o E2E de backup verifica também a resposta real do preflight.


### FIX6 — restauração de backup pela Home

- Corrige o preflight CORS de `POST /api/import` para permitir explicitamente o header `X-Room-Pin`, usado pela restauração de backup antes de entrar na partida.
- Mantém o fluxo da FIX5: backup ativo pela sala autenticada, restauração pela Home, escolha de perfil e retomada da partida.
- Adiciona teste de regressão para impedir que o header volte a ser bloqueado pelo CORS.


Este arquivo registra apenas mudanças significativas do projeto. Micro-fixes, resultados temporários de comandos e relatórios de entrega não são mantidos como documentação permanente.

## 0.9.3 — Patrimônio, Transferências, PWA e Transparência

- venda voluntária de propriedades e instituições ao banco com aprovação do ADM, valor canônico e revalidação no aceite;
- títulos vendidos voltam a ficar sem proprietário e podem ser comprados novamente;
- ação **Transferir** no Patrimônio reutiliza o Trade existente com dinheiro zero e confirmação do destinatário;
- cards de Patrimônio exibem valores, hipoteca, construções e somente ações compatíveis com o estado atual;
- proteção contra dupla execução e conflitos entre pendências/negociações foi reforçada;
- instalação PWA passou a ter prompt nativo quando disponível e fallback orientado para iOS, Android e outros navegadores;
- cache da PWA atualizado para 0.9.3, mantendo a proteção contra reload no primeiro `clients.claim()`;
- Playwright atualizado para 1.63.0, Node 22 declarado em `engines` e GitHub Actions atualizadas para `checkout@v7`/`setup-node@v7`;
- dependências transitivas de produção `nanoid` e `qs` foram fixadas em versões corrigidas (`3.3.19` e `6.16.0`) para eliminar advisories conhecidos;
- Save Format permanece 4 e Protocol Version permanece 3; nenhuma migration de banco foi necessária.
- FIX4: `.gitignore` restaurado para artefatos locais, tipos alinhados ao Node 22, destinatários elegíveis de negociação centralizados, categoria de venda invalidada corrigida, Settlement protegido contra patrimônio já comprometido e audit de produção obrigatório na CI.
- FIX5: backup do ADM passou a ser gerado a partir do estado ativo e salvo da sala, com download robusto no navegador; restauração de backup agora está disponível diretamente na Home antes de entrar, permite escolher o perfil recuperado e retomar cópias importadas com segurança.

## 0.9.2 — Practical & Transparent Actions

- transferências voluntárias continuam pendentes até aceite do destinatário e nunca viram dívida por falta de saldo;
- pedidos de transferência exibem origem, destino e valor e podem ser cancelados antes da resposta;
- compras continuam usando preço canônico e só alteram patrimônio após aprovação do ADM;
- solicitações e respostas de transferência/compra ganharam eventos explícitos no histórico;
- pró-labore do Início passou a ser solicitado ao ADM sem depender do turn tracker;
- turn tracker permanece opcional para o uso normal como banco/patrimônio;
- comentário do protocolo compartilhado deixou de carregar referência fixa de versão.

## 0.9.1 — Simple & Fast UX

- interface reorganizada para uso rápido ao lado do tabuleiro físico;
- criação e entrada de sala simplificadas;
- PIN opcional e recovery contextual;
- presets **Clássico**, **Construção livre** e **Personalizar**;
- navegação principal reduzida a **Jogo**, **Patrimônio**, **Jogadores** e **Mais**;
- ação unificada `Caí em...` para propriedades e instituições;
- aprovações, dívidas, cadeia, leilão e outras ações raras passaram a aparecer contextualmente;
- experiência mobile-first com navegação inferior;
- renderização do cliente endurecida para hidratação incremental do Schema Colyseus;
- documentação histórica consolidada nos documentos canônicos atuais.

## 0.9.0 — Assisted Gameplay & Transaction Integrity

- pipeline único para pagamentos obrigatórios, sem saldo negativo por obrigação;
- aluguel, instituições, cadeia, dados assistidos e turnos integrados ao GameEngine;
- `Liability` e Central de Liquidez para falta de caixa;
- Trade e Settlement atômicos, com revalidação e rollback;
- Habeas Corpus negociável, leilão de casas, jogo com tempo e final alternativo;
- persistência PostgreSQL com CAS por revisão, `SAVE_CONFLICT` e lease distribuído;
- lock de sala compatível com recovery legítimo;
- cliente modularizado e integração/E2E com servidor real.

## 0.8.0 — Integration & Reliability

- `BankRoom` reduzida a lifecycle, autenticação e roteamento;
- GameEngine passou a operar diretamente sobre o State autoritativo;
- Ruleset persistido com grupo completo e construção uniforme independentes;
- catálogo financeiro centralizado e restore canonicalizado;
- Trade, Liability e Settlement separados conceitualmente;
- PIN migrado para scrypt e recovery endurecido;
- persistência por revisão e migrations versionadas;
- Modo Completo explicitamente bloqueado enquanto houver `SOURCE_MISSING`.

## 0.7.0 — Game Engine

- criação da camada `server/src/domain` independente do Colyseus;
- `shared/catalog.json` tornou-se a fonte financeira única;
- compras e operações financeiras passaram a ser server-authoritative;
- `playerId` permanente e recovery por token forte;
- save versionado com revisão e integração PostgreSQL;
- dados ausentes de tabuleiro/cartas passaram a ser marcados explicitamente como fonte faltante.

## Histórico anterior

As versões iniciais estabeleceram o multiplayer, persistência local, backups/importação, hipoteca, administração, redesign responsivo e PWA instalável. Esses marcos permanecem no código atual; microversões e relatórios intermediários não são preservados neste changelog.
