# PLANO DE IMPLEMENTAÇÃO — Módulo Municipal (Recepção ADN e Apuração ISSQN)

**Versão 1.0 — Março de 2026**

Este documento estabelece a arquitetura, o backlog e os requisitos técnicos para a expansão do Ecossistema NFS-e Antigravity. O novo foco transforma o sistema em uma **plataforma para Prefeituras/Municípios**, atuando como repositório de notas emitidas no Emissor Nacional e motor de apuração e cobrança do ISSQN.

---

## 1. Visão Estratégica e Escopo 🎯

Com a implementação do Sistema Nacional NFS-e, os contribuintes podem emitir notas diretamente no portal da Receita Federal (Sefin Nacional). Para que o Município não perca arrecadação e controle fiscal, ele deve **importar essas notas de forma passiva** através do Ambiente de Dados Nacional (ADN) e processar a cobrança localmente.

### 1.1. Objetivos do Módulo
1. **Sincronização Ativa:** Consumir continuamente as APIs do ADN para baixar todas as NFS-es e Eventos onde o município seja parte interessada (prestador local, tomador local ou local de incidência).
2. **Repositório Fiscal:** Armazenar os documentos organizados por competência e contribuinte.
3. **Motor de Apuração (ISSQN):** Processar as NFS-es no fim do mês, calcular o imposto devido e abater as retenções (quando o município for o retentor).
4. **Emissão de Guias (DAM/Pix):** Gerar as guias de recolhimento para que os contribuintes paguem o ISSQN municipal.

---

## 2. Arquitetura de Integração (Backend / Workers) ⚙️

Como a aplicação atual é um Web Client (*Frontend-only*), este novo módulo exige a criação de um **Backend** autônomo. 

### 2.1. O "Varrimento" do ADN (Sincronização)
O município fará consultas à Sefin Nacional usando seu Certificado Raiz da Prefeitura via **mTLS**.

*   **Endpoint Principal:** `GET /DFe/{UltimoNSU}`
*   **Comportamento:** Retorna lotes de até 50 DF-es (Documentos Fiscais Eletrônicos). O loop continua até que o `UltimoNSU` local seja igual ao `maxNSU` retornado pela União.
*   **Regra de Rate-Limit:** Se não houver notas novas, o "worker" deve aguardar **1 hora** antes de tentar novamente, para evitar bloqueios na Sefin.

```mermaid
graph TD
    A[Worker Cron Node.js/C#] -->|GET /DFe/{NSU} + mTLS| B(Ambiente de Dados Nacional - ADN)
    B -->|Lote de 50 XMLs| A
    A --> C{Tipo de DF-e?}
    C -->|NFS-e| D[Salva no Banco: Tabela nfse_recebidas]
    C -->|Evento de Cancelamento| E[Atualiza Status da NFS-e Original]
    C -->|Evento de Substituição| F[Cancela Antiga, Salva Nova]
```

---

## 3. Modelagem de Dados Modificada 🗄️

O banco de dados precisa suportar o "Estado" do município e o "Fechamento Mensal" do contribuinte.

*   **`adn_sync_state`:** Armazena o `ultimo_nsu` lido. Vital para garantir que o worker saiba de onde parou em caso de queda do servidor.
*   **`nfse_recebidas`:** Armazena a nota em si. Colunas-chave: `chave_acesso`, `nsu`, `cnpj_prestador`, `cnpj_tomador`, `competencia` (Ex: 2026-03), `c_localidade_incid`, `valor_servicos`, `valor_iss_devido`, `status` (Ativa/Cancelada/Substituída).
*   **`apuracao_mensal`:** Tabela consolidada da competência.
    *   `id_apuracao`, `cnpj_contribuinte`, `competencia`, `total_notas_emitidas`, `total_iss_devido`, `total_iss_retido`, `valor_liquido_guia`, `status_pagamento`.
*   **`guia_recolhimento_dam`:** Vincula a Apuração a um Código de Barras / QR Code Pix e controla a baixa bancária.

---

## 4. Motor de Apuração do ISSQN e Cobrança 🧮

O processamento do imposto rodará no **1º dia útil de cada mês**, consolidando a competência anterior (Ex: Em 1º de Abril, processa-se Março).

