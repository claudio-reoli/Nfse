# Como Iniciar o Sistema NFSe Freire

## Forma mais simples — arquivo BAT

Dê um **duplo clique** no arquivo:

```
iniciar-sistema.bat
```

Ele faz tudo automaticamente na ordem certa:

1. Verifica e inicia o **Docker Desktop** (se necessário)
2. Sobe o **container PostgreSQL** (porta 5433)
3. Encerra qualquer instância anterior do backend
4. Inicia o **backend Node.js** (porta 3099) — que por sua vez sobe o serviço de IA (porta 8001)
5. Abre o navegador automaticamente em `http://localhost:3099/dashboard-municipio.html`

---

## Pré-requisitos

| Requisito | Versão mínima |
|---|---|
| Docker Desktop | Qualquer versão recente |
| Node.js | v18+ |
| Python | 3.9+ (para serviço de IA) |

---

## Endereços após inicialização

| Sistema | URL |
|---|---|
| **Painel Municipal (SEFIN)** | http://localhost:3099/dashboard-municipio.html |
| **Portal do Contribuinte** | http://localhost:3099/ |
| **API Backend** | http://localhost:3099/api |
| **Serviço de IA** | http://localhost:8001 |
| **Banco de dados** | localhost:5433 (usuário: `nfse`, senha: `nfse_dev`) |

---

## Parando os serviços

- **Backend Node.js** — feche a janela "NFSe Backend - porta 3099"
- **PostgreSQL** — execute no terminal:
  ```
  docker-compose down
  ```
- **Docker Desktop** — pode fechar pela bandeja do sistema

---

## Solução de problemas

**"Docker não respondeu após 90 segundos"**
- Abra o Docker Desktop manualmente pelo menu Iniciar
- Aguarde o ícone na bandeja ficar verde (Engine running)
- Execute o `iniciar-sistema.bat` novamente

**"Falha ao subir o container PostgreSQL"**
- Verifique se o Docker Desktop está rodando (`docker ps` no terminal)
- Execute `docker-compose up -d` manualmente na pasta do projeto

**"Sistema não carrega no navegador"**
- Verifique a janela "NFSe Backend" por erros
- Confirme que a porta 3099 está em uso: `netstat -ano | findstr :3099`
- Reinicie executando o `iniciar-sistema.bat` novamente
