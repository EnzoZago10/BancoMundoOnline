# Banco Mundo Online

Banco Mundo Online é um companheiro digital para uma partida física de **Banco Imobiliário Mundo**. A proposta é simples: criar uma sala, chamar os amigos e usar celular ou computador como banco, patrimônio e apoio de regras enquanto o tabuleiro continua na mesa.

A interface atual prioriza ações frequentes e mantém a complexidade no backend. O servidor continua autoritativo para dinheiro, propriedades, construções, hipotecas, negociações, dívidas, cadeia, turnos, regras e persistência.

## Estado atual

- Aplicação: `0.9.2`
- Save format: `4`
- Protocol version: `3`
- Modo principal: **Assistido**, com tabuleiro físico
- PostgreSQL: opcional em desenvolvimento, recomendado em produção/múltiplas réplicas

O **Modo Jogo Completo** permanece indisponível porque a ordem oficial completa do tabuleiro e o conteúdo individual das 32 cartas Sorte-Revés não foram fornecidos de forma confiável. Consulte `RULES-SOURCES.md`.

## Instalação

Requisitos:

- Node.js 22+
- npm 10+
- Chromium do Playwright apenas para os testes E2E
- PostgreSQL 16+ quando a persistência em banco for utilizada

Instale as dependências:

```bash
npm ci
```

## Executar localmente

Terminal 1:

```bash
npm run dev:server
```

Terminal 2:

```bash
npm run dev:client
```

Abra:

```text
http://localhost:5173
```

Por padrão, a API/Colyseus usa a porta `2567`.

## Como jogar

### Criar uma partida

1. informe seu nome;
2. escolha **Clássico**, **Construção livre** ou **Personalizar**;
3. opcionalmente proteja a sala com PIN;
4. clique em **Criar partida**;
5. compartilhe o código da sala.

**Construção livre** desliga apenas a exigência de grupo completo para construir e mantém a construção uniforme habilitada por padrão.

### Entrar

1. informe seu nome;
2. informe o código da sala;
3. clique em **Entrar na partida**;
4. se a sala for protegida, informe o PIN quando solicitado.

O recovery fica escondido no fluxo normal e é usado apenas quando o jogador precisa recuperar um perfil em outro navegador/aparelho.

### Durante a partida

A navegação principal possui quatro áreas:

- **Jogo** — saldo, vez, `Caí em...`, transferir, construir, dados quando habilitados, pendências e dívidas contextuais;
- **Patrimônio** — propriedades, construções e hipotecas;
- **Jogadores** — participantes e ranking;
- **Mais** — regras da sala, histórico, ajuda, perfil/recovery, negociações e administração.

A ação **Caí em...** pesquisa propriedades e instituições e mostra o fluxo apropriado. Valores financeiros são resolvidos pelo servidor a partir do catálogo canônico. Compras de títulos continuam aguardando aprovação do ADM antes de alterar saldo ou patrimônio.

Transferências voluntárias são solicitações entre jogadores: o destinatário confere **de**, **para** e **valor** e pode aceitar ou recusar. Falta de saldo em transferência voluntária gera apenas **Saldo insuficiente** — nunca cria dívida. Pagamentos obrigatórios, por outro lado, continuam usando Dívida/Central de Liquidez quando necessário.

Em **Mais → Banco**, **Passei pelo Início** solicita ao ADM o pró-labore definido no Ruleset (normalmente 200.000). Esse fluxo funciona mesmo sem iniciar o controle digital de turnos. O turn tracker é opcional e serve apenas como auxílio quando o grupo quiser usá-lo.

## Modo Assistido

O tabuleiro permanece físico. O aplicativo não inventa posição de peões, ordem de casas ou cartas ausentes.

O servidor pode resolver consequências conhecidas, como:

- compra de propriedade;
- aluguel;
- taxa de instituição;
- passagem pelo Início;
- cadeia e fiança;
- construção e venda de construções;
- hipoteca e resgate;
- transferências, negociações e acordos;
- liquidez e falência;
- turnos, dados digitais opcionais e regras de tempo.

Quando falta dinheiro para uma obrigação, o saldo não fica negativo: o domínio cria uma dívida e abre o fluxo de liquidez. Falência só é concluída quando as condições do domínio permitem.

## Principais funcionalidades

- catálogo canônico com 22 cidades e 6 instituições;
- GameEngine server-authoritative;
- Ruleset por sala, incluindo regras personalizadas;
- construção uniforme e grupo completo configuráveis de forma independente;
- estoque de casas e condomínio após 3/4 casas conforme Ruleset;
- hipoteca e resgate;
- Trade bilateral e acordos de pagamento;
- Central de Liquidez e falência controlada;
- cadeia, Habeas Corpus e turnos assistidos;
- dados digitais opcionais sem movimentação automática de peões;
- histórico estruturado e ranking;
- saves, backups, importação e recovery de perfil;
- PWA instalável;
- PostgreSQL com CAS e lease distribuído quando configurado.

## Configuração

### Servidor

Exemplo em `server/.env.example`:

```env
PORT=2567
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/banco_mundo
PGSSL=disable
CORS_ORIGINS=http://localhost:5173
INSTANCE_ID=local-dev-1
```