### 4.1. Regras de Negócio da Apuração
1.  **Agrupamento:** O sistema agrupa todas as notas `Ativas` do município por `cnpj_prestador` na competência `X`.
2.  **Identificação do Local de Incidência (cLocalidadeIncid):**
    *   Soma os valores apenas das notas cujo `cLocalidadeIncid` seja **igual** ao código IBGE do Município logado;
    *   Ignora notas onde o imposto é devido a outro município.
3.  **Análise de Retenções (ISS Retido na Fonte):**
    *   Se no XML a tag `<cRetencao>` indicar "ISS Retido" e o tomador estiver em nossa cidade, a guia é gerada para o **Tomador**.
    *   Se for "ISS Devido", a guia é gerada para o **Prestador**.
4.  **Deduções e Regimes Especiais:** Aplicar descontos parametrizados caso o contribuinte seja Simples Nacional (que paga no DAS, ou seja, ignora para emissão de guia) municipal ou Mei.
5.  **Geração do Valor Final:** `vlr_guia = Soma(vISS_Devido) - Soma(vISS_Retido)`

### 4.2. Fluxo do Contribuinte (Dashboard)
O Município fornecerá um Portal Web onde o contador de cada empresa acessará usando GOV.BR ou senha:
*   Visualiza lista de notas emitidas contra e a favor de seu CNPJ no mês;
*   Visualiza o extrato contábil ("Extrato de Apuração");
*   Clica em **"Gerar Guia de Pagamento (DAM/Pix)"**;
*   Consulta certidões negativas de débitos municipais.

---

## 5. Fases de Implementação (Roadmap Municipal) 🗺️

| Fase | Épico / Módulo | Detalhamento Técnico | Prioridade |
|------|----------------|----------------------|------------|
| **Phase 1** | **Infra Backend & Segurança** | Criar serviço rodando em backend (Node.js/C#). Configurar autenticação bidirecional (mTLS) anexando o Certificado A1 da Prefeitura ao agente HTTP. | 🔴 Crítica |
| **Phase 2** | **Worker de Sincronização ADN** | Criar rotina agendada (Cron Job) que puxa a API `/DFe/{UltimoNSU}`, faz o *parse* dos XMLs, e salva dados estruturados em banco relacional (PostgreSQL). | 🔴 Crítica |
| **Phase 3** | **Tratamento de Filas e Eventos** | Processar eventos de XML. Se o Worker baixar um "Cancelamento", ele deve encontrar a NFS-e original pela Chave de Acesso no BD e mudar o status para "Cancelada/Irregular". | 🟡 Alta |
| **Phase 4** | **Motor de Apuração (M.A.)** | Algoritmo que lê as notas agrupadas do mês, aplica regras de localidade fiscal e calcula os consolidados de Débito (Guias). | 🟡 Alta |
| **Phase 5** | **Integração Bancária / PIX** | Geração e registro de boleto padrão Febraban ou QR Code Pix dinâmico atrelado à Conta Única do Tesouro Municipal. Retorno bancário automático (Baixa/Arquivo Retorno). | 🟢 Média |
| **Phase 6** | **Portal do Contribuinte (Frontend)**| Tela onde o cidadão autentica para imprimir sua Guia gerada, visualizar relatórios e declarar aceite de fechamento do mês. (Reaproveitar Antigravity UI). | 🟢 Média |

---

## 6. Riscos e Desafios Técnicos Adicionais ⚖️

1. **Volume de Dados Constante:** Cidades médias recebem milhões de requisições. A base de dados requerem tabelas particionadas no PostgreSQL (por mês de emissão) para não degradar a performance do motor de cálculo.
2. **Ordens Fora de Sequência:** O ADN deve entregar os eventos de maneira cronológica. O worker precisará suportar casos em que uma nota chega minutos antes de um cancelamento referenciado à ela.
3. **Decisões Judiciais (Bypass):** Notas emitidas através de decisões liminares (cStat=102) exigirão que a tela do auditor fiscal da prefeitura receba um alerta vermelho. Elas não entram no fluxo "cego" de apuração automatizada e exigem homologação manual no fim do mês.
4. **ISSQN Misto (IBS/CBS):** Considerando o período de transição (2026-2032), o motor terá de segregar o montante municipal do IBS do ISSQN legado para transferir ao Comitê Gestor futuramente.

---
*Gerado por Antigravity AI — Março de 2026. Alinhado ao Padrão Técnico do Emissor NFS-e Nacional.*
