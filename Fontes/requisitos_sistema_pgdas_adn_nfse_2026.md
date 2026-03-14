# Requisitos de Sistema — PGDAS × ADN / NFS-e Padrão Nacional (2026)

> **Base legal:** LC 214/2025 · NT SE/CGNFS-e nº 004 v2.0 · NT 007/2026 · Portaria CGSN nº 54/2025 · Resolução CGSN nº 140/2018
> **Versão do documento:** 1.0 — março/2026

---

## Sumário

1. [Contexto e premissas](#1-contexto-e-premissas)
2. [Camada 1 — Emissão e classificação do regime tributário na NFS-e](#2-camada-1--emissão-e-classificação-do-regime-tributário-na-nfs-e)
3. [Camada 2 — Gestão do PGDAS-D e apuração do ISSQN](#3-camada-2--gestão-do-pgdas-d-e-apuração-do-issqn)
4. [Camada 3 — Módulo de Apuração Nacional (MAN NFSe) e geração de guia](#4-camada-3--módulo-de-apuração-nacional-man-nfse-e-geração-de-guia)
5. [Camada 4 — Integridade histórica e base de cálculo do coeficiente IBS](#5-camada-4--integridade-histórica-e-base-de-cálculo-do-coeficiente-ibs)
6. [Camada 5 — Integração técnica e segurança](#6-camada-5--integração-técnica-e-segurança)
7. [Matriz de priorização](#7-matriz-de-priorização)
8. [Cronograma de transição](#8-cronograma-de-transição)
9. [Glossário](#9-glossário)

---

## 1. Contexto e premissas

A partir de 1º de janeiro de 2026, a LC 214/2025 tornou obrigatória a integração de todos os municípios ao Ambiente de Dados Nacional (ADN) da NFS-e, modificando profundamente o ecossistema de emissão, apuração e recolhimento do ISSQN. Para contribuintes do Simples Nacional, o impacto se concentra em dois eixos:

- **Eixo 1 — Emissão:** a NFS-e deve agora declarar explicitamente o regime de apuração do ISS (via PGDAS-D ou via guia municipal), além de incluir campos informativos de IBS e CBS conforme a Reforma Tributária.
- **Eixo 2 — Apuração:** o PGDAS-D passa por novas regras de prazo e multa automática, e deve ser reconciliado com as NFS-e registradas no ADN.

### Enquadramento por faixa de receita bruta (2026)

| Faixa de Receita Bruta (RBT12) | Regime de recolhimento do ISS | Impacto no PGDAS-D |
|---|---|---|
| Até R$ 3,6 milhões | ISS recolhido de forma unificada via DAS (PGDAS-D) | Sem alteração estrutural |
| Entre R$ 3,6 milhões e R$ 4,8 milhões (sublimite) | ISS recolhido via guia municipal própria; tributos federais permanecem no DAS | Segregação obrigatória no sistema |
| Acima de R$ 4,8 milhões | Exclusão do Simples Nacional; regime normal (LP ou LR) | Migração completa de obrigações |

> **Atenção estratégica:** O desempenho de arrecadação do ISSQN entre 2019 e 2026 compõe a **receita média de referência** que definirá o coeficiente de participação do município na distribuição do IBS entre 2029 e 2077. Falhas na arrecadação em 2026 têm consequências fiscais permanentes para o ente municipal.

---

## 2. Camada 1 — Emissão e classificação do regime tributário na NFS-e

### Objetivo
Garantir que toda NFS-e transmitida ao ADN contenha a classificação correta do regime tributário do emitente e os campos exigidos pela Reforma Tributária, evitando rejeições e inconsistências fiscais.

---

### R1 — Parametrização automática do campo `<regApurTribSN>`

**Descrição:** O sistema deve identificar automaticamente, a partir do cadastro fiscal do contribuinte (CNPJ + vínculo ao Simples Nacional no CGSN), se a apuração do ISS ocorrerá via PGDAS-D ou via guia municipal, preenchendo o campo `<regApurTribSN>` na DPS sem intervenção manual do usuário.

**Valores possíveis:**
- `1` — Regime de apuração dos tributos federais e municipais pelo Simples Nacional (ISS via DAS/PGDAS-D)
- `2` — Regime de apuração do ISS fora do Simples Nacional (sublimite atingido; guia municipal)
- `3` — MEI/SIMEI

**Critério de aceite:**
- Ao emitir uma NFS-e, o campo é preenchido corretamente sem ação do usuário em 100% dos casos.
- Em caso de mudança de enquadramento (ex.: atingimento do sublimite), o sistema atualiza o campo na mesma competência em que a mudança ocorre.
- Testes devem cobrir os três valores e o momento de transição entre faixas.

**Dependências:** API do CGSN para consulta de situação cadastral; regra de cálculo acumulado de RBT12.

---

### R2 — Bloqueio automático do recolhimento do ISS via DAS ao atingir o sublimite

**Descrição:** O sistema deve monitorar em tempo real a Receita Bruta Acumulada dos últimos 12 meses (RBT12). Ao atingir R$ 3,6 milhões, deve:

1. Impedir que novas NFS-e sejam emitidas com o ISS vinculado ao DAS.
2. Gerar alerta automático para o responsável contábil e para o gestor da empresa.
3. Redirecionar o fluxo de recolhimento do ISS para a guia municipal do respectivo município.
4. Registrar o evento de mudança de regime com carimbo de data/hora e justificativa no log de auditoria.

**Critério de aceite:**
- A transição é detectada e aplicada no mesmo período de apuração em que a RBT12 ultrapassa R$ 3,6 milhões.
- O alerta é enviado por e-mail e exibido no painel do sistema com antecedência mínima de uma emissão.
- O log de auditoria é imutável e exportável em CSV/PDF.

**Referência legal:** Portaria CGSN nº 54/2025; LC 123/2006, art. 13-A.

---

### R3 — Preenchimento dos grupos IBSCBS na NFS-e para regime normal

**Descrição:** Para contribuintes do regime normal (Lucro Presumido, Lucro Real ou Simples Nacional no sublimite), o sistema deve preencher os grupos `IBSCBS` no XML da NFS-e com:

| Campo | Obrigatoriedade 2026 | Valor referência |
|---|---|---|
| `CST` (Código de Situação Tributária) | Obrigatório (informativo) | Conforme tabela NT 007 |
| `cClassTrib` (Código de Classificação Tributária) | Obrigatório (informativo) | Conforme NT 004/NT 007 |
| `pAliqIBS` (alíquota IBS municipal) | Obrigatório (informativo) | 0,1% em 2026 |
| `pAliqCBS` (alíquota CBS federal) | Obrigatório (informativo) | 0,9% em 2026 |
| `cNBS` (Nomenclatura Brasileira de Serviços) | Obrigatório se IBSCBS preenchido | Tabela Anexo VIII – NT |

> **Nota:** Em 2026, os valores de IBS e CBS são **informativos** — não impactam o DAS nem geram débito adicional ao contribuinte do Simples Nacional. Porém, a **ausência dos campos** em documentos do regime normal configura descumprimento legal (LC 214/2025) e pode resultar em penalidades.

**Critério de aceite:**
- Documentos do regime normal transmitidos ao ADN sem os campos IBSCBS devem ser sinalizados como pendentes antes da transmissão.
- Para Simples Nacional (≤ R$ 3,6 mi), os campos devem ser marcados como "por dentro do DAS" e não geram destaque de retenção.
- O sistema deve ser atualizado sempre que novas versões de NT forem publicadas no portal gov.br/nfse.

---

## 3. Camada 2 — Gestão do PGDAS-D e apuração do ISSQN

### Objetivo
Assegurar a integridade, tempestividade e consistência entre as informações declaradas no PGDAS-D e as NFS-e registradas no ADN, considerando as novas regras de multa automática.

---

### R4 — Reconciliação automática PGDAS-D × ADN

**Descrição:** O sistema deve, mensalmente, consumir a API do ADN para baixar as NFS-e autorizadas do contribuinte na competência e comparar automaticamente a soma dos valores de serviços com o total de receita bruta de serviços declarado no PGDAS-D.

**Fluxo esperado:**
1. No dia 15 de cada mês (D-5 antes do vencimento), o sistema executa a reconciliação automática.
2. Divergências acima de R$ 1,00 são sinalizadas com detalhamento por NFS-e.
3. O responsável contábil recebe relatório de divergências por e-mail e no painel.
4. O usuário pode ajustar o PGDAS-D antes do vencimento ou justificar a divergência (ex.: notas canceladas, deduções legais).

**Critério de aceite:**
- Cobertura: 100% das NFS-e autorizadas no ADN para o CNPJ na competência analisada.
- Relatório de divergências exportável em PDF e XLSX.
- Histórico de reconciliações armazenado por no mínimo 5 anos.

---

### R5 — Monitor de prazo e alertas do PGDAS-D

**Descrição:** Em função da multa automática aplicada a partir do dia 21 (sem notificação prévia), o sistema deve implementar um fluxo de alertas escalonados:

| Gatilho | Ação do sistema |
|---|---|
| Dia 17 do mês | Notificação: "Prazo PGDAS-D em 3 dias — revise as receitas" |
| Dia 19 do mês | Alerta crítico: "Último dia útil para envio do PGDAS-D" |
| Dia 20 às 23h50 | Alerta de emergência com link direto ao portal do Simples Nacional |
| Dia 21 (vencimento) | Registro automático de pendência + estimativa de multa no painel |

**Critério de aceite:**
- Alertas enviados por e-mail, SMS (opcional) e notificação no painel.
- O sistema não bloqueia a emissão de NFS-e por atraso no PGDAS-D, mas exibe banner de aviso em todas as telas.
- O histórico de alertas enviados é auditável.

**Referência legal:** LC 214/2025 — nova regra de multa automática a partir de 01/01/2026.

---

### R6 — Rastreabilidade por competência (NFS-e × PA do PGDAS-D)

**Descrição:** Cada NFS-e emitida deve estar vinculada ao Período de Apuração (PA) correspondente no PGDAS-D, garantindo rastreabilidade fiscal completa.

**Regras de vínculo:**
- A competência da NFS-e é determinada pela **data de prestação do serviço** (campo `<dtCompetencia>` da DPS), não pela data de emissão.
- NFS-e emitidas fora da competência (retroativas ou antecipadas) devem ser sinalizadas e vinculadas ao PA correto.
- Cancelamentos e substituições devem refletir automaticamente no PA original.

**Critério de aceite:**
- Relatório de NFS-e por PA disponível a qualquer momento, com drill-down até o XML da nota.
- Inconsistências de vínculo (ex.: nota com data de serviço em mês diferente da competência declarada) geram alerta antes da transmissão ao ADN.

---

## 4. Camada 3 — Módulo de Apuração Nacional (MAN NFSe) e geração de guia

### Objetivo
Integrar o sistema ao MAN NFSe para realizar o fechamento mensal, calcular o ISSQN devido e emitir a guia de arrecadação — nacional ou municipal, conforme o regime do contribuinte.

---

### R7 — Integração API REST com o MAN NFSe

**Descrição:** O sistema deve implementar integração completa com a API REST do MAN NFSe para:

1. **Seleção de NFS-e:** listar e selecionar as notas da competência a serem incluídas no fechamento.
2. **Cálculo do ISSQN:** acionar o motor de cálculo do MAN, que processa deduções, retenções e alíquotas municipais.
3. **Registro de débitos adicionais:** inserir débitos municipais informados pela prefeitura (ex.: autos de infração, diferenças de alíquota).
4. **Emissão da guia:** gerar o Documento de Arrecadação com código de barras/QR Code válido.

**Especificações técnicas:**
- Protocolo: HTTPS com TLS 1.2 ou superior.
- Autenticação: certificado digital ICP-Brasil, tipo A1 ou A3.
- Formato de dados: JSON (API REST) e XML (DPS/NFS-e).
- Tratamento de erros: retry automático com backoff exponencial para falhas de conectividade; fila de reprocessamento para erros de negócio.

**Critério de aceite:**
- Fechamento mensal executável em no máximo 3 cliques pelo usuário.
- Tempo de resposta da API de emissão de guia: < 10 segundos em condições normais.
- Em caso de indisponibilidade do MAN, o sistema armazena a solicitação em fila e reprocessa automaticamente.

---

### R8 — Roteamento de guia conforme regime (DAS × guia municipal)

**Descrição:** O sistema deve diferenciar o destino da guia de ISSQN conforme o regime do contribuinte:

| Regime | Destino da guia | Instrumento |
|---|---|---|
| Simples Nacional (≤ R$ 3,6 mi) | Incorporado ao DAS | PGDAS-D — sem guia separada |
| Sublimite (R$ 3,6–4,8 mi) | Guia municipal (sistema da prefeitura) | DAM ou equivalente do município |
| Regime normal | MAN NFSe ou guia municipal | Conforme município (ADN integrado ou próprio) |
| MEI/SIMEI | Incorporado ao DAS fixo | PGDAS-D — sem guia separada |

**Critério de aceite:**
- Nenhum contribuinte no sublimite pode gerar guia via DAS para o ISS.
- O sistema identifica o município competente para prestações intermunicipais e roteia corretamente.
- Em caso de mudança de regime no decorrer do exercício, o roteamento é atualizado na mesma competência.

---

## 5. Camada 4 — Integridade histórica e base de cálculo do coeficiente IBS

### Objetivo
Preservar e auditar o histórico de arrecadação do ISSQN entre 2019 e 2026, que compõe a receita média de referência utilizada para definir o coeficiente de distribuição do IBS entre 2029 e 2077.

---

### R9 — Armazenamento imutável do histórico de arrecadação 2019–2026

**Descrição:** O sistema deve garantir que todos os registros de arrecadação de ISSQN (emissão de NFS-e, pagamentos de guia, retenções na fonte, cancelamentos e substituições) sejam armazenados de forma imutável, com hash de integridade, para o período de 2019 a 2026.

**Dados a preservar por competência:**
- Total de NFS-e autorizadas (quantidade e valor bruto).
- Total de ISSQN apurado, deduções aplicadas e ISSQN líquido recolhido.
- ISSQN retido na fonte (por tomador) e repassado ao município.
- Cancelamentos e substituições com justificativa.
- Guias emitidas e comprovantes de pagamento (quando disponíveis via API bancária).

**Critério de aceite:**
- Relatório consolidado por ano-calendário (2019–2026) exportável em CSV, XLSX e PDF.
- Hash SHA-256 de cada registro gravado no momento da criação e verificável a qualquer momento.
- Dados acessíveis por no mínimo 10 anos após 2026 (até 2036), conforme obrigação fiscal.

> **Impacto estratégico:** Falhas de arrecadação em 2026 reduzem permanentemente o coeficiente do município no IBS de 2029 a 2077. O sistema deve contribuir ativamente para maximizar a arrecadação no período de referência, especialmente nos casos de retenção na fonte que muitas vezes não são declarados pelos tomadores.

---

## 6. Camada 5 — Integração técnica e segurança

### Objetivo
Estabelecer os padrões técnicos de comunicação, segurança e manutenção do sistema em conformidade com a infraestrutura do ADN e dos sistemas municipais.

---

### R10 — Padrões de comunicação e certificação digital

**Descrição:** Toda comunicação entre o sistema e o ADN, MAN NFSe, sistemas municipais e PGDAS-D deve seguir:

- **Formato de dados:** XML 1.0 UTF-8 com namespace W3C; JSON para APIs REST.
- **Protocolo:** HTTPS com TLS 1.2 ou superior; autenticação mútua (mTLS) onde exigido.
- **Certificado digital:** ICP-Brasil tipo A1 (arquivo) ou A3 (token/smartcard); renovação automática com alerta 30 dias antes do vencimento.
- **Assinatura digital:** XMLDSig para documentos XML (DPS e NFS-e).

**Critério de aceite:**
- Nenhum documento é transmitido sem assinatura digital válida.
- O sistema rejeita conexões com versões de TLS inferiores a 1.2.
- Alertas automáticos de vencimento de certificado com 30, 15 e 7 dias de antecedência.

---

### R11 — API REST para transmissão de DPS ao ADN

**Descrição:** O sistema deve implementar o cliente da API REST do ADN para transmissão de DPS (Declaração de Prestação de Serviço), respeitando:

- Tratamento de **pulos de numeração:** situações em que a numeração sequencial da NFS-e não é contínua (falhas técnicas na plataforma nacional) não devem gerar rejeição automática nem inconsistências contábeis.
- **Lote vs. individual:** suporte à transmissão em lote (RPS → DPS) para contribuintes de alto volume.
- **Consulta de status:** polling periódico para acompanhar autorização, rejeição ou pendência de cada DPS transmitida.
- **Download de XML autorizado:** armazenamento local do XML da NFS-e autorizada pelo ADN para fins de guarda fiscal (5 anos).

**Critério de aceite:**
- Taxa de sucesso de transmissão ≥ 99% em ambiente de produção.
- Documentos rejeitados são enfileirados para correção com detalhamento do erro em linguagem não técnica para o usuário.
- O histórico de transmissões é auditável com timestamp, status e código de retorno do ADN.

---

### R12 — Ambiente de homologação e gestão de versões de NT

**Descrição:** O sistema deve manter um ambiente de homologação sincronizado com o ambiente de Produção Restrita do ADN, permitindo testar novas versões de Nota Técnica antes da implantação em produção.

**Processo de gestão de versões:**
1. Publicação de nova NT no portal gov.br/nfse → gatilho de alerta automático para a equipe de desenvolvimento.
2. Análise de impacto (campos novos, campos alterados, regras de validação novas).
3. Implementação e testes em homologação (prazo: até 30 dias antes da obrigatoriedade).
4. Deploy em produção com feature flag, permitindo rollback em caso de falha.

**NTs vigentes em março/2026:**
- NT 004 v2.0 — layout DPS/NFS-e com grupos IBSCBS (obrigatória desde 01/01/2026)
- NT 007/2026 — ajustes IBS/CBS, PIS/COFINS/CSLL, numeração de NFS-e (obrigatória desde fev/2026)
- NT 005 — locação de bens móveis/imóveis (data de obrigatoriedade a ser publicada)

**Critério de aceite:**
- O sistema está homologado na versão vigente mais recente do ADN.
- Novas NTs são analisadas em até 5 dias úteis após publicação.
- Deploy de atualização de NT em produção em até 30 dias após análise de impacto.

---

### R13 — Sincronização do DAS com campos CBS/IBS informativos

**Descrição:** Para contribuintes do Simples Nacional, o sistema deve:

1. Incluir os campos CBS (0,9%) e IBS (0,1%) nas NFS-e como **informativos** em 2026, sem impactar o cálculo do DAS.
2. Sinalizar claramente ao usuário que esses valores são simbólicos em 2026 e que o impacto real inicia em 2027 (com alíquotas progressivas até 2033).
3. Preparar a base de dados para armazenar os valores de CBS e IBS por NFS-e, viabilizando o cálculo futuro quando se tornarem efetivos.

**Cronograma de alíquotas CBS/IBS para Simples Nacional:**

| Ano | CBS | IBS | Caráter |
|---|---|---|---|
| 2026 | 0,9% | 0,1% | Informativo (não cobrado) |
| 2027 | Progressivo | Progressivo | Efetivo (início) |
| 2033 | Alíquota cheia | Alíquota cheia | Pleno |

**Critério de aceite:**
- NFS-e emitidas pelo Simples Nacional sem os campos CBS/IBS informativos devem ser sinalizadas antes da transmissão.
- O painel exibe projeção de impacto futuro do CBS/IBS no fluxo de caixa da empresa (funcionalidade de planejamento).

---

## 7. Matriz de priorização

| Código | Requisito | Prioridade | Prazo de Implementação | Status sugerido |
|---|---|---|---|---|
| R1 | Parametrização automática do regime na DPS | 🔴 Crítico | Imediato | Obrigatório |
| R2 | Bloqueio ao atingir sublimite + roteamento de guia | 🔴 Crítico | Imediato | Obrigatório |
| R5 | Monitor de prazo e alertas PGDAS-D | 🔴 Crítico | Imediato | Obrigatório |
| R4 | Reconciliação ADN × PGDAS-D | 🟠 Alto | Curto prazo (até 60 dias) | Obrigatório |
| R7 | Integração API REST MAN NFSe | 🟠 Alto | Curto prazo (até 60 dias) | Obrigatório |
| R8 | Roteamento de guia por regime | 🟠 Alto | Curto prazo (até 60 dias) | Obrigatório |
| R10 | Padrões TLS + certificação ICP-Brasil | 🟠 Alto | Curto prazo (até 60 dias) | Obrigatório |
| R11 | API REST ADN — transmissão DPS | 🟠 Alto | Curto prazo (até 60 dias) | Obrigatório |
| R3 | Grupos IBSCBS no XML (regime normal) | 🟡 Médio | Médio prazo (até 90 dias) | Obrigatório |
| R6 | Rastreabilidade NFS-e × PA do PGDAS-D | 🟡 Médio | Médio prazo (até 90 dias) | Recomendado |
| R12 | Gestão de versões de NT / homologação | 🟡 Médio | Contínuo | Obrigatório |
| R13 | CBS/IBS informativos no DAS | 🟡 Médio | Em andamento | Obrigatório |
| R9 | Histórico imutável 2019–2026 | 🟢 Estratégico | Antes de 31/12/2026 | Crítico para longo prazo |

---

## 8. Cronograma de transição

```
2023 set  ──── MEI obrigado à NFS-e padrão nacional
2025 out  ──── Prazo recomendado para adesão municipal ao ADN
2025 dez  ──── NT 004 v2.0 publicada · Grupos IBSCBS desligados temporariamente
2026 jan  ──── OBRIGATORIEDADE GERAL · Todos os municípios no ADN
               NT 007/2026 em vigor · Multa automática PGDAS-D (dia 21)
2026 fev  ──── NT 007 obrigatória (ajustes IBS/CBS, PIS/COFINS)
2026 jul  ──── PF contribuintes CBS/IBS devem ter CNPJ (advogados, rurais, autônomos)
2027      ──── CBS/IBS começam a impactar efetivamente o Simples Nacional
2029      ──── Início da distribuição do IBS baseada na média 2019–2026
2033      ──── Alíquotas plenas do IBS/CBS · Extinção do ISS/ICMS/PIS/COFINS
2077      ──── Fim do período de transição federativa IBS
```

---

## 9. Glossário

| Termo | Definição |
|---|---|
| **ADN** | Ambiente de Dados Nacional — repositório central de NFS-e gerido pela Receita Federal |
| **CBS** | Contribuição sobre Bens e Serviços — substitui PIS/COFINS; competência federal |
| **cClassTrib** | Código de Classificação Tributária — identifica o regime de tributação da operação no XML da NFS-e |
| **CST** | Código de Situação Tributária — indica como a operação é tributada pelo IBS/CBS |
| **DAS** | Documento de Arrecadação do Simples Nacional — guia unificada do Simples |
| **DPS** | Declaração de Prestação de Serviço — documento prévio que origina a NFS-e no padrão nacional |
| **IBS** | Imposto sobre Bens e Serviços — substitui ISS e ICMS; competência compartilhada estados/municípios |
| **ISSQN** | Imposto Sobre Serviços de Qualquer Natureza — tributo municipal vigente durante a transição |
| **MAN NFSe** | Módulo de Apuração Nacional da NFS-e — realiza fechamento mensal e emite guia de ISSQN |
| **NBS** | Nomenclatura Brasileira de Serviços — código único nacional de classificação de serviços |
| **NFS-e** | Nota Fiscal de Serviço Eletrônica |
| **NT** | Nota Técnica — documento publicado pelo Comitê Gestor da NFS-e com especificações de layout e regras |
| **PA** | Período de Apuração — mês de referência no PGDAS-D |
| **PGDAS-D** | Programa Gerador do Documento de Arrecadação do Simples Nacional — Declaratório |
| **RBT12** | Receita Bruta Total dos últimos 12 meses — base para cálculo de alíquota e enquadramento no Simples |
| **Sublimite** | Limite de R$ 3,6 milhões acima do qual o ISS e o ICMS saem do DAS e são recolhidos separadamente |

---

*Documento gerado em março/2026. Recomenda-se atualização a cada publicação de nova Nota Técnica pelo Comitê Gestor da NFS-e (portal: gov.br/nfse).*
