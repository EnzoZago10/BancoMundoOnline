# Persistência e recuperação

## Pastas
- `server/data/rooms`: estado atual de cada partida.
- `server/data/backups`: dez versões anteriores por partida.
- `server/data/corrupt`: cópias isoladas de arquivos que falharam na leitura.

## Tipos de saída
- **Sair:** mantém o perfil salvo e desconecta apenas o jogador.
- **Pausar e salvar:** marca a partida para continuação e grava imediatamente.
- **Encerrar:** finaliza a partida e cancela pendências.

## Recuperação
- Mesmo navegador: identificador local recupera o perfil.
- Outro navegador: informe o código pessoal do jogador.
- Outro computador servidor: importe o backup JSON.
