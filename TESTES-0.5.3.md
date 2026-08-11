# Testes Banco Mundo Online 0.5.3

- Um toque em Criar sala gera uma única sala e um único save.
- Toques repetidos não geram tentativas adicionais.
- Botões permanecem desativados durante a conexão.
- Acordando servidor aparece quando o backend ainda não respondeu.
- Cancelar encerra a espera e libera os botões.
- Entrar por código temporário e permanente continua funcionando.
- `/api/health` retorna somente saúde e versão.
- `/api/saves` retorna HTTP 410 e não expõe códigos.
- PWA, catálogo, ranking, backup, ADM, hipoteca, manual e falência continuam funcionando.
