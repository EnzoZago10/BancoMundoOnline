# Changelog

Este arquivo registra apenas mudanças significativas do projeto. Micro-fixes, resultados temporários de comandos e relatórios de entrega não são mantidos como documentação permanente.

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