Variáveis:

| Variável | Uso |
|---|---|
| `PORT` | porta HTTP/WebSocket do servidor |
| `DATABASE_URL` | habilita PostgreSQL |
| `PGSSL` | define uso de SSL no PostgreSQL |
| `CORS_ORIGINS` | origens permitidas, separadas por vírgula |
| `INSTANCE_ID` | identifica a instância em cenários distribuídos |

### Cliente

Exemplo em `client/.env.example`:

```env
VITE_API_URL=http://localhost:2567
VITE_WS_URL=ws://localhost:2567
```

Em desenvolvimento local, os valores padrão normalmente são inferidos e essas variáveis só são necessárias quando API/WebSocket estão em outra origem.

## Persistência e PostgreSQL

Sem `DATABASE_URL`, o armazenamento local do servidor é a autoridade. Os arquivos ficam em:

```text
server/data/rooms
server/data/backups
server/data/corrupt
```

São mantidos backups rotativos locais; arquivos inválidos podem ser isolados em `corrupt`.

Com PostgreSQL configurado, o banco passa a ser a autoridade. O save usa **compare-and-swap por revisão**: uma instância só grava se a revisão-base ainda for a esperada. Conflitos geram `SAVE_CONFLICT` em vez de sobrescrita silenciosa. `active_room_leases` reduz o risco de duas instâncias comandarem o mesmo save simultaneamente.

Execute as migrations atuais com:

```bash
npm run migrate
```

As migrations reais ficam em `server/migrations/` e são registradas em `schema_migrations`.

## Recovery, backup e importação

- mesmo navegador: o identificador local pode recuperar o perfil;
- outro navegador/aparelho: use o código pessoal de recuperação;
- backup: exportação protegida quando a sala usa PIN;
- importação: valida estrutura, limites, catálogo e invariantes antes de aceitar o estado;
- importações geram novos recovery tokens e um novo código de save.

Dados privados de recovery não são sincronizados no Schema público nem incluídos em texto puro nos backups exportados.

## Testes

Comandos principais:

```bash
npm run typecheck
npm test
npm run test:integration
npm run build
npm run lint
npx playwright install chromium
npm run test:e2e
```

A suíte cobre domínio, regras, pagamentos, segurança, recovery, persistência, invariantes, PWA, Colyseus real e fluxos E2E da UX, incluindo viewport mobile.

O teste de CAS PostgreSQL é executado quando `DATABASE_URL` aponta para uma instância de teste. O CI em `.github/workflows/ci.yml` sobe PostgreSQL e executa migrations, typecheck, testes, integração, build, lint e E2E.

## Build e deploy

Build completo:

```bash
npm run build
```

Saídas principais:

```text
client/dist/
server/dist/
```

Em produção:

1. use HTTPS/WSS;
2. configure `DATABASE_URL`, `PGSSL`, `CORS_ORIGINS` e `INSTANCE_ID`;
3. execute `npm run migrate`;
4. execute as validações do projeto;
5. sirva `client/dist` em hospedagem estática/HTTPS;
6. execute o servidor compilado com `node server/dist/index.js` ou por um gerenciador de processos equivalente.

## PWA e acessibilidade

A PWA mantém a interface instalável e cacheia apenas recursos apropriados. Operações multiplayer/financeiras continuam dependendo do servidor; o modo offline não transforma ações de jogo em operações locais.

A interface atual inclui foco visível por teclado, regiões dinâmicas para estados importantes, alvos de toque adequados, estados que não dependem somente de cor, suporte a `prefers-reduced-motion` e layout mobile-first sem navegação horizontal principal.

## Limitações conhecidas

- ordem completa das casas do tabuleiro: `SOURCE_MISSING`;
- conteúdo individual das 32 cartas Sorte-Revés: `SOURCE_MISSING`;
- composição específica dos grupos de cor: `LEGACY_UNVERIFIED`;
- fórmula FMI `dados × 2.000`: `LEGACY_UNVERIFIED`;
- movimentação de peões continua física mesmo com dados digitais;
- falência com múltiplos credores não inventa rateio/prioridade não documentados;
- leilão eletrônico de casas é comportamento da aplicação, pois o manual não define protocolo digital de lances;
- rate limiting compartilhado entre réplicas depende de PostgreSQL;
- Playwright exige Chromium instalado para E2E local.

As classificações e justificativas canônicas ficam exclusivamente em `RULES-SOURCES.md`.

## Estrutura

```text
client/              interface, PWA e E2E
server/              Colyseus, domínio, persistência, migrations e testes
shared/              catálogo, dados do jogo e tipos compartilhados
scripts/             utilitários de desenvolvimento
docs/                 fonte transcrita de dados/regras
.github/workflows/   CI
```

## Documentação

- `README.md` — uso, instalação, configuração, testes e operação;
- `CHANGELOG.md` — mudanças significativas por marco de versão;
- `ARCHITECTURE.md` — arquitetura atual;
- `RULES-SOURCES.md` — status canônico das fontes de regras;
- `SECURITY.md` — modelo de segurança atual;
- `docs/banco-imobiliario-completo.md` — fonte transcrita preservada integralmente.
