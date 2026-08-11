# Banco Mundo Online 0.5.3

- Bloqueio de Criar sala, Entrar e Reconectar enquanto uma conexão está em andamento.
- Indicadores Preparando conexão, Acordando servidor, Criando sala e Conectando à partida.
- Verificação em `/api/health` antes do WebSocket, com novas tentativas controladas e botão Cancelar.
- `operationId` único e proteção no servidor contra a mesma criação repetida.
- Listagem pública em `/api/saves` desativada com resposta HTTP 410.
- Novo endpoint público `/api/health` sem códigos ou dados das partidas.
- Recursos da versão 0.5.2 PWA preservados.
