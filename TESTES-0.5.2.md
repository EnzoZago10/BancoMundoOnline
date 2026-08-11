# Testes Banco Mundo Online 0.5.2

## Catálogo
- Trocar a propriedade atualiza compra, casa, condomínio e hipoteca.
- Trocar o nível atualiza o custo de construções e o total previsto.
- O saldo estimado após aprovação muda em tempo real.
- Condomínio calcula quatro casas mais o custo do condomínio.
- O valor efetivamente descontado após aprovação coincide com a estimativa.

## Ranking
- Geral ordena por saldo + valor das compras + construções não hipotecadas.
- Dinheiro ordena somente pelo saldo.
- Propriedades e organizações ordena pela quantidade total de bens.
- Empates de acúmulo usam o ranking geral como desempate.
- Jogador falido continua visível e identificado.
- Valores mudam após pagamentos, compras e construções.

## Celulares mais fracos
- Interface permanece utilizável em tela estreita.
- Painéis fora da tela usam content-visibility.
- Atualizações simultâneas são agrupadas em um quadro.
- Modo leve reduz efeitos e mantém 40 eventos recentes no DOM.
- Outros dispositivos mantêm até 100 eventos recentes no DOM.
- Preferência de movimento reduzido é respeitada.

## Regressão
- PWA instala e atualiza.
- Multiplayer, backup, ADM, hipoteca, manual, falência e recuperação continuam funcionando.
