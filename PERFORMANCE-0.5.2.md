# Otimização móvel 0.5.2

O modo leve é ativado quando o navegador informa até 4 GB de memória ou até 4 núcleos lógicos. Nesse modo, efeitos visuais pesados são reduzidos e o histórico mantém no DOM somente os 40 eventos mais recentes. Em outros dispositivos, são exibidos até 100 eventos. Atualizações simultâneas do estado são agrupadas com requestAnimationFrame para evitar várias reconstruções da interface no mesmo quadro.
