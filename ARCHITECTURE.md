# Arquitetura

## Visão geral

Banco Mundo Online é uma aplicação multiplayer para acompanhar um **tabuleiro físico**. O cliente envia intenções; o servidor valida payloads, aplica regras no domínio e sincroniza o estado autoritativo pelo Colyseus.

Não existe uma segunda implementação paralela do motor. `State`/Schema é o estado sincronizado e persistido, e o `GameEngine` opera sobre esse modelo por meio de comandos e handlers.

```text
Cliente
  ↓ mensagens/intenção
BankRoom + validação runtime
  ↓
handlers
  ↓
CommandDispatcher
  ↓
GameEngine / serviços de domínio
  ↓
invariantes + eventos
  ↓
State (Colyseus Schema)
  ↓
sincronização + persistência
```

## Client

O cliente fica em `client/`.

Pontos principais:

- `client/src/main.js` — composição e orquestração;
- `client/src/features/simple-ux.js` — experiência de quatro áreas e disclosure contextual;
- `client/src/features/session.js` — criação/entrada de sala;
- `client/src/features/room-binding.js` — binding do estado Colyseus;
- `client/src/features/ruleset.js` e `rules-ui.js` — presets e apresentação das regras;
- `client/src/features/assets.js` — patrimônio e construções;
- `client/src/features/trading-ui.js` — negociação, dívidas, acordos e liquidez;
- `client/src/features/assistive-gameplay.js` — ações do tabuleiro físico;
- `client/src/features/recovery.js` — recovery de perfil;
- `client/src/features/admin-ui.js` — ações administrativas;
- `client/src/ui/schema-safe.js` — leitura tolerante à hidratação incremental das coleções sincronizadas;
- `client/src/shell.js` — PWA, instalação, atualização e shell da aplicação.

A interface pode simplificar nomes e fluxos, mas não substitui validações do servidor.

## BankRoom

`server/src/room.ts` implementa o lifecycle da sala Colyseus.

Responsabilidades principais:

- autenticação de entrada;
- PIN e recovery;
- lock de novos jogadores;
- associação de sessão ↔ perfil;
- registro dos handlers;
- persistência e lease da sala;
- pausa/encerramento e lifecycle multiplayer.

A `BankRoom` não deve concentrar regras financeiras.

## Protocol e validação runtime

O contrato compartilhado de intenção fica em `shared/protocol/messages.ts`. A validação efetiva dos payloads recebidos pelo servidor fica em `server/src/protocol/messages.ts`.

O cliente não envia valores financeiros autoritativos como preço, aluguel, hipoteca ou regra para forçar um comando. Ele envia intenção e identificadores; o servidor resolve os valores a partir do catálogo, State e Ruleset.

## Handlers

Os adaptadores Colyseus → domínio ficam em `server/src/room/handlers/`:

- `financial.ts` — compras, pagamentos, construções, hipotecas e consequências financeiras;
- `trade.ts` — negociações e acordos;
- `admin.ts` — operações administrativas;
- `index.ts` — composição dos handlers.

Handlers normalizam contexto/autorização e encaminham a intenção ao domínio; não devem duplicar regras do GameEngine. A coleção `pending` é usada para confirmações humanas que fazem sentido no tabuleiro físico: transferência voluntária (destinatário), compra (ADM) e pró-labore do Início (ADM).

## GameEngine e domínio

A lógica central fica em `server/src/domain/`.

Componentes relevantes:

- `game-engine.ts` — operações canônicas do jogo;
- `commands.ts` e `dispatcher.ts` — contratos e despacho;
- `ruleset.ts` e `rules.ts` — regras da sala e regras financeiras;
- `invariants.ts` — invariantes globais do estado;
- `trading.ts` — operações bilaterais;
- `bankruptcy.ts` — liquidez/falência;
- `jail.ts` — cadeia e fiança;
- `turn-engine.ts` — turnos e dados assistidos;
- `security.ts` — hashing/validação sensível;
- `catalog.ts` — acesso tipado ao catálogo canônico.

Depois de operações relevantes, invariantes protegem saldo, ownership, estoque e referências de estado.

## State

`server/src/state.ts` define o Schema sincronizado.

Ele contém, entre outros:

- jogadores;
- patrimônio;
- Ruleset;
- pendências;
- trades;
- liabilities;
- settlements;
- histórico estruturado;
- ordem/estado de turno;
- estoque de casas;
- timer e leilão;
- metadados de sala e revisão.

Dados privados de autenticação/recovery não são tratados como informação pública da sala.

## Transferências voluntárias e pagamentos obrigatórios

Transferência voluntária entre jogadores é uma solicitação confirmável. O servidor valida saldo antes de criar a pendência; falta de saldo retorna erro e **não** cria `Liability`. O destinatário pode aceitar/recusar e o remetente pode cancelar enquanto estiver pendente.

Compras de títulos também usam `pending`: o jogador envia apenas o `catalogId`, o servidor anexa o preço canônico e o ADM aprova ou recusa. Saldo e ownership só mudam após aprovação e nova validação.

O pró-labore do Início segue o mesmo padrão de transparência: o jogador solicita o valor definido pelo Ruleset e o ADM aprova ou recusa, sem depender do turn tracker.

### Disposição de patrimônio

