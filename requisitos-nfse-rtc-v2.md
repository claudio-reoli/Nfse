# DOCUMENTO DE REQUISITOS — Sistema Nacional NFS-e

## Reforma Tributária do Consumo — Adequações NFS-e para IBS e CBS

**Versão 2.0 — Março de 2026**

*Consolidação completa de todos os documentos técnicos*

---

## Sumário

1. [Introdução e Contexto](#1-introdução-e-contexto)
2. [Arquitetura do Sistema Nacional NFS-e](#2-arquitetura-do-sistema-nacional-nfs-e)
3. [Requisitos de Layout XML da NFS-e](#3-requisitos-de-layout-xml-da-nfs-e)
4. [Atualizações da NT 007 (Fevereiro/2026)](#4-atualizações-da-nt-007-fevereiro2026)
5. [Novos Fatos Geradores](#5-novos-fatos-geradores)
6. [Requisitos de APIs](#6-requisitos-de-apis)
7. [Sistema de Eventos da NFS-e](#7-sistema-de-eventos-da-nfs-e)
8. [Esclarecimentos Operacionais](#8-esclarecimentos-operacionais)
9. [Cronograma e Transição](#9-cronograma-e-transição)
10. [Referência de Anexos Técnicos](#10-referência-de-anexos-técnicos)
11. [Requisitos Não-Funcionais e de Integração](#11-requisitos-não-funcionais-e-de-integração)

---

## 1. Introdução e Contexto

Este documento consolida todos os requisitos técnicos, funcionais e de negócio do Sistema Nacional da Nota Fiscal de Serviço Eletrônica (NFS-e) no contexto da Reforma Tributária do Consumo (RTC), instituída pela Emenda Constitucional nº 132/2023 e regulamentada pela Lei Complementar nº 214, de 16 de janeiro de 2025.

### 1.1. Fontes Documentais

| Documento | Descrição | Data |
|-----------|-----------|------|
| **NT SE/CGNFS-e 005 v1.1** | Novos grupos de layout da NFS-e para IBS e CBS | 19/11/2025 |
| **NT SE/CGNFS-e 007 v1.0** | Atualizações e esclarecimentos do layout NFS-e (indZFMALC, PIS/COFINS, novos fatos geradores, numeração) | 07/02/2026 |
| **Manual Contribuintes — Emissor Público API** | APIs Sefin Nacional: emissão, consulta, DPS, eventos | Out/2025 |
| **Manual Contribuintes — APIs ADN** | APIs do Ambiente de Dados Nacional para contribuintes (distribuição, consulta por NSU) | 12/02/2026 |
| **Manual Contribuintes — Decisão Adm/Judicial** | Fluxo de emissão por bypass para decisões administrativas ou judiciais | 26/01/2026 |
| **Manual Municípios — Emissor Público API** | APIs municipais: parâmetros, DPS, NFS-e, eventos | Out/2025 |
| **Manual Municípios — APIs ADN** | Compartilhamento e distribuição de DF-e via ADN, NSU, DANFSe | Out/2025 |
| **Guia do Painel Administrativo Municipal** | Parametrizações municipais no Sistema Nacional NFS-e | Out/2025 |
| **Guia do Emissor Público Nacional Web** | Interface web para emissão de NFS-e | v1.2 |
| **Anexos I a VII (XLSX)** | Layouts DPS/NFS-e, regras de negócio, eventos, ADN, painel administrativo, lista de serviços NBS, indicadores de operação IBS/CBS | Jan–Fev/2026 |

### 1.2. Objetivo

Fornecer uma referência única e completa dos requisitos para que equipes de desenvolvimento de software (empresas de TI, prefeituras e contribuintes) possam implementar as adequações necessárias nos sistemas emissores de NFS-e, contemplando: estrutura XML (DPS e NFS-e), APIs REST, regras de validação, novos tributos (IBS/CBS), eventos, integração com ADN e fluxos especiais.

### 1.3. Escopo da Reforma Tributária no Sistema NFS-e

A EC 132/2023 criou dois novos tributos sobre o consumo que substituirão gradualmente os tributos existentes:

- **IBS (Imposto sobre Bens e Serviços):** competência compartilhada entre Estados e Municípios. Incide "por fora" (não integra a própria base de cálculo). Possui parcelas estadual (IBS-UF) e municipal (IBS-Mun).
- **CBS (Contribuição sobre Bens e Serviços):** competência federal (União). Também incide "por fora". Substituirá gradualmente PIS e COFINS.

Esses tributos incidem sobre prestações de serviços formalizadas pela NFS-e, além de **novos fatos geradores** como locação de bens móveis e imóveis, cessão onerosa, arrendamento e operações com bens imateriais.

O período de transição se inicia em **2026** com alíquotas reduzidas de teste e se estende até **2032**, quando o ISSQN será extinto e o IBS/CBS assumirá integralmente a tributação de serviços.

---

## 2. Arquitetura do Sistema Nacional NFS-e

### 2.1. Fluxo de Emissão Regular

O processo de emissão segue o modelo:

1. O prestador de serviços preenche a **Declaração de Prestação de Serviços (DPS)** com os dados da operação.
2. A DPS é enviada à **Sefin Nacional** via API ou Emissor Web.
3. A plataforma **valida os dados**, **calcula tributos** (ISSQN, IBS, CBS) e **autoriza a NFS-e**.
4. A NFS-e gerada em XML é disponibilizada ao emissor e demais partes envolvidas.

A DPS é assinada digitalmente e **encapsulada dentro da NFS-e** autorizada. Dessa forma, a NFS-e contém dois blocos de informações: a DPS (campos informados pelo contribuinte) e os campos calculados/gerados pela plataforma.

### 2.2. Componentes Principais

| Componente | Descrição |
|------------|-----------|
| **Sefin Nacional** | Emissor Público Nacional responsável pela validação da DPS, cálculo de tributos e autorização da NFS-e. Disponível via API REST, Emissor Web e APP móvel. |
| **ADN (Ambiente de Dados Nacional)** | Repositório central de documentos fiscais eletrônicos (NFS-e e Eventos). Responsável pelo compartilhamento entre municípios e distribuição para contribuintes via NSU (Número Sequencial Único). |
| **Painel Administrativo Municipal** | Interface para parametrização municipal: alíquotas, regimes especiais, benefícios, retenções, conveniamento e controle de emissores públicos. |
| **Calculadora de Tributos** | Módulo integrado que calcula automaticamente IBS (estadual e municipal) e CBS com base nas alíquotas parametrizadas e regras da LC 214/2025. |
| **CNC (Cadastro Nacional de Contribuintes)** | Cadastro centralizado de contribuintes NFS-e com integrações ao CNPJ, CPF e Simples Nacional. |
| **MAN (Módulo de Apuração Nacional)** | Módulo futuro, de adesão voluntária pelos municípios, para centralização e automatização da apuração do ISSQN. Ainda em desenvolvimento. |

### 2.3. Canais de Emissão

A emissão pode ocorrer por três canais:

- **(a) API REST (Sefin Nacional):** integração sistema-a-sistema via certificado digital ICP-Brasil.
- **(b) Emissor Web:** interface web para emissão manual via navegador.
- **(c) APP móvel:** aplicativo para dispositivos móveis (quando disponível).

Todos os canais autenticam via **certificado digital ICP-Brasil** (e-CNPJ ou e-CPF).

---

## 3. Requisitos de Layout XML da NFS-e

### 3.1. Estrutura Geral do XML

O XML da NFS-e é composto por dois blocos principais:

- **DPS (preenchida pelo contribuinte):** encapsulada no caminho `NFSe/infNFSe/DPS/infDPS/`
- **Campos gerados pelo sistema:** diretamente em `NFSe/infNFSe/`

O caminho raiz é `NFSe/infNFSe/`, contendo a DPS e os campos calculados/gerados pela plataforma como irmãos no XML.

### 3.2. Glossário de Elementos do Layout

| Sigla | Tipo | Descrição |
|-------|------|-----------|
| **G** | Group | Tag de agrupamento de campos. Não possui valor próprio. |
| **E** | Element | Campo que deve ter valor informado. |
| **CG** | Choice Group | Grupo cuja informação depende de escolha do emitente (mutuamente exclusivo). |
| **CE** | Choice Element | Elemento de uma lista pré-determinada, selecionado pelo emitente. |
| **ID** | Identificador | Campo identificador único do documento. |
| **N** | Numérico | Valor numérico. |
| **C** | Caractere | Valor alfanumérico. |
| **D** | Data | Valor no formato AAAA-MM-DD. |

**Convenção de ocorrência:** `0-1` = opcional, única vez; `1-1` = obrigatório, única vez; `1-N` = obrigatório, até N vezes.

**Convenção de tamanho:** `14` = fixo 14 posições; `1-150` = variável de 1 a 150; `1-3V2` = 1 a 3 inteiros + 2 casas decimais.

### 3.3. Novo Grupo IBSCBS na DPS

O principal grupo inserido pela Reforma Tributária é o **IBSCBS**, localizado em `NFSe/infNFSe/DPS/infDPS/IBSCBS`. Trata-se de um grupo **opcional (ocorrência 0-1)** que conterá todas as informações declaradas pelo contribuinte referentes ao IBS e à CBS. Quando os grupos IBSCBS se tornarem obrigatórios, a ocorrência passará a `1-1`.

#### 3.3.1. Campos Principais do Grupo IBSCBS na DPS

| Campo | ELE | Tipo | Ocor. | Tam. | Descrição |
|-------|-----|------|-------|------|-----------|
| `IBSCBS` | G | - | 0-1 | - | Grupo raiz de informações IBS/CBS declaradas pelo emitente |
| `finNFSe` | E | N | 1-1 | 1 | Finalidade da emissão: `0`=Regular, `1`=Crédito, `2`=Débito |
| `indFinal` | E | N | 1-1 | 1 | Indica operação de uso/consumo pessoal: `0`=Não, `1`=Sim |
| `cIndOp` | E | N | 1-1 | 6 | Código indicador da operação de fornecimento. Ref. AnexoVII e art. 11 da LC 214/2025 |
| `tpOper` | E | N | 0-1 | 1 | Tipo de operação com entes governamentais ou serviços sobre bens imóveis: `1`=Fornecimento c/ pagamento posterior; `2`=Recebimento do pagamento c/ fornecimento já realizado; `3`=Fornecimento c/ pagamento já realizado; `4`=Recebimento do pagamento c/ fornecimento posterior; `5`=Fornecimento e recebimento concomitantes |
| `gRefNFSe` | G | - | 0-1 | - | Grupo de NFS-e referenciadas |
| `refNFSe` | E | C | 1-99 | 50 | Chave(s) da(s) NFS-e referenciada(s) |
| `tpEnteGov` | E | N | 0-1 | 1 | Tipo de ente governamental: `1`=União, `2`=Estado, `3`=DF, `4`=Município |
| `indDoacao` | E | N | 0-1 | 1 | Indica operação de doação. Relaciona-se com `gEstornoCred` e `cClassTrib` |
| `indDest` | E | N | 1-1 | 1 | `0`=Destinatário é o próprio tomador/adquirente; `1`=Destinatário diferente do adquirente |
| `indZFMALC` 🆕 | E | N | 0-1 | 1 | **NOVO (NT 007):** Indicador de alíquota zero de CBS conforme art. 451 e 466 da LC 214/2025 (ZFM/ALC): `0`=Não, `1`=Sim |

> **⚠️ IMPORTANTE:** O campo `indZFMALC` foi inserido pela NT 007 e indica enquadramento nas situações dos artigos 451 e 466 da LC 214/2025 (Zona Franca de Manaus e Áreas de Livre Comércio), onde a alíquota da CBS é reduzida a zero.

**Observações sobre os campos:**
- O campo `cIndOp` referencia a tabela de indicadores de operação publicada no AnexoVII-IndOp_IBSCBS_V1.01.00.xlsx.
- As notas de ajuste (crédito e débito) no campo `finNFSe` estão em estudos técnicos e serão detalhadas em notas técnicas futuras.
- O campo `indDoacao` possui critérios de preenchimento que dependem da operação, relacionando-se com `gEstornoCred` e o código `cClassTrib`. Consultar a coluna "NOTAS EXPLICATIVAS" no AnexoVI e as regras de negócio correspondentes.

#### 3.3.2. Subgrupo `dest` — Informações do Destinatário

Quando `indDest=1` (destinatário diferente do tomador), o grupo `dest` deve ser preenchido.

| Campo | ELE | Tipo | Ocor. | Tam. | Descrição |
|-------|-----|------|-------|------|-----------|
| `dest` | G | - | 0-1 | - | Grupo de informações relativas ao Destinatário |
| `CNPJ` | CE | N | 1-1 | 14 | CNPJ do destinatário do serviço |
| `CPF` | CE | N | 1-1 | 11 | CPF do destinatário do serviço |
| `NIF` | CE | C | 1-1 | 40 | Número de identificação fiscal no exterior |
| `cNaoNIF` | CE | N | 1-1 | 1 | Motivo para não informação do NIF: `0`=Não informado na nota de origem; `1`=Dispensado; `2`=Não exigência |
| `xNome` | E | C | 1-1 | 150 | Nome / Razão Social do destinatário |
| `end` | G | - | 0-1 | - | Grupo de endereço do destinatário |
| `endNac/cMun` | E | N | 1-1 | 7 | Código do município (IBGE) |
| `endNac/CEP` | E | C | 1-1 | 8 | CEP do endereço |
| `endExt/cPais` | E | C | 1-1 | 2 | Código do país (ISO) |
| `endExt/cEndPost` | E | C | 1-1 | 1-11 | Código postal no exterior |
| `endExt/xCidade` | E | C | 1-1 | 1-60 | Cidade no exterior |
| `endExt/xEstProvReg` | E | C | 1-1 | 1-60 | Estado/província/região no exterior |
| `xLgr` | E | C | 1-1 | 1-255 | Logradouro |
| `nro` | E | C | 1-1 | 1-60 | Número |
| `xCpl` | E | C | 0-1 | 1-156 | Complemento |
| `xBairro` | E | C | 1-1 | 1-60 | Bairro |
| `fone` | E | N | 0-1 | 6-20 | Telefone (DDD + número; exterior: país + localidade + número) |
| `email` | E | C | 0-1 | 1-80 | E-mail |

#### 3.3.3. Subgrupo `imovel` — Operações com Bens Imóveis (exceto obras)

Para operações de locação, cessão onerosa, arrendamento, servidão ou permissão de uso de bens imóveis.

| Campo | ELE | Tipo | Ocor. | Tam. | Descrição |
|-------|-----|------|-------|------|-----------|
| `imovel` | G | - | 0-1 | - | Grupo de informações de operações com bens imóveis |
| `inscImobFisc` | E | C | 0-1 | 1-30 | Inscrição imobiliária fiscal (código da prefeitura) |
| `cCIB` | CE | C | 1-1 | 8 | Código do Cadastro Imobiliário Brasileiro (CIB) |
| `end` | CG | - | 1-1 | - | Endereço do imóvel (nacional via CEP ou exterior via endExt) |
| `xLgr`, `nro`, `xCpl`, `xBairro` | E | C | - | - | Campos de endereço completo |

> **📝 NOTA:** Para serviços de obra, utilizar o grupo `obra` já existente em `NFSe/infNFSe/DPS/infDPS/serv/`. Para serviços do subitem 99.03, utilizar NBS `1.1002.10.00` (imóvel residencial) ou `1.1002.20.00` (não residencial).

#### 3.3.4. Subgrupo `gLocBensMoveis` — Locação de Bens Móveis

Grupo com ocorrência **0-99**, específico para locação de bens móveis (`cTribNac = 99.04.01`).

| Campo | ELE | Tipo | Ocor. | Tam. | Descrição |
|-------|-----|------|-------|------|-----------|
| `gLocBensMoveis` | G | - | 0-99 | - | Grupo de informações dos bens móveis objeto de locação |
| `cNCMBemMovel` | E | N | 1-1 | 8 | Código NCM do bem móvel |
| `xNCMBemMovel` | E | C | 1-1 | 1-150 | Descrição do bem móvel |
| `qtdNCMBemMovel` | E | N | 1-1 | 3 | Quantidade de bens móveis |

> **⚠️ IMPORTANTE:** A locação de bens móveis, por ser fato gerador de IBS/CBS mas **não** de ISSQN, será autorizada no ambiente nacional **independente** da adesão municipal e da opção pelos emissores públicos nacionais. Esse grupo só pode ser informado quando `cTribNac = 99.04.01`.

#### 3.3.5. Subgrupo `valores` — Informações de Valores para IBS e CBS

O grupo `valores` em `IBSCBS` (ocorrência 1-1) contém três subgrupos principais:

**a) `gReeRepRes` (0-1) — Reembolso, Repasse e Ressarcimento**

Valores incluídos neste documento recebidos por operações de terceiros, já tributados. Permite referenciar até **1.000 documentos**, que podem ser:

- `dFeNacional`: DF-e do repositório nacional (NFS-e, NF-e, CT-e, Outro) com `chaveDFe`
- `docFiscalOutro`: Documento fiscal fora do repositório nacional (com `cMunDocFiscal`, `nDocFiscal`, `xDocFiscal`)
- `docOutro`: Documento não fiscal (com `nDoc`, `xDoc`)

Cada documento deve informar: fornecedor (CNPJ/CPF/NIF), tipo de reembolso (`tpReeRepRes`: `01`=Repasse intermediação imóveis, `02`=Repasse turismo, `03`=Reembolso propaganda/produção, `04`=Reembolso propaganda/mídia, `99`=Outros), valor (`vlrReeRepRes`), data de emissão e competência.

**b) `gDedRedIBSCBS` (0-1000) — Deduções e Reduções da Base de Cálculo**

Valores de dedução e redução da base de cálculo do IBS e CBS para operações com imóveis e serviços médicos:

| Código | Tipo de Dedução/Redução | Aplicação |
|--------|-------------------------|-----------|
| `01` | Tributos inclusos no aluguel (IPTU, contribuição de melhoria) | NBS 1.1002.10.00 ou 1.1002.20.00 |
| `02` | Emolumento incluso no aluguel | NBS 1.1002.10.00 ou 1.1002.20.00 |
| `03` | Condomínio incluso no aluguel | NBS 1.1002.10.00 ou 1.1002.20.00 |
| `04` | Redutor Social | Apenas NBS 1.1002.10.00 (residencial) |
| `05` | Glosa de Serviços Médicos | Serviços médicos |
| `99` | Outras parcelas inclusas no aluguel | Requer `xTpDedRedIBSCBS` |

Cada item tem `vlrDedRedIBSCBS` (valor monetário em R$).

**c) `trib/gIBSCBS` (1-1) — Informações Tributárias IBS/CBS**

| Campo | ELE | Tipo | Ocor. | Tam. | Descrição |
|-------|-----|------|-------|------|-----------|
| `CST` | E | N | 1-1 | 3 | Código de Situação Tributária do IBS e da CBS |
| `cClassTrib` | E | N | 1-1 | 6 | Código de Classificação Tributária do IBS e da CBS |
| `cCredPres` | E | N | 0-1 | 2 | Código de classificação do crédito presumido |
| `gTribRegular` | G | - | 0-1 | - | Tributação regular: `CSTReg` (3 dígitos) e `cClassTribReg` (6 dígitos) |
| `gDif` | G | - | 0-1 | - | Diferimento: `pDifUF` (% IBS estadual), `pDifMun` (% IBS municipal), `pDifCBS` (% CBS) |
| `gEstornoCred` | G | - | 0-1 | - | Estornos de créditos: `vIBSEstCred` e `vCBSEstCred` |
| `gPagAntecipado` | G | - | 0-1 | - | NFS-e de pagamento antecipado: até 99 `refNFSe` |

### 3.4. Novo Grupo IBSCBS na NFS-e (campos calculados pelo sistema)

O grupo `IBSCBS` em `NFSe/infNFSe/` contém os campos **gerados automaticamente pela plataforma** a partir dos dados da DPS. Esses campos **não são informados pelo contribuinte** no fluxo regular.

#### 3.4.1. Informações Comuns

| Campo | ELE | Tipo | Ocor. | Tam. | Descrição |
|-------|-----|------|-------|------|-----------|
| `IBSCBS` | G | - | 0-1 | - | Grupo de informações geradas pelo sistema referentes ao IBS e à CBS |
| `cLocalidadeIncid` | E | N | 1-1 | 7 | Código IBGE da localidade de incidência do IBS/CBS (local da operação) |
| `xLocalidadeIncid` | E | C | 1-1 | 600 | Nome da localidade de incidência |
| `pRedutor` | E | C | 0-1 | 1-2V2 | Percentual de redução de alíquota em compra governamental |

#### 3.4.2. Valores Brutos e Base de Cálculo

**Fórmula da Base de Cálculo (vBC):**

```
Até 2026:  vBC = vServ - descIncond - vCalcReeRepRes - vCalcDedRedIBSCBS - vISSQN - vPIS - vCOFINS
Até 2032:  vBC = vServ - descIncond - vCalcReeRepRes - vCalcDedRedIBSCBS - vISSQN
```

**Campos auxiliares:**
- `vCalcReeRepRes`: Total de valores de reembolso/repasse/ressarcimento não integrantes da BC
- `vCalcDedRedIBSCBS`: Total de deduções/reduções específicas do IBS/CBS

**Para cada esfera tributária (UF, Município, Federal):**

| Esfera | Alíquota | Redução | Alíquota Efetiva |
|--------|----------|---------|------------------|
| **IBS Estadual** | `pIBSUF` | `pRedAliqUF` | `pAliqEfetUF = pIBSUF × (1 - pRedAliqUF) × (1 - pRedutor)` |
| **IBS Municipal** | `pIBSMun` | `pRedAliqMun` | `pAliqEfetMun = pIBSMun × (1 - pRedAliqMun) × (1 - pRedutor)` |
| **CBS (Federal)** | `pCBS` | `pRedAliqCBS` | `pAliqEfetCBS = pCBS × (1 - pRedAliqCBS) × (1 - pRedutor)` |

> O IBS e a CBS são impostos **"por fora"**, ou seja, seus valores são adicionados ao valor total da NF.

#### 3.4.3. Grupos Totalizadores (`totCIBS`)

**Valor Total da NF:**
```
Em 2026:       vTotNF = vLiq
A partir 2027: vTotNF = vLiq + vCBS + vIBSTot
```

**Grupo `gIBS` — Totalizadores do IBS:**

| Campo | Fórmula |
|-------|---------|
| `vIBSTot` | `vIBSUF + vIBSMun` |
| `vIBSUF` | `vBC × (pIBSUF ou pAliqEfetUF)` |
| `vIBSMun` | `vBC × (pIBSMun ou pAliqEfetMun)` |
| `vDifUF` | `vIBSUF × pDifUF` (diferimento estadual) |
| `vDifMun` | `vIBSMun × pDifMun` (diferimento municipal) |
| `vCredPresIBS` | `vBC × pCredPresIBS` (crédito presumido IBS) |

**Grupo `gCBS` — Totalizadores da CBS:**

| Campo | Fórmula |
|-------|---------|
| `vCBS` | `vBC × (pCBS ou pAliqEfetCBS)` |
| `vDifCBS` | `vCBS × pDifCBS` (diferimento CBS) |
| `vCredPresCBS` | `vBC × pCredPresCBS` (crédito presumido CBS) |

**Grupo `gTribRegular` — Tributação Regular (quando aplicável):**

Contém alíquotas efetivas regulares e valores calculados para IBS-UF, IBS-Mun e CBS em cenários de tributação regular distintos da tributação principal.

**Grupo `gTribCompraGov` — Compras Governamentais (quando aplicável):**

Composição específica de alíquotas e valores de IBS (UF e Mun) e CBS para operações com entes governamentais.

---

## 4. Atualizações da NT 007 (Fevereiro/2026)

### 4.1. Campo `indZFMALC`

Novo campo na DPS (`NFSe/infNFSe/DPS/infDPS/IBSCBS/`) para indicar enquadramento nos **artigos 451 e 466 da LC 214/2025**, que tratam de operações de fornecimento favorecidas com **alíquota zero de CBS** na Zona Franca de Manaus (ZFM) e Áreas de Livre Comércio (ALC).

- **Tipo:** Numérico
- **Ocorrência:** 0-1
- **Tamanho:** 1
- **Valores:** `0` = Não; `1` = Sim

### 4.2. Tabela de Indicadores de Operação (AnexoVII v1.01.00)

Nova versão da tabela de códigos indicadores da operação referenciados no campo `cIndOp` da DPS. Baseada no **art. 11 da LC 214/2025**, contempla:

- Ajustes em códigos existentes
- Novos códigos para os novos fatos geradores formalizados pela NFS-e
- Possibilidade de utilização da mesma codificação em outros documentos fiscais

### 4.3. PIS/COFINS — Atualizações Críticas

> **⚠️ IMPORTANTE:** Essas atualizações estão disponíveis nos ambientes de **Produção e Produção Restrita** desde **09 de fevereiro de 2026**.

#### 4.3.1. Arredondamento e Tolerância

Para os campos `vPIS` e `vCofins`:

- **Método:** Arredondamento bancário (*half-even*)
- **Tolerância máxima:** R$ 0,01 (um centavo de real)
- Variações dentro desse limite não caracterizam divergência nos valores informados

#### 4.3.2. Código da Situação Tributária (CST) PIS/COFINS

Caminho: `NFSe/infNFSe/DPS/infDPS/valores/trib/tribFed/piscofins/CST`

O domínio foi **ampliado** para incluir todos os códigos de `00` a `99`:

| Faixa | Descrição |
|-------|-----------|
| `00` | Nenhum |
| `01-09` | Operações tributáveis (alíquota básica, diferenciada, por unidade, monofásica, substituição, alíquota zero, isenta, sem incidência, suspensão) |
| `49` | Outras operações de saída |
| `50-56` | Operações com direito a crédito (vinculada a receita tributada, não tributada, exportação, combinações) |
| `60-67` | Crédito presumido (aquisição vinculada a receitas tributadas, não tributadas, exportação, combinações, outras) |
| `70-75` | Operações de aquisição (sem crédito, com isenção, suspensão, alíquota zero, sem incidência, substituição tributária) |
| `98` | Outras operações de entrada |
| `99` | Outras operações |

#### 4.3.3. Tipo de Retenção PIS/COFINS e CSLL (`tpRetPisCofins`)

Caminho: `NFSe/infNFSe/DPS/infDPS/valores/trib/tribFed/piscofins/tpRetPisCofins`

O domínio foi **ampliado** para incluir CSLL nas combinações de retenção:

| Código | Descrição | Status |
|--------|-----------|--------|
| `0` | PIS/COFINS/CSLL **Não** Retidos | 🆕 Novo |
| `1` | PIS/COFINS Retido | ⚠️ **Será suprimido** quando IBSCBS obrigatório |
| `2` | PIS/COFINS Não Retido | ⚠️ **Será suprimido** quando IBSCBS obrigatório |
| `3` | PIS/COFINS/CSLL **Retidos** | 🆕 Novo |
| `4` | PIS/COFINS Retidos, CSLL Não Retido | 🆕 Novo |
| `5` | PIS Retido, COFINS/CSLL Não Retido | 🆕 Novo |
| `6` | COFINS Retido, PIS/CSLL Não Retido | 🆕 Novo |
| `7` | PIS Não Retido, COFINS/CSLL Retidos | 🆕 Novo |
| `8` | PIS/COFINS Não Retidos, CSLL Retido | 🆕 Novo |
| `9` | COFINS Não Retido, PIS/CSLL Retidos | 🆕 Novo |

> Os códigos `1` e `2` foram mantidos nesta versão para permitir uma **transição gradual** para municípios e contribuintes. Serão **suprimidos do schema** quando os grupos IBSCBS se tornarem obrigatórios. O novo domínio aceito será: `0` e `3` a `9`.

#### 4.3.4. Valor Relativo às Retenções de Contribuições Sociais

**Regra fundamental:** Se houver valores de retenção de PIS, COFINS e/ou CSLL, eles devem ser **SOMADOS** e informados no campo `vRetCSLL` conforme o que foi indicado em `tpRetPisCofins`.

> **⚠️ IMPORTANTE:** Os campos `vPis` e `vCofins` referem-se **exclusivamente** a valores de débito de apuração própria (valores devidos na operação). **NÃO** devem ser utilizados para informar valores RETIDOS. O uso incorreto desses campos acarretava a diminuição indevida da Base de Cálculo do IBS e da CBS, conforme o inciso V do § 2º do art. 12 da LC 214/2025.

A agregação no campo `vRetCSLL` dos valores retidos das três contribuições sociais **não deve alterar** a forma de prestação dessas informações na EFD-Reinf.

---

## 5. Novos Fatos Geradores

### 5.1. Códigos de Serviço (`cTribNac`) para Novos Fatos Geradores

| Código | Descrição |
|--------|-----------|
| `99.01.01` | Outros serviços sem incidência de ISSQN e ICMS *(uso residual: somente quando não se enquadrar nos demais códigos 99)* |
| `99.02.01` | Operações com Bens Imateriais Não Classificados em Itens Anteriores |
| `99.03.01` | Locação de Bens Imóveis |
| `99.03.02` | Cessão Onerosa de Bens Imóveis |
| `99.03.03` | Arrendamento de Bens Imóveis |
| `99.03.04` | Servidão, Cessão de Uso ou de Espaço de Bens Imóveis *(quando não caracterizem operações tributáveis pelo ISSQN)* |
| `99.03.05` | Permissão de Uso ou Direito de Passagem de Bens Imóveis *(quando não caracterizem operações tributáveis pelo ISSQN)* |
| `99.04.01` | Locação de Bens Móveis |

### 5.2. Regras dos Novos Fatos Geradores

1. **Sem destaque de ISSQN:** por padrão da plataforma NFS-e, os itens de serviço 99 não destacam ISSQN no documento fiscal.

2. **Autorização exclusiva na plataforma nacional:** os documentos fiscais desses novos fatos geradores devem ser autorizados **exclusiva e diretamente** pelos Emissores Públicos Nacionais (Sefin Nacional), seja via API, Web ou APP. Documentos autorizados em sistemas próprios dos municípios **serão rejeitados** ao serem compartilhados com o ADN.

3. **Emissão universal:** todas as pessoas, físicas ou jurídicas, estarão autorizadas a emitir esses documentos na plataforma nacional, **mesmo que** o Município de domicílio/estabelecimento tenha optado por não utilizar os emissores públicos nacionais.

4. **Código `99.01.01`:** deve ser utilizado **somente** quando houver operação que eventualmente incida IBS ou CBS, mas não o ISSQN, e que **não se enquadre** em nenhum dos demais códigos 99.

> **⚠️ IMPORTANTE:** As evoluções da plataforma NFS-e para a formalização dos documentos fiscais dessas operações **ainda estão em desenvolvimento**. O cronograma de implantações será publicado no portal da NFS-e.

---

## 6. Requisitos de APIs

### 6.1. API Sefin Nacional (Emissor Público) — Contribuintes

#### 6.1.1. API Parâmetros Municipais

Permite consultar configurações municipais necessárias para preenchimento da DPS.

| Método | Endpoint | Função |
|--------|----------|--------|
| `GET` | `/parametros_municipais/{codigoMunicipio}/convenio` | Parâmetros do convênio |
| `GET` | `/parametros_municipais/{codigoMunicipio}/{codigoServico}` | Alíquotas, regimes especiais, deduções/reduções por subitem |
| `GET` | `/parametros_municipais/{codigoMunicipio}/{CPF/CNPJ}` | Retenções do contribuinte |
| `GET` | `/parametros_municipais/{codigoMunicipio}/{CPF/CNPJ}` | Benefícios municipais do contribuinte |

#### 6.1.2. API NFS-e

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/nfse` | **Geração síncrona de NFS-e.** Recepciona DPS assinada, valida regras de negócio, calcula tributos. Retorna NFS-e autorizada (XML) ou mensagem de rejeição com motivo. Suporta **substituição**: quando a DPS contém chave de NFS-e a substituir, gera Evento de Cancelamento por Substituição automaticamente e a nova NFS-e substituta. |
| `GET` | `/nfse/{chaveAcesso}` | Consulta NFS-e pela chave de acesso |

**Integrações necessárias para processamento da DPS:**
- Parametrizações do convênio do município emissor
- Parametrizações municipais prévias no Sistema Nacional (alíquotas, regimes, benefícios)
- Cadastro Nacional de Contribuintes NFS-e (CNC)
- Integrações com cadastros CNPJ, CPF e Simples Nacional
- Calculadora de Tributos (IBS/CBS)

#### 6.1.3. API DPS

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/dps/{id}` | Recupera chave de acesso da NFS-e a partir do identificador da DPS. O identificador é formado por: Código IBGE Município (7) + Tipo Inscrição (1) + Inscrição Federal (14, CPF com zeros à esquerda) + Série DPS (5) + Número DPS (15). **Requer** que o certificado digital seja de um ator da NFS-e (Prestador, Tomador ou Intermediário). |
| `HEAD` | `/dps/{id}` | Apenas informa se a NFS-e foi gerada a partir da DPS, **sem retornar** a chave de acesso. Aceita qualquer certificado digital válido. |

#### 6.1.4. API Eventos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/nfse/{chaveAcesso}/eventos` | Registro genérico de eventos. Modelo único que trata eventos de forma genérica (cancelamento, manifestação etc.). Comunicação JSON; leiaute do DF-e em XML assinado. |
| `GET` | `/nfse/{chaveAcesso}/eventos` | Retorna todos os eventos vinculados à NFS-e |
| `GET` | `/nfse/{chaveAcesso}/eventos/{tipoEvento}` | Filtra eventos por tipo |
| `GET` | `/nfse/{chaveAcesso}/eventos/{tipoEvento}/{numSeqEvento}` | Evento específico por tipo e sequencial |

### 6.2. API Decisão Administrativa/Judicial (Bypass)

Fluxo especial para atender determinações judiciais ou administrativas que exigem desvio das regras padrão de validação.

**Pré-requisitos:**
1. O contribuinte deve solicitar ao **Município** que cadastre a decisão no sistema (número do processo administrativo ou judicial).
2. O Município autoriza o contribuinte a utilizar o fluxo específico.
3. Somente após isso, o contribuinte estará apto a emitir pelo bypass.

#### 6.2.1. Diferenças do Fluxo Regular

| Aspecto | Fluxo Regular | Fluxo Bypass |
|---------|--------------|--------------|
| **Documento enviado** | DPS (apenas dados básicos) | NFS-e **completa** (DPS + campos calculados) |
| **Cálculo de tributos** | Plataforma calcula | Contribuinte informa |
| **Local de incidência** | Plataforma determina | Contribuinte informa |
| **Alíquota** | Parametrizada pelo município | Contribuinte informa |
| **Validação** | Regras completas de negócio | Validações mínimas (dígitos verificadores etc.) |
| **Responsabilidade** | Compartilhada (sistema + contribuinte) | **Inteiramente do contribuinte** |

#### 6.2.2. Campos Específicos do Bypass

| Campo | Valor | Descrição |
|-------|-------|-----------|
| `cStat` | `102` | Indica NFS-e de decisão administrativa/judicial |
| `nNFSe` | Sequencial controlado pelo contribuinte | Não pode coincidir com NFS-e existentes |
| `ambGer` | `2` | Emissão pela Sefin Nacional |
| `tpEmis` | `1` | Emissão direta no modelo NFS-e Nacional |
| `nDFSe` | `0` | Ausência de número DFe municipal |
| `dhProc` | Mesmo valor de `dhEmi` | Sincronização temporal |
| `cLocIncid` | Código IBGE 7 dígitos | Local de incidência conforme decisão ou regras da LC 116/2003 |
| `pAliq` | Alíquota ISSQN (%) | Obrigatório no bypass (quando aplicável) |
| `versao` | Versão do leiaute vigente | No nível raiz do XML (`NFSe/`) |
| `id` | `ID` + 53 posições | `NFS` + CódMun(7) + AmbGer(1) + TipoInscr(1) + InscFederal(14) + nNFSe(13) + AnoMes(4) + CódAleatório(9) + DV(1, módulo 11) |

**Endpoint:** `POST /decisao-judicial/nfse`

Após a emissão, a NFS-e de decisão torna-se uma NFS-e regular para fins de consulta e cancelamento (mesmas APIs do fluxo normal).

### 6.3. APIs do ADN — Contribuintes

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/DFe/{NSU}` | Retorna DF-e correspondente ao NSU informado |
| `GET` | `/NFSe/{ChaveAcesso}/Eventos` | Retorna eventos vinculados à NFS-e |

**Novidade:** As consultas por NSU agora aceitam certificado cujo **CNPJ Raiz** seja igual ao do contribuinte consultado. Um novo parâmetro permite informar CNPJ diferente do certificado utilizado na conexão (com validação do CNPJ Raiz).

**Ambiente de produção restrita:** `https://adn.producaorestrita.nfse.gov.br/contribuintes/docs/index.html`

### 6.4. APIs do ADN — Municípios

#### 6.4.1. Compartilhamento de DF-e (Recepção pelo ADN)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/DFe/` | Recepção de lotes de DF-e dos sistemas municipais |

**Regras do lote:**
- Ordem **cronológica obrigatória** dos documentos correlacionados
- Máximo **50 DF-e** por lote
- Tamanho máximo **1 MB** por lote
- O lote pode conter qualquer tipo de DF-e
- Rejeição por falha de schema XML é **documento a documento** (não por lote)
- Retorno inclui NSU de recepção/backup por documento

**Regra de consistência:** Uma NFS-e substituta só é aceita se a NFS-e original **e** seu Evento de Cancelamento por Substituição já tiverem sido compartilhados. Um evento de cancelamento só é aceito se a NFS-e referenciada já existir no ADN.

#### 6.4.2. Distribuição de DF-e

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/DFe/{UltimoNSU}` | Obtém até 50 DF-e a partir do último NSU conhecido |
| `GET` | `/DFe/{NSU}` | Consulta pontual de NSU específico (faltante) |
| `GET` | `/nfse/{chaveAcesso}` | Consulta NFS-e por chave de acesso |

> O município deve aguardar **1 hora** entre consultas quando não há novos documentos (`ultNSU = maxNSU`). Documentos compartilhados pelo próprio município **não** estarão disponíveis para consulta nesta API.

#### 6.4.3. Controle por NSU (Número Sequencial Único)

O ADN gera **4 tipos de NSU:**

| NSU | Escopo | Finalidade |
|-----|--------|------------|
| **NSU Geral do ADN** | Por DF-e | Controle interno do ADN (não usado para distribuição) |
| **NSU de Recepção/Backup** | Por município emissor | Retornado na chamada síncrona de compartilhamento |
| **NSU de Distribuição Municipal** | Por município interessado (não emissor) | Para recuperar DF-e onde o município é interessado |
| **NSU de Distribuição por CPF/CNPJ** | Por ator da NFS-e | Para distribuir DF-e aos atores (Prestador, Tomador, Intermediário) |

#### 6.4.4. API DANFSe

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/danfse/{chaveAcesso}` | Gera PDF da NFS-e (DANFSe) a partir da chave de acesso |

Funciona para qualquer NFS-e presente no ADN, independente da Sefin geradora (nacional ou municipal), desde que o XML tenha sido compartilhado com o ADN.

### 6.5. APIs Municipais (Gerenciamento)

Além das APIs de consulta, os municípios possuem APIs para **manutenção de parâmetros:**

| Método | Endpoint | Função |
|--------|----------|--------|
| `GET` | `/parametros_municipais/{codMun}/convenio` | Consulta convênio |
| `GET` | `/parametros_municipais/{codMun}/aliquotas` | Consulta alíquotas, regimes, deduções |
| `GET` | `/parametros_municipais/{codMun}/regimes_especiais` | Consulta regimes especiais |
| `GET` | `/parametros_municipais/{codMun}/retencoes` | Consulta retenções |
| `GET` | `/parametros_municipais/{codMun}/beneficiomunicipal/{nBM}` | Consulta benefício municipal |
| `POST` | `/parametros_municipais/{codMun}/beneficiomunicipal/{idManut}` | Manutenção de benefício |
| `POST` | `/parametros_municipais/{codMun}/retencoes/{idManut}` | Manutenção de retenção |
| `POST` | `/parametros_municipais/{codMun}/regimes_especiais/{idManut}` | Manutenção de regime especial |

**Ambiente de produção restrita (Municípios):** `https://adn.producaorestrita.nfse.gov.br/municipios/docs/index.html`

---

## 7. Sistema de Eventos da NFS-e

### 7.1. Tipos de Eventos Implementados

| Evento | Emissor | Efeito |
|--------|---------|--------|
| Cancelamento de NFS-e | Contribuinte | Cancela a NFS-e |
| Cancelamento por Substituição | Sistema (automático) | Cancela original, gera substituta |
| Solicitação de Análise Fiscal para Cancelamento | Contribuinte | Solicita análise ao município |
| Cancelamento Deferido por Análise Fiscal | Município | Cancela a NFS-e |
| Cancelamento Indeferido por Análise Fiscal | Município | Indefere o cancelamento |
| Manifestação — Confirmação (Prestador) | Prestador | Confirma prestação do serviço |
| Manifestação — Confirmação (Tomador) | Tomador | Confirma recebimento do serviço |
| Manifestação — Confirmação (Intermediário) | Intermediário | Confirma intermediação |
| Manifestação — Confirmação Tácita | Sistema | Confirmação automática por decurso de prazo |
| Manifestação — Rejeição (Prestador/Tomador/Intermediário) | Atores da NFS-e | Rejeita a NFS-e |
| Anulação da Rejeição | Município emissor | Anula efeitos da rejeição prévia |
| Cancelamento por Ofício | Município emissor | Cancela sem solicitação do contribuinte |
| Bloqueio por Ofício | Município emissor | Impede eventos específicos |
| Desbloqueio por Ofício | Município emissor | Libera eventos bloqueados |

### 7.2. Regras de Bloqueio/Desbloqueio por Ofício

**Eventos que podem ser bloqueados:**
- Cancelamento de NFS-e
- Cancelamento por Substituição
- Cancelamento Deferido por Análise Fiscal
- Cancelamento Indeferido por Análise Fiscal
- Cancelamento por Ofício

**Regras:**
- Cada tipo de evento pode ser bloqueado **independentemente** (até 5 bloqueios simultâneos para tipos diferentes)
- **Não se aceita** bloqueio duplicado para o mesmo tipo sem desbloqueio intermediário
- O Desbloqueio deve **referenciar o identificador** específico do evento de bloqueio
- Para desbloquear N tipos, são necessários N eventos de desbloqueio individuais
- O Cancelamento por Ofício pode ser realizado **mesmo com** evento de manifestação de confirmação

### 7.3. Estrutura do Evento

O modelo de mensagem do evento contém:
- Identificação do autor da mensagem
- Identificação do evento (tipo e sequencial)
- Identificação da NFS-e vinculada (chave de acesso)
- Informações específicas do evento (parte variável em XML)
- Assinatura digital da mensagem

A comunicação com a API utiliza **JSON**, enquanto o leiaute do DF-e utiliza **XML assinado**. Eventos são documentos fiscais eletrônicos compartilhados pelo ADN conforme regras de visibilidade.

### 7.4. Regras de Negócio dos Eventos

As regras de validação genéricas e específicas de cada evento estão descritas no arquivo **AnexoII-SEFIN_ADN-PedRegEvt_Evt-SNNFSe** (planilhas com layouts e regras de negócio).

---

## 8. Esclarecimentos Operacionais

### 8.1. Numeração da NFS-e (`nNFSe`)

Nos emissores públicos nacionais, o número da NFS-e (campo `nNFSe`) **não é definido pelo contribuinte**, sendo atribuído exclusivamente pela Sefin Nacional ao recepcionar e processar a DPS.

**Possibilidade de lacunas ("pulos"):** O mecanismo centralizado pode gerar intervalos na sequência numérica, causados por:
- Timeouts ou falhas temporárias de banco de dados
- Erros internos não previamente catalogados
- Indisponibilidades momentâneas dos serviços
- Alta concorrência de processamento (múltiplas threads simultâneas)

**Mecanismo:** Para cada DPS, a Sefin reserva um número sequencial e tenta persistir a NFS-e no ADN. Números reservados ficam **irrevogavelmente vinculados** ao processo, mesmo que a NFS-e não seja persistida. Esses intervalos decorrem exclusivamente do funcionamento técnico e **não representam irregularidade fiscal**, falha do contribuinte ou inconsistência cadastral.

### 8.2. NFS-e Via e Apuração do ISSQN

No âmbito da implementação da NFS-e Via (concessionárias de rodovias):

- A metodologia de apuração do ISSQN e fluxos de arrecadação municipais devem **permanecer inalterados**
- A sistemática atual deve ser mantida até a implantação do **MAN (Módulo de Apuração Nacional)**, de adesão voluntária
- A emissão da NFS-e Via **não implica** alteração imediata dos processos de lançamento e cobrança
- As NFS-e Via autorizadas no ambiente nacional são **distribuídas** para todos os municípios envolvidos nos trechos de concessão
- Municípios podem, **opcionalmente**, utilizar esses documentos para apuração local, desde que adaptem suas legislações tributárias

### 8.3. Ambientes Disponíveis

| Ambiente | URL |
|----------|-----|
| **Produção Restrita — Sefin Nacional** | `https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional/docs/index` |
| **Produção Restrita — ADN Contribuintes** | `https://adn.producaorestrita.nfse.gov.br/contribuintes/docs/index.html` |
| **Produção Restrita — ADN Municípios** | `https://adn.producaorestrita.nfse.gov.br/municipios/docs/index.html` |
| **Portal NFS-e — Documentação Técnica** | `https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica` |

---

## 9. Cronograma e Transição

| Período | Descrição |
|---------|-----------|
| **Jan/2026** | Campos IBS/CBS da NT 004 (Ago/2025) disponíveis em Produção e Produção Restrita. Grupo IBSCBS **opcional**. |
| **09/02/2026** | Atualizações de PIS/COFINS da NT 007 disponíveis: CST ampliado, `tpRetPisCofins` com CSLL, arredondamento bancário. |
| **2026** | IBS e CBS com alíquotas de teste. `vTotNF = vLiq`. PIS e COFINS deduzidos da base de cálculo. |
| **2027+** | IBS e CBS "por fora": `vTotNF = vLiq + vCBS + vIBSTot`. |
| **Até 2032** | Transição gradual. Extinção do ISSQN. PIS/COFINS não mais deduzidos da BC. Códigos `1` e `2` de `tpRetPisCofins` suprimidos. |
| **Futuro (TBD)** | Grupo IBSCBS **obrigatório** na DPS/NFS-e. Evoluções para novos fatos geradores. Implantação do MAN. Cronograma a ser publicado no portal. |

---

## 10. Referência de Anexos Técnicos

| Arquivo | Conteúdo |
|---------|----------|
| **ANEXO_I-SEFIN_ADN-DPS_NFSe-SNNFSe** | Layout completo DPS e NFS-e (aba "LEIAUTE NFS-e ADN"), regras de negócio (aba "RN_DPS_NFS-e") |
| **ANEXO_II-SEFIN_ADN-PedRegEvt_Evt** | Layouts e regras de negócio de Pedidos de Registro de Eventos e Eventos gerados |
| **ANEXO_III-CNC** | Cadastro Nacional de Contribuintes NFS-e |
| **ANEXO_IV-ADN** | Regras de recepção, compartilhamento e distribuição do ADN |
| **ANEXO_V-Painel_Adm_Municipal** | Parametrizações do Painel Administrativo Municipal |
| **AnexoVI-LeiautesRN_RTC_IBSCBS v1.03.00 (NT007)** | Layout NFS-e com grupos IBS/CBS ("Leiaute DPS_NFS-e - RT"), regras de negócio da DPS ("RN DPS - RTC_IBSCBS") e da NFS-e ("RN NFS-e - RTC_IBSCBS") |
| **AnexoVII-IndOp_IBSCBS v1.01.00** | Tabela de códigos indicadores de operação para campo `cIndOp` (baseada no art. 11 da LC 214/2025) |
| **ANEXO_A-Municipio_IBGE/Paises_ISO2** | Tabela de municípios IBGE e códigos de países ISO |
| **ANEXO_B-NBS2-Lista_Servico_Nacional** | Lista de serviços nacional com códigos NBS (Nomenclatura Brasileira de Serviços) |
| **ANEXO_C-IndOp_IBSCBS** | Indicadores de operação IBS/CBS (complementar ao AnexoVII) |

---

## 11. Requisitos Não-Funcionais e de Integração

### 11.1. Autenticação e Segurança

- Todas as APIs exigem **certificado digital ICP-Brasil** (e-CNPJ ou e-CPF).
- Na API do ADN para contribuintes, aceita-se certificado com **CNPJ Raiz** igual ao do contribuinte consultado.
- **Sigilo fiscal:** chave de acesso só é retornada se o certificado corresponder a um ator da NFS-e (Prestador, Tomador ou Intermediário).
- Assinatura digital dos documentos fiscais (NFS-e, Eventos) segue o padrão **XMLDSig**.

### 11.2. Formato de Comunicação

- **APIs:** padrão **JSON** para comunicação de mensagens (request/response)
- **Documentos fiscais:** formato **XML assinado digitalmente** (NFS-e e Eventos)
- **DANFSe:** gerado em **PDF** a partir do XML da NFS-e

### 11.3. Processamento Síncrono

Todas as APIs de emissão e registro de eventos operam em **modo síncrono**: o solicitante envia a requisição e recebe resposta imediata (autorização ou rejeição com motivo).

### 11.4. Limites e Restrições

| Aspecto | Limite |
|---------|--------|
| DF-e por lote (compartilhamento ADN) | **50** documentos |
| Tamanho máximo do lote | **1 MB** |
| DF-e por consulta (distribuição) | **50** documentos |
| Intervalo mínimo entre consultas (sem novos docs) | **1 hora** |
| Validação de schema XML | **Documento a documento** (não por lote) |
| Ordem de compartilhamento | **Cronológica obrigatória** para documentos correlacionados |

### 11.5. Consistência do ADN

O ADN exige **ordem cronológica de compartilhamento** para documentos correlacionados:

- Uma **NFS-e substituta** só é aceita se a NFS-e original **e** seu Evento de Cancelamento por Substituição já tiverem sido compartilhados.
- Um **evento de cancelamento** só é aceito se a NFS-e referenciada já existir no ADN.
- Um **evento de cancelamento por substituição** só é aceito se a NFS-e substituída (original) já existir no ADN.

A responsabilidade pela consistência é **compartilhada entre todos os participantes** do Sistema Nacional NFS-e. O ADN não tem como garantir que o município compartilhe todos os documentos, mas valida a sequência dos documentos correlacionados.

### 11.6. Regras de Distribuição

Um DF-e é distribuído para:

**Municípios interessados (não emissores):**
- Município de incidência do ISSQN
- Município do local da prestação do serviço
- Município do endereço dos estabelecimentos ou domicílio dos não emitentes da NFS-e

**Atores da NFS-e (por CPF/CNPJ):**
- Prestador
- Tomador
- Intermediário

> Documentos compartilhados pelo **próprio município** não são redistribuídos para ele. Os eventos de NFS-e seguem as mesmas regras de distribuição da NFS-e à qual estão vinculados.

---

*Documento gerado em março de 2026. Baseado nas Notas Técnicas SE/CGNFS-e nº 005 v1.1 e nº 007 v1.0, Manuais de APIs para Contribuintes e Municípios, Guias do Emissor Público Nacional e do Painel Administrativo Municipal, e Anexos I a VII do Sistema Nacional NFS-e.*
