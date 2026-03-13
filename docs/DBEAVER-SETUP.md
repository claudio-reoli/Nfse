# DBeaver — Configuração para NFSe PostgreSQL

Guia para conectar o DBeaver ao banco PostgreSQL do projeto NFSe.

## Pré-requisitos

- **DBeaver Community** instalado (via `winget install DBeaver.DBeaver.Community`)
- **PostgreSQL** rodando via Docker: `docker compose up -d` (porta 5433)

## Importar conexão pré-configurada

1. Abra o **DBeaver**
2. Menu **Arquivo** → **Importar** → **Custom** → **Connections from XML**
3. Clique em **Próximo**
4. Em **Input type**, selecione **XML**
5. Em **File path**, informe o caminho do arquivo:
   ```
   docs/dbeaver-nfse-connection.xml
   ```
   (ou navegue até a pasta `docs` do projeto NFSe)
6. Clique em **Concluir**
7. A conexão **NFSe PostgreSQL (localhost:5433)** aparecerá no painel **Database Navigator**

## Configurar conexão manualmente (alternativa)

1. **Nova conexão**: ícone de plugue ou **Database** → **New Database Connection** → **PostgreSQL**
2. Preencha:
   - **Host**: `localhost`
   - **Port**: `5433`
   - **Database**: `nfse`
   - **Username**: `nfse`
   - **Password**: `nfse_dev`
3. Clique em **Test Connection** (o DBeaver baixará o driver JDBC se necessário)
4. **Finish**

## Auto-refresh dos dados

Para atualizar os dados em tempo real:

1. Abra uma tabela (duplo clique em **Tables** → **public** → tabela)
2. Botão direito no grid de dados → **Refresh** → **Auto-refresh**
3. Defina o intervalo (ex.: 5 segundos)

## Objetos visíveis

- **Schemas**: `public`
- **Tabelas**: `config`, `sync_state`, `users`, `notas`, `apuracoes`
- **Funções, triggers, rules**: no painel lateral de cada objeto

## Troubleshooting

| Problema | Solução |
|----------|---------|
| Connection refused | Suba o PostgreSQL: `docker compose up -d` |
| Driver não encontrado | DBeaver baixa automaticamente ao testar a conexão |
| Senha incorreta | Verifique `.env` ou `docker-compose.yml` |