A venda voluntária ao banco usa `pending` com `kind="bank_sale"`. O cliente envia apenas o identificador do título; o servidor resolve o valor canônico, valida o estado na criação e revalida na aprovação do ADM. A conclusão remove o asset do jogador, credita o valor oficial e torna o `catalogId` novamente sem proprietário.

A ação simplificada **Transferir** não possui motor próprio. Ela cria um `Trade` normal com um título do proponente e dinheiro zero. O destinatário aceita/recusa pelo mesmo fluxo de negociação; o proponente pode cancelar. Ownership, hipoteca, construções, conflitos e invariants são revalidados antes do commit.

## Pagamentos obrigatórios

`GameEngine.resolveMandatoryPayment()` é o caminho canônico para obrigações como aluguel e outras consequências financeiras.

```text
saldo suficiente
  → débito/crédito atômico

saldo insuficiente
  → saldo não fica negativo
  → cria Liability
  → abre fluxo de liquidez
```

A interface chama isso de **dívida**; `Liability` permanece como conceito interno.

## Trade, Liability e Settlement

- `Trade` — negociação voluntária bilateral de dinheiro, títulos e itens suportados;
- `Liability` — obrigação real contra jogador ou banco;
- `Settlement` — proposta de quitação de uma Liability.

Trade e Settlement revalidam o estado antes do commit e usam snapshot/rollback para preservar atomicidade.

Liquidez sempre trabalha com uma obrigação explícita. A falência não escolhe silenciosamente uma dívida nem inventa rateio para múltiplos credores.

## Ruleset

O Ruleset pertence à sala e é persistido. Entre os campos relevantes estão:

- `requireFullGroupForBuilding`;
- `requireEvenBuilding`;
- `housesBeforeCondo`;
- `limitedHouseStock`;
- `allowEarlyJailFine`;
- `autoCollectStart`;
- `useDigitalDice`;
- `alternateLiquidationVictory`;
- `initialPropertyDistribution`;
- `timedGame`;
- `timeLimitMs`.

O preset **Construção livre** mantém o motor e altera apenas a exigência de grupo completo, preservando construção uniforme por padrão.

## Tabuleiro físico e turnos

O Modo Assistido não conhece automaticamente a posição do peão. O jogador informa o que ocorreu no tabuleiro e o servidor resolve apenas consequências suportadas por dados conhecidos.

O turn tracker é opcional. Quando não iniciado, as ações comuns do banco/patrimônio continuam funcionando sem `currentPlayerId`. Quando ativado, ele mantém ordem, jogador atual, rodada e número do turno e pode restringir ações dependentes de vez. Dados digitais opcionais são rolados no servidor, mas a movimentação física continua responsabilidade dos jogadores.

## Catálogo e dados compartilhados

`shared/catalog.json` é o catálogo financeiro canônico.

`shared/game-data/` contém estruturas data-driven para informações de tabuleiro/cartas. Conteúdo sem fonte suficiente permanece explicitamente ausente ou não confirmado; o estado canônico dessas fontes fica em `RULES-SOURCES.md`.

`docs/banco-imobiliario-completo.md` é a fonte transcrita preservada e não deve ser substituída por inferência.

## Persistência

### Sem PostgreSQL

Arquivos locais são a autoridade. `server/src/persistence.ts` grava em `server/data/rooms`, mantém backups rotativos em `server/data/backups` e isola saves inválidos em `server/data/corrupt`.

### Com PostgreSQL

PostgreSQL é a autoridade. O fluxo de gravação é:

```text
State
  ↓ validação de invariantes
snapshot
  ↓
CAS(expectedRevision → nextRevision)
  ↓ sucesso
mirror local
```

Se a revisão-base mudou, a gravação falha com `SAVE_CONFLICT` em vez de sobrescrever outra instância. `active_room_leases` fornece exclusão temporal adicional para salas ativas.

Migrations SQL ficam em `server/migrations/` e são aplicadas por `npm run migrate`.

## Restore e importação

Valores imutáveis dos títulos são reconstruídos a partir do catálogo canônico. O save fornece apenas o estado mutável aplicável, como desenvolvimento e hipoteca.

Restore/importação:

- migra formatos antigos suportados;
- preserva Ruleset personalizado quando representável;
- rejeita assets desconhecidos/duplicados e estados impossíveis;
- recalcula/canonicaliza dados quando a migração prevê isso;
- executa invariantes antes de aceitar o estado.

## HTTP e WebSocket

`server/src/index.ts` expõe:

- `/api/health`;
- `/api/catalog`;
- exportação autenticada de save;
- importação de backup;
- servidor Colyseus `bank_room` via WebSocket.

A listagem pública de saves é desativada.

## PWA

A PWA vive no cliente e fornece instalação progressiva, cache do shell e fluxo de atualização. O estado de instalação é derivado de `display-mode: standalone`/`navigator.standalone` e da disponibilidade real de `beforeinstallprompt`; ausência do evento usa orientação manual em vez de botão morto. Instalação e atualização do Service Worker são estados independentes, e o primeiro `clients.claim()` continua sem recarregar uma sala recém-criada. Operações de jogo continuam dependendo do servidor; o cache não cria uma autoridade paralela offline.

## Testes e CI

- `server/test/*.test.ts` — domínio, regras, segurança, persistência e regressões;
- `server/test/*.integration.ts` — integração Colyseus/PostgreSQL quando disponível;
- `client/e2e/` — fluxos reais no navegador;
- `.github/workflows/ci.yml` — validação automatizada com PostgreSQL e Playwright.
