# Banco Mundo Online MVP 0.4.0

Versão focada em proteção contra perda de partidas.

## Camadas de proteção
- Salvamento automático em `server/data/rooms` após toda ação relevante.
- Salvamento periódico a cada 30 segundos.
- Salvamento final ao sair, pausar ou alterar a sala.
- Escrita atômica: arquivo temporário seguido de renomeação.
- Até 10 backups rotativos por partida em `server/data/backups`.
- Arquivos inválidos são isolados em `server/data/corrupt`.
- Sala não é descartada automaticamente quando fica vazia.
- Lista de partidas salvas na tela inicial.
- Continuar partida depois de reiniciar o servidor.
- Código permanente separado do ID técnico da sala.
- Perfil recuperado por identificador do navegador ou código pessoal.
- Pausar e salvar sem encerrar definitivamente.
- Download manual de backup JSON.
- Importação de backup JSON com novo código permanente.
- PIN persistido apenas como hash SHA-256.

## Importante
Os dados ficam no computador que executa o servidor. Para proteção contra perda do disco, use também **Baixar backup** e guarde uma cópia no OneDrive.

## Executar
```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\instalar-e-rodar.ps1
```


## PWA
Abra o site por HTTPS e use **Instalar aplicativo** ou **Adicionar à tela inicial**. O cache mantém apenas a interface; operações da partida exigem conexão com o servidor.
