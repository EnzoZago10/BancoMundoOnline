# Segurança

## Modelo de autoridade

O servidor é autoritativo. O cliente envia intenções e identificadores, não valores financeiros confiáveis. Preço, aluguel, hipoteca, ownership, regras e demais valores sensíveis são resolvidos a partir do catálogo, State e Ruleset no servidor.

Payloads recebidos passam por validação runtime antes de alcançar o domínio.

## PIN

Salas podem ser criadas com ou sem PIN.

Quando existe PIN:

- o hash usa `scrypt` com salt e parâmetros registrados;
- o PIN não é sincronizado no Schema público;
- operações protegidas validam o segredo no servidor;
- PIN ausente ou incorreto não é tratado como entrada válida.

## Recovery e identidade

- `playerId` permanente é separado da sessão WebSocket;
- tokens de device/recovery são aleatórios e comparados por hash;
- tokens privados não são sincronizados no estado público;
- recovery explicitamente inválido gera erro em vez de criar/selecionar outro perfil;
- sala bloqueada recusa jogador novo, mas permite recuperação legítima de perfil conhecido.

## Validação e integridade do domínio

Operações importantes passam por validações do GameEngine e por invariantes do estado. O cliente não pode desativar uma regra apenas alterando um payload de comando.

Trade e Settlement revalidam ownership, saldo, cadeia, falência, construções e outras condições antes do commit. Snapshot/rollback protege operações bilaterais contra aplicação parcial.

## XSS e conteúdo do usuário

Conteúdo controlado por usuário é apresentado com APIs seguras (`textContent`/nós DOM ou escaping apropriado). A suíte inclui casos com texto hostil para verificar comportamento, não apenas presença de uma função de escape.

## Saves, backup e importação

Persistência e importação aplicam validações de estrutura e domínio, incluindo:

- limite de tamanho;
- limites de jogadores/eventos/coleções;
- rejeição de `NaN`/`Infinity` e development inválido;
- rejeição de asset desconhecido ou duplicado;
- canonicalização financeira pelo catálogo;
- migração de formatos suportados;
- execução de invariantes antes de aceitar o estado.

Backups exportados não incluem tokens privados em texto puro. Importações geram novos recovery tokens.

Novos códigos de save usam 8 bytes aleatórios representados em hexadecimal.

## Concorrência e PostgreSQL

Quando PostgreSQL está habilitado, saves usam CAS exato por revisão. Se duas instâncias partirem da mesma revisão, apenas uma grava a próxima; a outra recebe `SAVE_CONFLICT` e não pode ultrapassar a concorrente aumentando arbitrariamente a própria revisão.

`active_room_leases` adiciona exclusão temporal de ownership da sala entre instâncias.

## Rate limiting

Existe limitação local por origem como fallback. Com PostgreSQL, endpoints/tentativas sensíveis podem usar rate limiting compartilhado via banco.

Deployment multi-réplica sem PostgreSQL não possui rate limit compartilhado e não é recomendado.

## Produção

- use HTTPS/WSS;
- configure `CORS_ORIGINS` explicitamente;
- use PostgreSQL para múltiplas réplicas;
- mantenha `INSTANCE_ID` distinto por instância;
- execute migrations antes de subir a aplicação;
- mantenha segredos e arquivos `.env` fora do repositório;
- monitore conflitos de save, falhas de banco e tentativas de autenticação.
