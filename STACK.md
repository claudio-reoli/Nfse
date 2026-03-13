# Stack Tecnológica — NFS-e Freire

Sistema Web NFS-e Padrão Nacional — Emissão, Consulta e Gestão de Notas Fiscais de Serviço Eletrônica.

---

## Frontend

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| HTML5 | — | Estrutura, semântica |
| CSS3 | — | Design tokens, variáveis CSS, layout |
| JavaScript ES Modules | ES2020+ | Vanilla JS, sem framework |
| node-forge | CDN | Parsing de certificados digitais (A1) no browser |

**Arquitetura:** SPA com roteamento por hash (`window.location.hash`). Dois módulos: Portal do Contribuinte (`index.html`) e Portal do Município (`dashboard-municipio.html`).

---

## Backend

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Node.js | 20.x | Runtime |
| Express | 5.x | Servidor HTTP, rotas REST |
| dotenv | 17.x | Variáveis de ambiente |
| axios | 1.x | Cliente HTTP (APIs ADN/Sefin) |
| bcryptjs | 3.x | Hash de senhas |
| jsonwebtoken | 9.x | Autenticação JWT |
| node-cron | 4.x | Tarefas agendadas (sync ADN) |
| node-forge | 1.x | Conversão PFX → PEM, certificados |
| zlib | nativo | Descompressão GZip (XML) |
| pg | 8.x | Cliente PostgreSQL |

**Arquitetura:** Backend único (`backend-municipio.js`) que atende ambos os portais. API REST em `/api/*`.

---

## Persistência

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| PostgreSQL | 16 | Banco de dados relacional |
| Docker | — | Container PostgreSQL (porta 5433) |
| pg (node-postgres) | 8.x | Pool de conexões, queries SQL |

**Schema:** 5 tabelas — `config`, `sync_state`, `users`, `notas`, `apuracoes`. Tabela `notas` com colunas indexáveis + JSONB para dados completos do XML.

---

## Segurança / Certificação Digital

| Tecnologia | Uso |
|------------|-----|
| Certificado ICP-Brasil A1 | PKCS#12 (.pfx) |
| mTLS | `https.Agent` com key + cert PEM para APIs ADN |
| CORS | Configurável por origem |
| JWT | Tokens de sessão (8h) |

---

## Integrações Externas

| API | Uso |
|-----|-----|
| ADN (Ambiente de Dados Nacional) | Distribuição de DFe, importação de NFS-e |
| Sefin Nacional | Parâmetros, emissão (via proxy) |

---

## Infraestrutura / Dev

| Ferramenta | Uso |
|------------|-----|
| npm | Gerenciamento de dependências |
| Git | Controle de versão |
| Docker Compose | PostgreSQL 16 |

**Scripts principais:**
- `npm start` — Inicia o backend
- `npm run dev` — Backend com watch
- `npm run migrate` — Migra dados do db.json para PostgreSQL
- `npm run db:up` — Sobe o container PostgreSQL
- `npm run db:down` — Para o container

---

## Resumo

| Camada | Stack |
|--------|-------|
| Frontend | HTML5, CSS3, JavaScript ES Modules, node-forge |
| Backend | Node.js, Express 5, JWT, bcrypt |
| Banco | PostgreSQL 16 (via Docker) |
| Integração | ADN, Sefin (mTLS) |
