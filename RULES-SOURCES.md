# Fontes das regras

Este é o documento canônico para distinguir o que o projeto pode afirmar como regra/dado confirmado, o que é legado não verificado, o que ainda depende de fonte ausente e o que é comportamento próprio da aplicação.

Fonte transcrita preservada: `docs/banco-imobiliario-completo.md`.

Classificações:

- `CONFIRMED`: sustentado pelo manual/transcrição fornecidos.
- `LEGACY_UNVERIFIED`: legado preservado, mas não comprovado pela fonte atual.
- `SOURCE_MISSING`: material oficial necessário não foi fornecido.
- `APP_BEHAVIOR`: comportamento explícito do aplicativo, não apresentado como regra oficial.

| Regra/dado | Status | Observação |
|---|---|---|
| Dinheiro inicial $2.558.000 | CONFIRMED | Derivado das notas distribuídas no manual. |
| Pró-labore $200.000 | CONFIRMED | Ao passar/parar no Início; deve ser solicitado até o fim da jogada na regra principal. |
| Dupla concede nova jogada | CONFIRMED | Manual. |
| Três duplas seguidas → cadeia | CONFIRMED | Manual. |
| Cadeia até 3 rodadas | CONFIRMED | Manual. |
| Fiança $50.000 após terceira tentativa | CONFIRMED | Regra principal. |
| Fiança após ao menos uma rodada/tentativa perdida | CONFIRMED | Regra opcional; nunca imediatamente após entrar. |
| Preso recebe aluguel e não negocia | CONFIRMED | Manual. |
| Habeas Corpus pode ser guardado e negociado | CONFIRMED | Manual. |
| 22 cidades + 6 instituições | CONFIRMED | 28 títulos transcritos. |
| Valores financeiros dos 28 títulos | CONFIRMED | Catálogo canônico. |
| Instituição = soma dos dados × multiplicador | CONFIRMED | Manual/títulos. |
| Dono das 6 instituições recebe taxa dobrada | CONFIRMED | Manual. |
| Construir exige grupo completo | CONFIRMED | Regra principal; pode ser desligada como regra da casa. |
| Não exigir grupo completo | APP_BEHAVIOR | Regra da casa da aplicação. |
| Construção uniforme | CONFIRMED | Regra principal. |
| Não exigir construção uniforme | APP_BEHAVIOR | Regra da casa da aplicação. |
| Composição específica dos grupos de cor | LEGACY_UNVERIFIED | A transcrição confirma grupos, mas não a associação de cada cidade à cor. |
| 4 casas antes do condomínio | CONFIRMED | Regra principal. |
| Condomínio a partir da 3ª casa | CONFIRMED | Regra opcional. |
| Estoque de 80 peças | CONFIRMED | Conteúdo/manual. |
| Venda de construção por 50% | CONFIRMED | Manual. |
| Leilão de casa após escassez/retorno | CONFIRMED | Manual autoriza o banqueiro a fazer leilão quando uma peça retorna após o estoque acabar. |
| Mecânica digital de lances do leilão | APP_BEHAVIOR | O manual não define protocolo eletrônico de lances. |
| Hipoteca paga valor do título; resgate +20% | CONFIRMED | Manual. |
| Imóvel hipotecado deve ser resgatado antes do Trade digital | APP_BEHAVIOR | Implementação conservadora para não inventar autorização digital implícita. |
| Ordem de liquidez antes da falência | CONFIRMED | Manual. |
| Falência com múltiplos credores: bloquear conclusão até resolver/consolidar | APP_BEHAVIOR | O manual não fornece algoritmo digital de rateio/prioridade. |
| Final alternativo pelo maior valor de liquidação | CONFIRMED | Regra opcional do manual. |
| Distribuição inicial de propriedades | CONFIRMED | Regra opcional; seleção deve ser auditável pelo ADM. |
| Jogo contra o relógio | CONFIRMED | Regra opcional. |
| Empate no jogo contra relógio decidido nos dados | CONFIRMED | Manual. |
| Dados digitais no Modo Assistido | APP_BEHAVIOR | Comodidade opcional; não implica movimentação digital do peão. |
| Sucessão automática do ADM offline | APP_BEHAVIOR | Política de disponibilidade da aplicação. |
| Marcar jogador como abandonado sem falência automática | APP_BEHAVIOR | Preserva estado; abandono não é transformado em regra oficial de falência. |
| Fórmula FMI `dados × 2.000` | LEGACY_UNVERIFIED | O manual fornecido apenas manda cumprir o tabuleiro. |
| Ordem completa das casas do tabuleiro | SOURCE_MISSING | Não foi fornecida de forma confiável. |
| Conteúdo individual das 32 cartas Sorte-Revés | SOURCE_MISSING | A quantidade é confirmada, mas os textos/efeitos individuais não foram fornecidos. |

`SOURCE_MISSING` nunca deve ser preenchido por inferência. `LEGACY_UNVERIFIED` nunca deve ser apresentado como oficial confirmado.
