# DOCUMENTO DE REQUISITOS — Gaps e Etapas Futuras (Ecossistema NFS-e ADN)

**Versão 1.0 — Março de 2026**

Este documento detalha os requisitos do **Sistema Nacional NFS-e (ADN e Reforma Tributária)** que **não foram implementados** na versão atual (v1.1.0) do Freire Web Client, classificando-os como itens fora do escopo atual ou limitações técnicas provisórias, e define como eles devem ser abordados em uma etapa futura.

---

## Sumário

1. [Itens Fora do Escopo Atual da Aplicação Web](#1-itens-fora-do-escopo-atual-da-aplicação-web)
   1.1 [Certificado A3 (Token ou Smart Card)](#11-certificado-a3-token-ou-smart-card)
   1.2 [MAN (Módulo de Apuração Nacional)](#12-man-módulo-de-apuração-nacional)
   1.3 [CNC (Cadastro Nacional de Contribuintes)](#13-cnc-cadastro-nacional-de-contribuintes)
2. [Limitações Técnicas e Implementações Parciais](#2-limitações-técnicas-e-implementações-parciais)
   2.1 [Modificação de Parâmetros Municipais (Painel Sefin)](#21-modificação-de-parâmetros-municipais-painel-sefin)
   2.2 [Autenticação mTLS via Navegador Web](#22-autenticação-mtls-via-navegador-web)
   2.3 [Eventos de Ofício (Anulação de Rejeição e Confirmação Tácita)](#23-eventos-de-ofício-anulação-de-rejeição-e-confirmação-tácita)
   2.4 [Catálogo Completo de CSTs PIS/COFINS](#24-catálogo-completo-de-csts-piscofins)
3. [Estratégia para a Próxima Fase (Roadmap)](#3-estratégia-para-a-próxima-fase-roadmap)

---

## 1. Itens Fora do Escopo Atual da Aplicação Web

Os itens abaixo foram omitidos da versão atual pois não fazem parte do escopo natural de um *client* web isolado para emissão tributária ou referem-se a sistemas de controle centralizado do Governo.

### 1.1. Certificado A3 (Token ou Smart Card)
* **Status:** Não Implementado (❌)
* **Motivo:** O Certificado Digital A3 é gravado em hardware físico (smart card ou token USB). Navegadores web modernos operam em "sandbox" (ambiente isolado) e não têm permissão para acessar o hardware físico da máquina do usuário nativamente sem o intermédio de componentes externos.
* **Proposta para o Futuro:** 
  Para suportar o Certificado A3, será necessário desenvolver um **Componente Conector Local (Desktop/Tray App)** via Java, C\#, ou C++ que acesse o *crypto driver* (PKCS#11) da máquina do usuário e exponha um servidor local em `localhost` para que a aplicação web (Freire) possa enviar o hash do XML da DPS para ser assinado, retornando a assinatura final.

### 1.2. MAN (Módulo de Apuração Nacional)
* **Status:** Não Implementado (❌)
* **Motivo:** O MAN é um projeto governamental futuro, de adesão voluntária pelos municípios, que visa automatizar a apuração do ISSQN. No momento da emissão pelo contribuinte, as alíquotas e o cálculo da DPS já são suficientes. A etapa de *apuração cruzada* acontece mensalmente dentro dos painéis da própria Receita/Sefin Nacional e prefeituras.
* **Proposta para o Futuro:** 
  Acompanhar a liberação das APIs do MAN por parte da Sefin Nacional. Quando disponíveis, criar um módulo financeiro apartado de "Fechamento de Mês" para visualização das guias de arrecadação unificadas.

### 1.3. CNC (Cadastro Nacional de Contribuintes)
* **Status:** Não Implementado (❌)
* **Motivo:** A gestão de criação e suspensão de contribuintes dentro do CNC é tarefa privativa do Painel Administrativo Nacional e sistemas integrados à RFB (Receita Federal do Brasil) e Simples Nacional. O web client é responsável por consumir os dados (via autenticação), e não por gerenciar a ficha do contribuinte.
* **Proposta para o Futuro:** 
  Manter o fluxo atual. Caso a especificação de APIs abertas evolua para permitir "AutoCadastro", poderá ser criada uma aba de "Manutenção Cadastral" sincronizada com o CNC.

---

## 2. Limitações Técnicas e Implementações Parciais

Os itens a seguir possuem estruturas ou *stubs* no código, mas foram limitados propositalmente devido a restrições operacionais, lógicas ou falta de compatibilidade técnica.

### 2.1. Modificação de Parâmetros Municipais (Painel Sefin)
* **Status:** Parcialmente Implementado (⚠️)
* **Motivo:** A interface atual da aplicação contempla apenas a **leitura** (`GET`) das APIs referentes ao convênio e parâmetros municipais (como regimes especiais, alíquotas e deduções). A **gravação/alteração** (`POST`) desses parâmetros exige credenciais de um ente federativo (Município), e não o certificado de um contribuinte padrão.
* **Proposta para o Futuro:**
  Caso o escopo do projeto se expanda para oferecer o produto como *Software House* ("White-label") para prefeituras, será necessário construir um painel administrativo com rotas e lógicas de envio (POST/PUT) para `/parametros_municipais/{codMun}`, condicionado à injeção de Certificado Raiz da Prefeitura.

### 2.2. Autenticação mTLS via Navegador Web
* **Status:** Parcialmente Implementado (⚠️)
* **Motivo:** As APIs da Sefin Nacional exigem comunicação **mTLS** (Autenticação Mútua via TLS). A aplicação web assina os XMLs internamente no JavaScript usando o certificado A1 (`.pfx` carregado na aba "Configurações"), mas conexões bidirecionais via `fetch` em navegadores não suportam a injeção fluida de uma chave criptográfica customizada (`Agent`/`Socket`) como em um backend Node.js.
* **Proposta para o Futuro:**
  Refatorar a arquitetura da aplicação para usar um padrão **Backend For Frontend (BFF)**. O frontend montaria a requisição e a enviaria para o servidor próprio do projeto (Node.js/C#). Esse backend, de posse segura do arquivo `.pfx` ou via integração, faria a requisição mTLS à Sefin com o IP e certificado autorizados, burlando a limitação do navegador. O *mocking* temporário na API (como em `api-service.js`) deverá ser desabilitado.

### 2.3. Eventos de Ofício (Anulação de Rejeição e Confirmação Tácita)
* **Status:** Parcialmente Implementado (⚠️)
* **Motivo:** Embora a estrutura base e a rota estejam desenhadas em `eventos.js`:
  - **Cancelamento/Bloqueio/Anulação por Ofício:** São atos privativos da autoridade administrativa. O contribuinte não tem o botão ou privilégio para despachá-los.
  - **Confirmação Tácita (e105105):** É gerada automaticamente (`cron job`) pela Sefin da plataforma nacional pelo decurso de prazo. Nenhuma ação voluntária via formulário ocorre.
* **Proposta para o Futuro:**
  O sistema de listagem de eventos precisa estar sempre sincronizado com as consultas no ADN (`GET /NFSe/{ChaveAcesso}/Eventos`) para capturar esses eventos sistêmicos de forma passiva, atualizando o status visual da nota (se rejeitada, deferida ou cancelada).

### 2.4. Catálogo Completo de CSTs PIS/COFINS
* **Status:** Parcialmente Implementado (⚠️)
* **Motivo:** A NT 007 v1.0 ampliou o escopo do PIS/COFINS (códigos 00 a 99). Para fins de fluidez no carregamento e facilidade para emissão de Notas Fiscais de **Serviço**, a tabela foi recortada para ocultar códigos inativos ou de uso irrestrito a comércio de mercadorias (ex: faixas 10-48, 57-59, 76-97). 
* **Proposta para o Futuro:**
  Criar uma opção avançada na tela de configuração fiscal (`[ ] Exibir tabela completa de CSTs PIS/COFINS de Comércio`) para os casos em que o contribuinte misture receitas operacionais que utilizem códigos residuais de apuração unificada, restaurando as faixas omitidas.

---

## 3. Estratégia para a Próxima Fase (Roadmap)

A tabela abaixo sumariza as prioridades de evolução tecnológica do Freire NFS-e com base nestes gaps:

| Fase | Título | Foco / Ação | Prioridade | Complexidade |
|------|--------|-------------|------------|--------------|
| **V2.0** | **Integração BFF para mTLS** | Desenvolver backend em Node.js (Proxy) para assinar pacotes mTLS em requisição à Sefin Nacional. | 🔴 Alta | Alta |
| **V2.1** | **Componente Auxiliar A3** | Pesquisa e desenvolvimento de bridge Java/C# para leitura de tokens físicos (PKCS#11). | 🟡 Média | Alta |
| **V2.2** | **Módulo Administrativo (Sefin)**| Desenvolver painel para Prefeituras com permissão de POST nas APIs de parâmetros de convênio. | 🟡 Média | Média |
| **V2.3** | **Sincronização Passiva de Eventos** | Implementar webhooks (ou long polling) ao consultar chaves na ADN para atualizar eventos de ofício na UI. | 🟢 Baixa | Baixa |
| **V2.4** | **Gestão do MAN** | Estudo de P&D nas APIs de arrecadação da RFB para construção do módulo consolidador do Simples/MAN. | 🟢 Baixa | Média |

---
*Gerado por Freire AI — Março de 2026.*
