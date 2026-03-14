# Manual de Orientação do Leiaute dos Dados de Declarações do PGDAS-D 2018

**Versão 1.0.2.0 — 03/02/2023**

**Grupo de Trabalho de Tecnologia da Informação — CGSN/Simples Nacional**

**Elaboração:** ABRASF · CNM · Secretaria da Receita Federal do Brasil · Secretarias de Fazenda, Finanças, Receita ou Tributação das Unidades Federadas · Serviço Federal de Processamento de Dados (SERPRO)

---

## Histórico de alterações

### Versão 1.0.0.1
- Remoção de referências à geração do arquivo contendo dados de DAS gerados em data distinta da data de entrega da declaração correspondente, tendo em vista que não há mais a necessidade de geração desse arquivo.
- Adequação da descrição dos campos 7, 8, 9 e 10 do registro 03000.

### Versão 1.0.1.0
- Correção da descrição de campos dos registros 03110, 03120, 03130, 03111 e 03112.
- Adequação de domínios dos campos 7 e 11 do registro 03110.
- Campos marcados com N/A (não aplicável) nos registros 03111 e 03112.
- Remoção dos registros 03121, 03131, 03122 e 03132.
- Inclusão do campo 19 nos registros 03120 e 03130.

### Versão 1.0.2.0 *(versão atual)*
- Inclusão de novos campos:
  - **Registro 00000:** Indicativo de retenção em Malha; Endereço IP utilizado na transmissão da declaração; Número de série do certificado digital utilizado na transmissão da declaração.
  - **Registro 03000:** Indicativo de impedimento de recolher ICMS/ISS.

---

## Sumário

1. [Apresentação](#apresentação)
2. [Apêndice A — Informações de referência](#apêndice-a--informações-de-referência)
   - 1.1 [Geração](#11-geração)
   - 1.2 [Forma, local e prazo de entrega](#12-forma-local-e-prazo-de-entrega)
3. [Referências para o preenchimento do arquivo](#2-referências-para-o-preenchimento-do-arquivo)
   - 2.1 [Dados técnicos de geração do arquivo](#21-dados-técnicos-de-geração-do-arquivo)
   - 2.2 [Regras gerais de preenchimento](#22-regras-gerais-de-preenchimento)
   - 2.3 [Números, caracteres ou códigos de identificação](#23-números-caracteres-ou-códigos-de-identificação)
   - 2.4 [Registros do arquivo](#24-registros-do-arquivo)
4. [Campos dos registros](#3-campos-dos-registros)
5. [Domínio](#4-domínio)

---

## Apresentação

Este manual visa orientar a geração e leitura em arquivo digital dos dados armazenados pelo Programa Gerador do Documento de Arrecadação do Simples Nacional — Declaratório (PGDAS-D) 2018.

O arquivo será gerado com a seguinte estrutura hierárquica:

```
REGISTRO AAAAA  — Abertura do arquivo digital
  REGISTRO 00000  — Abertura, identificação do contribuinte e dados da apuração
    REGISTRO 00001  — Informações sobre processo para não optante
    REGISTRO 01000  — Informações do valor apurado pelo cálculo
    REGISTRO 01100  — Registros do perfil
    REGISTRO 01500  — Receitas brutas de períodos anteriores à opção
    REGISTRO 01501  — Receitas brutas de períodos anteriores à opção — Mercado Interno
    REGISTRO 01502  — Receitas brutas de períodos anteriores à opção — Mercado Externo
    REGISTRO 02000  — Receitas brutas de períodos anteriores, valor original, tributos fixos
    REGISTRO 03000  — Informações de cada estabelecimento (matriz/filial)
      REGISTRO 03100  — Informações de cada atividade selecionada para cada estabelecimento
        REGISTRO 03110  — Receita por atividade com percentual — Faixa A
        REGISTRO 03120  — Receita por atividade com percentual — Faixa B
        REGISTRO 03130  — Receita por atividade com percentual — Faixa C
          REGISTRO 03111  — Valor de receita com isenção — Faixa A
          REGISTRO 03112  — Valor de receita com redução e percentual — Faixa A
      REGISTRO 03500  — Folha de salário
    REGISTRO 99999  — Encerramento do registro 00000
REGISTRO ZZZZZ  — Fechamento do arquivo digital
```

---

## Apêndice A — Informações de referência

### 1.1. Geração

O SERPRO deverá disponibilizar arquivos únicos **diários** contendo as informações de todas as apurações transmitidas pelos contribuintes, mesmo aquelas sem geração de DAS. Os arquivos deverão conter as informações de todos os contribuintes, de todos os entes federados.

Os arquivos serão disponibilizados em formato compactado, padrão `.zip`, com tamanho máximo de 150 MB. Caso o arquivo exceda os 150 MB, deverá ser dividido em partes que não ultrapassem o tamanho máximo. Essa fragmentação utiliza a funcionalidade padrão de divisão de arquivos ZIP; somente são descompactados os dados após o download de todos os arquivos, evitando que o usuário trabalhe com apenas parte das informações diárias.

### 1.2. Forma, local e prazo de entrega

A pessoa jurídica, de acordo com as especificações indicadas neste manual, está obrigada a prestar informações sobre os dados armazenados que compõem as bases do Simples Nacional, ou que sejam necessárias para o funcionamento dos aplicativos, em meio digital, cujos prazos, formas e locais de entrega serão regulados por decisão da Secretaria-Executiva do Comitê Gestor do Simples Nacional.

---

## 2. Referências para o preenchimento do arquivo

### 2.1. Dados técnicos de geração do arquivo

#### 2.1.1. Características do arquivo digital

**a) Regra de formação do nome do arquivo:**

```
<prefixo>-<tipo>-<data(aaaammdd)>-<sequencial>.zip
```

| Campo | Tamanho | Descrição |
|---|---|---|
| 01 — Prefixo | 11 | Literal fixo: `90-0000-PUB` |
| 02 — Tipo | 10 ou 14 | Para declarações do PGDAS-D 2018: literal `PGDASD2018` |
| 03 — Data | 08 | Data de geração do arquivo, formato: `aaaammdd` |
| 04 — Sequencial | 02 | Número de ordem do arquivo quando forem gerados dois ou mais no mesmo dia. Inicia em `01` para o primeiro arquivo e deve ser reiniciado diariamente |
| 05 — Extensão | — | `.zip` |

**Exemplo de nome de arquivo:**
```
90-0000-PUB-PGDASD2018-20180112-01.zip
```

**b)** Arquivo no formato texto, codificado em **UTF-8**, não sendo aceitos campos compactados (*packed decimal*), zonados, binários, ponto flutuante (*float point*), etc., ou quaisquer outras codificações de texto, tais como EBCDIC.

**c)** Arquivo com organização hierárquica, assim definida pela citação do nível hierárquico ao qual pertence cada registro.

**d)** Os registros são sempre iniciados na primeira coluna (posição 1) e têm tamanho variável.

**e)** A linha do arquivo digital deve conter os campos na exata ordem em que estão listados nos respectivos registros.

**f)** Entre os campos, deve ser inserido o caractere delimitador `|` (pipe).

**g)** O caractere `|` não deve ser incluído como parte integrante do conteúdo de quaisquer campos numéricos ou alfanuméricos.

**h)** O caractere `|` não deve ser usado como delimitador de início e de fim do registro.

**i)** Todos os registros devem conter no final de cada linha os caracteres `CR` (*Carriage Return*) e `LF` (*Line Feed*), correspondentes a "retorno do carro" e "salto de linha".

**Exemplo de linha:**

```
|00000|00000834000105|EMPRESA X(BA)|3577|
```

**j)** Na ausência de informação, o campo vazio (nulo) deverá ser iniciado com `|` e imediatamente encerrado com `|`.

Exemplos de conteúdo de campo:
- Campo alfanumérico: `José da Silva & Irmãos Ltda` → `|José da Silva & Irmãos Ltda|`
- Campo numérico: `1234,56` → `|1234,56|`
- Campo vazio: `||`
- Campo vazio no meio da linha: `|123,00||123654788000354|`
- Campo vazio no início da linha: `||CRLF`

---

### 2.2. Regras gerais de preenchimento

#### 2.2.1. Formato dos campos

- **Alfanumérico (C):** excetuados os caracteres `|` (pipe) e os não-imprimíveis.
- **Numérico (N).**

#### 2.2.2. Campos alfanuméricos (C)

Todos os campos alfanuméricos terão tamanho máximo de 255 caracteres, exceto se houver indicação distinta.

#### 2.2.3. Campos numéricos com casas decimais

- Preenchidos **sem** separadores de milhar, sinais ou outros caracteres (`.`, `-`, `%`); a **vírgula** é o separador decimal.
- Não há limite de caracteres para campos numéricos.
- Deve ser observada a quantidade de casas decimais indicada no respectivo registro.
- Valores percentuais são preenchidos desprezando o símbolo `%`.

Exemplos:
```
$ 1.129.998,99  →  |1129989,99|
17,00 %         →  |17,00| ou |17|
18,50 %         →  |18,5| ou |18,50|
0,00            →  |0| ou |0,00|
campo vazio     →  ||
```

#### 2.2.4. Campos de data (N)

Formato `aaaammdd`, sem separadores.

Exemplos:
```
01/01/2005  →  |20050101|
11.11.1911  →  |19111111|
campo vazio →  ||
```

#### 2.2.5. Campos de período (N)

Formato `aaaamm`, sem separadores.

Exemplos:
```
Janeiro/2005  →  |200501|
08/04         →  |200408|
campo vazio   →  ||
```

#### 2.2.6. Campos de exercício (N)

Formato `aaaa`.

Exemplos:
```
2005        →  |2005|
campo vazio →  ||
```

#### 2.2.7. Campos de hora (N)

Formato `hhmmss`, 24 horas, sem separadores.

Exemplos:
```
09:13:17    →  |091317|
00:00:00    →  |000000|
campo vazio →  ||
```

---

### 2.3. Números, caracteres ou códigos de identificação

Campos com conteúdo numérico nos quais se faz necessário registrar números ou códigos de identificação (CNPJ, Cód. TOM, COD_VER, REG, NRPAGTO, etc.) deverão ser informados com **todos os dígitos, inclusive os zeros à esquerda**. As máscaras de formatação (`.`, `/`, `-`) não devem ser informadas.

Exemplo:
```
CNPJ: 123.456.789/0001-10  →  |123456789000110|
CNPJ: 000.456.789/0001-10  →  |000456789000110|
campo vazio                →  ||
```

---

### 2.4. Registros do arquivo

Entre o registro inicial (AAAAA) e o registro final (ZZZZZ), o arquivo digital é constituído de registros hierárquicos.

**Observações:**
- A ordem de apresentação dos registros é sequencial e ascendente.
- São obrigatórios os registros de abertura e de encerramento do arquivo.

---

## 3. Campos dos registros

---

### REGISTRO AAAAA — Abertura do arquivo digital

| Nº | Campo | Descrição | Tipo | Tam | Dec |
|---|---|---|---|---|---|
| 01 | REG_ABERTURA | Texto fixo `AAAAA` | C | 005 | — |
| 02 | COD_VER | Código da versão do leiaute correspondente ao Manual de Orientação do PGDAS | N | 003 | — |
| 03 | DT_INI | Data inicial das informações contidas no arquivo | N | 008 | — |
| 04 | DT_FIN | Data final das informações contidas no arquivo | N | 008 | — |

> **Observações:** Registro obrigatório. Nível hierárquico: 0. Ocorrência: um por arquivo.

---

### REGISTRO 00000 — Identificação do contribuinte e dados da apuração

| Nº | Campo | Descrição | Tipo | Tam | Dec |
|---|---|---|---|---|---|
| 01 | REG | Texto fixo `00000` | N | 005 | — |
| 02 | Pgdasd_ID_Declaracao | ID da Declaração. Formato: CNPJ Básico + PA (AAAAMM) + Sequencial 001–999 | N | 017 | — |
| 03 | Pgdasd_Num_Recibo | Número do Recibo de Entrega da Transmissão da Apuração | N | 017 | — |
| 04 | Pgdasd_Num_Autenticacao | Número da Autenticação da declaração transmitida. Formato: numérico de 20 posições, sem separadores | N | 020 | — |
| 05 | Pgdasd_Dt_Transmissao | Data e hora da Transmissão da Declaração. Formato: `aaaammddhhmmss`. Hora no formato 24 horas | N | 014 | — |
| 06 | Pgdasd_Versão | Versão em que a apuração foi transmitida. Se transmitida pelo Integra Contador: `IC-N.N.N` | C | 020 | — |
| 07 | Cnpjmatriz | CNPJ do estabelecimento matriz | N | 014 | — |
| 08 | Nome | Razão Social do estabelecimento matriz | C | 056 | — |
| 09 | Cod_TOM | Código do município do estabelecimento matriz | N | 004 | — |
| 10 | Optante | `S` = Optante; `N` = Não optante do Simples Nacional | C | 001 | — |
| 11 | Abertura | Data de abertura da empresa (AAAAMMDD) | N | 008 | — |
| 12 | PA | Período de apuração (AAAAMM) | N | 006 | — |
| 13 | Rpa | Receita bruta do período de apuração no Regime Competência (int + ext) | N | — | 02 |
| 14 | R | Razão da folha salarial | N | — | 10 |
| 15 | Operação | `A` = apuração; `R` = retificação | C | 001 | — |
| 16 | Regime | `0` = Regime de Competência; `1` = Regime de Caixa | N | 001 | — |
| 17 | RpaC | Receita bruta do período de apuração no Regime Caixa (int + ext) | N | — | 02 |
| 18 | Rpa_Int | Receita bruta do período de apuração no Regime Competência — Mercado Interno | N | — | 02 |
| 19 | Rpa_Ext | Receita bruta do período de apuração no Regime Competência — Mercado Externo | N | — | 02 |
| 20 | Rpac_Int | Receita bruta do período de apuração no Regime Caixa — Mercado Interno | N | — | 02 |
| 21 | Rpac_Ext | Receita bruta do período de apuração no Regime Caixa — Mercado Externo | N | — | 02 |
| 22 | **RetidoMalha** *(novo v1.0.2.0)* | Indicativo de retenção em Malha: `0` = Não retido; `1` = Retido | N | 001 | — |
| 23 | **IP** *(novo v1.0.2.0)* | Endereço IP utilizado na transmissão da declaração | C | 015 | — |
| 24 | **SerieCertificadoDigital** *(novo v1.0.2.0)* | Número de série do certificado digital utilizado na transmissão da declaração | C | 050 | — |

> **Observações:** Registro obrigatório. Nível hierárquico: 1. Ocorrência: 1:N.

---

### REGISTRO 00001 — Informações sobre processo para não optante

| Nº | Campo | Descrição | Tipo | Tam | Dec |
|---|---|---|---|---|---|
| 01 | REG | Texto fixo `00001` | N | 005 | — |
| 02 | admtrib | Esfera administrativa do processo: `1` Federal; `2` Estadual; `3` Distrital; `4` Municipal | N | 001 | — |
| 03 | uf | Sigla da UF onde está protocolado o processo | C | 002 | — |
| 04 | munic | Descrição do município onde está protocolado o processo | C | 050 | — |
| 05 | codmunic | Código do município onde está protocolado o processo | N | 004 | — |
| 06 | numproc | Número do processo | C | 024 | — |

> **Observações:** Nível hierárquico: 2. Ocorrência: 0:1. Obrigatório se o contribuinte for não optante.

---

### REGISTRO 01000 — Informações de valores calculados para o DAS

| Nº | Campo | Descrição | Tipo | Tam | Dec |
|---|---|---|---|---|---|
| 01 | REG | Texto fixo `01000` | N | 005 | — |
| 02 | Nrpagto | Número da guia DAS | N | 017 | — |
| 03 | Princ | Valor principal | N | — | 02 |
| 04 | Multa | Valor da multa | N | — | 02 |
| 05 | Juros | Valor dos juros | N | — | 02 |
| 06 | Tdevido | Valor total devido | N | — | 02 |
| 07 | Dtvenc | Data do vencimento (AAAAMMDD) | N | 008 | — |
| 08 | Dtvalcalc | Data da validade do cálculo (AAAAMMDD) | N | 008 | — |
| 09 | Dt_Emissao_Das | Data e hora da emissão do DAS. Formato: `aaaammddhhmmss`. Hora no formato 24 horas | N | 014 | — |

> **Observações:** Nível hierárquico: 2. Ocorrência: 0:N. Se não for gerado DAS, o registro não será informado.

---

### REGISTRO 01100 — Informações do perfil do DAS

| Nº | Campo | Descrição | Tipo | Tam | Dec |
|---|---|---|---|---|---|
| 01 | REG | Texto fixo `01100` | N | 005 | — |
| 02 | codrecp | Código de receita do principal | N | 004 | — |
| 03 | valorprinc | Valor do principal | N | — | 02 |
| 04 | codrecm | Código de receita da multa | N | 004 | — |
| 05 | valorm | Valor da multa | N | — | 02 |
| 06 | codrecj | Código de receita dos juros | N | 004 | — |
| 07 | valorj | Valor dos juros | N | — | 02 |
| 08 | uf | UF no caso de ICMS | C | 002 | — |
| 09 | codmunic | Código do município no caso de ISS | N | 004 | — |

> **Observações:** Nível hierárquico: 3. Ocorrência: 0:N.

---

### REGISTRO 01500 — Receitas brutas de períodos anteriores à opção

| Nº | Campo | Descrição | Tipo | Tam | Dec |
|---|---|---|---|---|---|
| 01 | REG | Texto fixo `01500` | N | 005 | — |
| 02 | rbsn_PA | Período de apuração (AAAAMM) para coleta da Receita Bruta do Simples Nacional | N | 006 | — |
| 03 | rbsn_valor | Valor da receita bruta do Simples Nacional (soma do mercado interno + externo) | N | — | 02 |

> **Observações:** Nível hierárquico: 2. Ocorrência: 0 a 23, uma ocorrência por linha.

---

### REGISTRO 01501 — Receitas brutas de períodos anteriores à opção — Mercado Interno

| Nº | Campo | Descrição | Tipo | Tam | Dec |
|---|---|---|---|---|---|
| 01 | REG | Texto fixo `01501` | N | 005 | — |
| 02 | Rbsn_Int_PA | Período de apuração (AAAAMM) | N | 006 | — |
| 03 | Rbsn_Int_valor | Valor da receita bruta do Simples Nacional no Mercado Interno | N | — | 02 |

> **Observações:** Nível hierárquico: 2. Ocorrência: 0 a 23, uma ocorrência por linha.

---

### REGISTRO 01502 — Receitas brutas de períodos anteriores à opção — Mercado Externo

| Nº | Campo | Descrição | Tipo | Tam | Dec |
|---|---|---|---|---|---|
| 01 | REG | Texto fixo `01502` | N | 005 | — |
| 02 | Rbsn_Ext_PA | Período de apuração (AAAAMM) | N | 006 | — |
| 03 | Rbsn_Ext_valor | Valor da receita bruta do Simples Nacional no Mercado Externo | N | — | 02 |

> **Observações:** Nível hierárquico: 2. Ocorrência: 0 a 23, uma ocorrência por linha.

---

### REGISTRO 02000 — Receitas brutas de períodos anteriores, valor original e tributos fixos

| Nº | Campo | Descrição | Tipo | Tam | Dec |
|---|---|---|---|---|---|
| 01 | REG | Texto fixo `02000` | N | 005 | — |
| 02 | rbt12 | Receita bruta dos últimos 12 meses (pode ser proporcional à data de abertura) | N | — | 02 |
| 03 | Rbtaa | Receita bruta do ano-calendário anterior (pode ser proporcional à data de abertura) | N | — | 02 |
| 04 | Rba | Receita bruta do ano-calendário | N | — | 02 |
| 05 | rbt12o | Receita bruta dos últimos 12 meses — valor original | N | — | 02 |
| 06 | Rbtaao | Receita bruta do ano-calendário anterior — valor original | N | — | 02 |
| 07 | ICMS | Valor fixo de ICMS | N | — | 02 |
| 08 | ISS | Valor fixo de ISS | N | — | 02 |
| 09 | Rbtaa_Int | Receita bruta do ano-calendário anterior — Mercado Interno (pode ser proporcional à data de abertura) | N | — | 02 |
| 10 | Rbtaa_Into | Receita bruta do ano-calendário anterior original — Mercado Interno | N | — | 02 |
| 11 | Rbtaa_Ext | Receita bruta do ano-calendário anterior — Mercado Externo (pode ser proporcional) | N | — | 02 |
| 12 | Rbtaa_Exto | Receita bruta do ano-calendário anterior original — Mercado Externo | N | — | 02 |
| 13 | Rbt12_Int | Receita bruta dos últimos 12 meses — Mercado Interno (pode ser proporcional) | N | — | 02 |
| 14 | Rbt12_Into | Receita bruta dos últimos 12 meses original — Mercado Interno | N | — | 02 |
| 15 | Rba_Int | Receita bruta do ano-calendário — Mercado Interno | N | — | 02 |
| 16 | Rba_Ext | Receita bruta do ano-calendário — Mercado Externo | N | — | 02 |
| 17 | Rbt12_Ext | Receita bruta dos últimos 12 meses — Mercado Externo (pode ser proporcional) | N | — | 02 |
| 18 | Rbt12_Exto | Receita bruta dos últimos 12 meses original — Mercado Externo | N | — | 02 |

> **Observações:** Nunca será informado valor 0,00 de ICMS e ISS — ou o campo ficará em branco, ou será informado valor diferente de 0,00. Nível hierárquico: 2. Ocorrência: 1:1.

---

### REGISTRO 03000 — Informações de cada estabelecimento (matriz/filial)

| Nº | Campo | Descrição | Tipo | Tam | Dec |
|---|---|---|---|---|---|
| 01 | REG | Texto fixo `03000` | N | 005 | — |
| 02 | CNPJ | CNPJ do estabelecimento filial | N | 014 | — |
| 03 | Uf | Sigla da UF do estabelecimento filial | C | 002 | — |
| 04 | Cod_TOM | Código do município do estabelecimento filial | N | 004 | — |
| 05 | Vltotal | Valor total da receita para a filial | N | — | 02 |
| 06 | Sublimite | Sublimite estadual para o estabelecimento filial | N | — | 02 |
| 07 | Prex_int_sublimite | Percentual que excede o sublimite no mercado interno e está dentro do limite | N | 001 | 10 |
| 08 | Prex_int_limite | Percentual que excede o limite no mercado interno | N | 001 | 10 |
| 09 | Prex_ext_sublimite | Percentual que excede o sublimite no mercado externo e está dentro do limite | N | 001 | 10 |
| 10 | Prex_ext_limite | Percentual que excede o limite no mercado externo | N | 001 | 10 |
| 11 | **ImpedidoIcmsIss** *(novo v1.0.2.0)* | Indicativo de impedimento de recolher ICMS/ISS: `0` = Não impedido; `1` = Impedido | N | 001 | — |

> **Observações:** O valor contido no campo 08 deve auxiliar na leitura das alíquotas dos registros 03110, 03111 e 03112. Nível hierárquico: 2. Ocorrência: 1:N (de 1 — apenas a matriz — até o número máximo de estabelecimentos).

---

### REGISTRO 03100 — Informações de cada atividade selecionada para cada estabelecimento

| Nº | Campo | Descrição | Tipo | Tam | Dec |
|---|---|---|---|---|---|
| 01 | REG | Texto fixo `03100` | N | 005 | — |
| 02 | Tipo | Tipo de atividade do Simples Nacional (01 a 43) | N | 002 | — |
| 03 | Vltotal | Valor total da receita para a atividade selecionada | N | — | — |

> **Observações:** Nível hierárquico: 3. Ocorrência: 0:43.

---

### REGISTRO 03110 — Receita por atividade com percentual (Faixa A)

| Nº | Campo | Descrição | Tipo | Tam | Dec |
|---|---|---|---|---|---|
| 01 | REG | Texto fixo `03110` | N | 005 | — |
| 02 | UF | Sigla da UF onde existiu receita para a atividade (ex: `|SP|` ou `||`) | C | 002 | — |
| 03 | Cod_TOM | Código do município onde existiu receita para a atividade (ex: `|7107|` ou `||`) | N | 004 | — |
| 04 | Valor | Valor da receita para cada atividade | N | — | 02 |
| 05 | COFINS | `00` Não informado; `02` Exigibilidade suspensa; `03` Lançamento de ofício; `08` Substituição tributária; `09` Tributação monofásica | N | 002 | — |
| 06 | CSLL | `00` Não informado; `02` Exigibilidade suspensa; `03` Lançamento de ofício | N | 002 | — |
| 07 | ICMS | `00` Não informado; `01` Imunidade; `02` Exigibilidade suspensa; `03` Lançamento de ofício; `08` Substituição tributária; `10` Antecipação com encerramento de tributação; `45` Isenção/Redução; `67` Isenção/Redução de cesta básica | N | 002 | — |
| 08 | INSS | `00` Não informado; `02` Exigibilidade suspensa; `03` Lançamento de ofício | N | 002 | — |
| 09 | IPI | `00` Não informado; `01` Imunidade; `02` Exigibilidade suspensa; `03` Lançamento de ofício; `08` Substituição tributária | N | 002 | — |
| 10 | IRPJ | `00` Não informado; `02` Exigibilidade suspensa; `03` Lançamento de ofício | N | 002 | — |
| 11 | ISS | `00` Não informado; `01` Imunidade; `02` Exigibilidade suspensa; `03` Lançamento de ofício; `11` Retenção/Substituição tributária; `45` Isenção/Redução | N | 002 | — |
| 12 | PIS | `00` Não informado; `02` Exigibilidade suspensa; `03` Lançamento de ofício; `08` Substituição tributária; `09` Tributação monofásica | N | 002 | — |
| 13 | Aliqapur | Somatório das alíquotas apuradas de todos os tributos da atividade | N | — | 10 |
| 14 | Vlimposto | Valor devido para a faixa (soma dos tributos) | N | — | 02 |
| 15 | Alíquota apurada de COFINS | Porcentagem da alíquota apurada para o tributo | N | — | 10 |
| 16 | Valor apurado de COFINS | Valor devido para a faixa, já descontadas qualificações tributárias, isenções e reduções | N | — | 02 |
| 17 | Alíquota apurada de CSLL | Porcentagem da alíquota apurada para o tributo | N | — | 10 |
| 18 | Valor apurado de CSLL | Valor devido para a faixa, já descontadas qualificações tributárias, isenções e reduções | N | — | 02 |
| 19 | Alíquota apurada de ICMS | Porcentagem da alíquota apurada para o tributo | N | — | 10 |
| 20 | Valor apurado de ICMS | Valor devido para a faixa, já descontadas qualificações tributárias, isenções e reduções | N | — | 02 |
| 21 | Alíquota apurada de INSS | Porcentagem da alíquota apurada para o tributo | N | — | 10 |
| 22 | Valor apurado de INSS | Valor devido para a faixa, já descontadas qualificações tributárias, isenções e reduções | N | — | 02 |
| 23 | Alíquota apurada de IPI | Porcentagem da alíquota apurada para o tributo | N | — | 10 |
| 24 | Valor apurado de IPI | Valor devido para a faixa, já descontadas qualificações tributárias, isenções e reduções | N | — | 02 |
| 25 | Alíquota apurada de IRPJ | Porcentagem da alíquota apurada para o tributo | N | — | 10 |
| 26 | Valor apurado de IRPJ | Valor devido para a faixa, já descontadas qualificações tributárias, isenções e reduções | N | — | 02 |
| 27 | Alíquota apurada de ISS | Porcentagem da alíquota apurada para o tributo | N | — | 10 |
| 28 | Valor apurado de ISS | Valor devido para a faixa, já descontadas qualificações tributárias, isenções e reduções | N | — | 02 |
| 29 | Alíquota apurada de PIS | Porcentagem da alíquota apurada para o tributo | N | — | 10 |
| 30 | Valor apurado de PIS | Valor devido para a faixa, já descontadas qualificações tributárias, isenções e reduções | N | — | 02 |

> **Observações:** Nível hierárquico: 4. Ocorrência: 1:N.

---

### REGISTRO 03120 — Receita por atividade com percentual (Faixa B)

| Nº | Campo | Descrição | Tipo | Tam | Dec |
|---|---|---|---|---|---|
| 01 | REG | Texto fixo `03120` | N | 005 | — |
| 02 | Aliqapur | Somatório das alíquotas apuradas de todos os tributos da atividade | N | — | 10 |
| 03 | Alíquota apurada de COFINS | Porcentagem da alíquota apurada para o tributo | N | — | 10 |
| 04 | Valor apurado de COFINS | Valor devido, já descontadas qualificações tributárias, isenções e reduções | N | — | 02 |
| 05 | Alíquota apurada de CSLL | Porcentagem da alíquota apurada | N | — | 10 |
| 06 | Valor apurado de CSLL | Valor devido, já descontadas qualificações tributárias, isenções e reduções | N | — | 02 |
| 07 | Alíquota apurada de ICMS | Porcentagem da alíquota apurada | N | — | 10 |
| 08 | Valor apurado de ICMS | Valor devido, já descontadas qualificações tributárias, isenções e reduções | N | — | 02 |
| 09 | Alíquota apurada de INSS | Porcentagem da alíquota apurada | N | — | 10 |
| 10 | Valor apurado de INSS | Valor devido, já descontadas qualificações tributárias, isenções e reduções | N | — | 02 |
| 11 | Alíquota apurada de IPI | Porcentagem da alíquota apurada | N | — | 10 |
| 12 | Valor apurado de IPI | Valor devido, já descontadas qualificações tributárias, isenções e reduções | N | — | 02 |
| 13 | Alíquota apurada de IRPJ | Porcentagem da alíquota apurada | N | — | 10 |
| 14 | Valor apurado de IRPJ | Valor devido, já descontadas qualificações tributárias, isenções e reduções | N | — | 02 |
| 15 | Alíquota apurada de ISS | Porcentagem da alíquota apurada | N | — | 10 |
| 16 | Valor apurado de ISS | Valor devido, já descontadas qualificações tributárias, isenções e reduções | N | — | 02 |
| 17 | Alíquota apurada de PIS | Porcentagem da alíquota apurada | N | — | 10 |
| 18 | Valor apurado de PIS | Valor devido, já descontadas qualificações tributárias, isenções e reduções | N | — | 02 |
| 19 | Vlimposto | Valor devido para a faixa (soma dos tributos) | N | — | 02 |

> **Observações:** Nível hierárquico: 4. Ocorrência: 1:N.

---

### REGISTRO 03130 — Receita por atividade com percentual (Faixa C)

Mesma estrutura do REGISTRO 03120, com texto fixo `03130`.

| Nº | Campo | Descrição | Tipo | Tam | Dec |
|---|---|---|---|---|---|
| 01 | REG | Texto fixo `03130` | N | 005 | — |
| 02–19 | (mesmos campos do 03120) | Ver estrutura do REGISTRO 03120 | — | — | — |

> **Observações:** Nível hierárquico: 4. Ocorrência: 1:N.

---

### REGISTRO 03111 — Valor de receita com isenção (Faixa A)

| Nº | Campo | Descrição | Tipo | Tam | Dec |
|---|---|---|---|---|---|
| 01 | REG | Texto fixo `03111` | N | 005 | — |
| 02 | Valor | Valor da receita com isenção de ICMS/ISS para cada atividade | N | — | 02 |

> **Observações:** Nível hierárquico: 5. Ocorrência: 0:N.

---

### REGISTRO 03112 — Valor de receita com redução e percentual (Faixa A)

| Nº | Campo | Descrição | Tipo | Tam | Dec |
|---|---|---|---|---|---|
| 01 | REG | Texto fixo `03112` | N | 005 | — |
| 02 | Valor | Valor da receita com redução de ICMS/ISS para cada atividade | N | — | 02 |
| 03 | Red | Percentual de redução aplicado ao ICMS/ISS para o valor de receita informado no campo 02 | N | — | 02 |

> **Observações:** Nível hierárquico: 5. Ocorrência: 0:N.

---

### REGISTRO 03500 — Folha de salários

| Nº | Campo | Descrição | Tipo | Tam | Dec |
|---|---|---|---|---|---|
| 01 | REG | Texto fixo `03500` | N | 005 | — |
| 02 | fssn_PA | Período de apuração (AAAAMM) em que houver a coleta da Folha de Salário | N | 006 | — |
| 03 | fssn_valor | Valor pago de Folha de Salário para um determinado PA | N | — | 02 |

> **Observações:** Nível hierárquico: 2. Ocorrência: 0:13 — zero a 13 ocorrências, uma por linha.
>
> Existem 13 ocorrências quando o RBT12 é zero e as folhas de salário dos últimos 12 meses também possuem valor zero, situação em que o fator "r" é calculado com a fórmula "Folha de Salário do PA / Receita do PA". Nessa situação, é necessário informar também a folha de salário do próprio PA.

---

### REGISTRO 99999 — Encerramento do bloco 00000

| Nº | Campo | Descrição | Tipo | Tam | Dec |
|---|---|---|---|---|---|
| 01 | REG | Texto fixo `99999` | N | 005 | — |
| 02 | QTD_LIN_0 | Quantidade total de linhas do REGISTRO 00000 | N | — | — |

> **Observações:** Deve conter o total de linhas do bloco, inclusive as linhas 00000 e 99999. Registro obrigatório. Nível hierárquico: 1. Ocorrência: 1:1 — um por registro 00000.

---

### REGISTRO ZZZZZ — Fechamento do arquivo digital

| Nº | Campo | Tipo | Descrição |
|---|---|---|---|
| 01 | TIPO_REGISTRO | Char(5) | Texto fixo `ZZZZZ` |
| 02 | QTD_LIN_REG_ZZZZZ | Int | Quantidade de registros do arquivo digital, desde o registro AAAAA até o registro ZZZZZ |

> **Observações:** Registro obrigatório. Nível hierárquico: 0. Ocorrência: 1 por arquivo.

---

## 4. Domínio

### 4.1. Receitas

| Código | Denominação |
|---|---|
| 1001 | IRPJ — Simples Nacional |
| 1002 | CSLL — Simples Nacional |
| 1004 | COFINS — Simples Nacional |
| 1005 | PIS — Simples Nacional |
| 1006 | INSS — Simples Nacional |
| 1007 | ICMS — Simples Nacional |
| 1008 | IPI — Simples Nacional |
| 1010 | ISS — Simples Nacional |
| 1012 | Multa IRPJ — Simples Nacional |
| 1013 | Multa CSLL — Simples Nacional |
| 1014 | Multa COFINS — Simples Nacional |
| 1015 | Multa PIS — Simples Nacional |
| 1017 | Multa INSS — Simples Nacional |
| 1018 | Multa ICMS — Simples Nacional |
| 1019 | Multa IPI — Simples Nacional |
| 1021 | Multa ISS — Simples Nacional |
| 1023 | Juros IRPJ — Simples Nacional |
| 1025 | Juros CSLL — Simples Nacional |
| 1026 | Juros COFINS — Simples Nacional |
| 1027 | Juros PIS — Simples Nacional |
| 1028 | Juros INSS — Simples Nacional |
| 1029 | Juros ICMS — Simples Nacional |
| 1030 | Juros IPI — Simples Nacional |
| 1031 | Juros ISS — Simples Nacional |

---

### 4.2. Atividades

| Código | Denominação | Período |
|---|---|---|
| 1 | Revenda de mercadorias, exceto para o exterior > Sem substituição tributária/tributação monofásica/antecipação com encerramento de tributação (o **substituto** tributário do ICMS deve utilizar essa opção) | >= 01/2018 |
| 2 | Revenda de mercadorias, exceto para o exterior > Com substituição tributária/tributação monofásica/antecipação com encerramento de tributação (o **substituído** tributário do ICMS deve utilizar essa opção) | >= 01/2018 |
| 3 | Revenda de mercadorias para o exterior | >= 01/2018 |
| 4 | Venda de mercadorias industrializadas pelo contribuinte, exceto para o exterior > Sem substituição tributária/tributação monofásica/antecipação com encerramento de tributação (o **substituto** tributário do ICMS deve utilizar essa opção) | >= 01/2018 |
| 5 | Venda de mercadorias industrializadas pelo contribuinte, exceto para o exterior > Com substituição tributária/tributação monofásica/antecipação com encerramento de tributação (o **substituído** tributário do ICMS deve utilizar essa opção) | >= 01/2018 |
| 6 | Venda de mercadorias industrializadas pelo contribuinte para o exterior | >= 01/2018 |
| 7 | Locação de bens móveis, exceto para o exterior | >= 01/2018 |
| 8 | Locação de bens móveis para o exterior | >= 01/2018 |
| 9 | Prestação de Serviços, exceto para o exterior > Escritórios de serviços contábeis autorizados pela legislação municipal a pagar o ISS em valor fixo em guia do Município | >= 01/2018 |
| 10 | Prestação de Serviços, exceto para o exterior > Sujeitos ao fator "r", sem retenção/substituição tributária de ISS, com ISS devido a **outro(s) Município(s)** | >= 01/2018 |
| 11 | Prestação de Serviços, exceto para o exterior > Sujeitos ao fator "r", sem retenção/substituição tributária de ISS, com ISS devido ao **próprio Município do estabelecimento** | >= 01/2018 |
| 12 | Prestação de Serviços, exceto para o exterior > Sujeitos ao fator "r", com retenção/substituição tributária de ISS | >= 01/2018 |
| 13 | Prestação de Serviços, exceto para o exterior > Não sujeitos ao fator "r" e tributados pelo Anexo III, sem retenção/substituição tributária de ISS, com ISS devido a **outro(s) Município(s)** | >= 01/2018 |
| 14 | Prestação de Serviços, exceto para o exterior > Não sujeitos ao fator "r" e tributados pelo Anexo III, sem retenção/substituição tributária de ISS, com ISS devido ao **próprio Município do estabelecimento** | >= 01/2018 |
| 15 | Prestação de Serviços, exceto para o exterior > Não sujeitos ao fator "r" e tributados pelo Anexo III, com retenção/substituição tributária de ISS | >= 01/2018 |
| 16 | Prestação de Serviços, exceto para o exterior > Sujeitos ao Anexo IV, sem retenção/substituição tributária de ISS, com ISS devido a **outro(s) Município(s)** | >= 01/2018 |
| 17 | Prestação de Serviços, exceto para o exterior > Sujeitos ao Anexo IV, sem retenção/substituição tributária de ISS, com ISS devido ao **próprio Município do estabelecimento** | >= 01/2018 |
| 18 | Prestação de Serviços, exceto para o exterior > Sujeitos ao Anexo IV, com retenção/substituição tributária de ISS | >= 01/2018 |
| 19 | Prestação de Serviços — subitens 7.02, 7.05 e 16.1 da LC 116/2003, exceto para o exterior > Construção civil — Anexo III, sem retenção/substituição de ISS, ISS devido a **outro(s) Município(s)** | >= 01/2018 |
| 20 | Prestação de Serviços — subitens 7.02, 7.05 e 16.1 da LC 116/2003, exceto para o exterior > Construção civil — Anexo III, sem retenção/substituição de ISS, ISS devido ao **próprio Município do estabelecimento** | >= 01/2018 |
| 21 | Prestação de Serviços — subitens 7.02, 7.05 e 16.1 da LC 116/2003, exceto para o exterior > Construção civil — Anexo III, com retenção/substituição tributária de ISS | >= 01/2018 |
| 22 | Prestação de Serviços — subitens 7.02, 7.05 e 16.1 da LC 116/2003, exceto para o exterior > Construção civil — Anexo IV, sem retenção/substituição de ISS, ISS devido a **outro(s) Município(s)** | >= 01/2018 |
| 23 | Prestação de Serviços — subitens 7.02, 7.05 e 16.1 da LC 116/2003, exceto para o exterior > Construção civil — Anexo IV, sem retenção/substituição de ISS, ISS devido ao **próprio Município do estabelecimento** | >= 01/2018 |
| 24 | Prestação de Serviços — subitens 7.02, 7.05 e 16.1 da LC 116/2003, exceto para o exterior > Construção civil — Anexo IV, com retenção/substituição tributária de ISS | >= 01/2018 |
| 25 | Prestação de Serviços — subitens 7.02, 7.05 e 16.1 da LC 116/2003, exceto para o exterior > Transporte coletivo municipal (rodoviário, metroviário, ferroviário e aquaviário de passageiros), sem retenção/substituição de ISS, ISS devido a **outro(s) Município(s)** | >= 01/2018 |
| 26 | Prestação de Serviços — subitens 7.02, 7.05 e 16.1 da LC 116/2003, exceto para o exterior > Transporte coletivo municipal, sem retenção/substituição de ISS, ISS devido ao **próprio Município do estabelecimento** | >= 01/2018 |
| 27 | Prestação de Serviços — subitens 7.02, 7.05 e 16.1 da LC 116/2003, exceto para o exterior > Transporte coletivo municipal, com retenção/substituição tributária de ISS | >= 01/2018 |
| 28 | Prestação de Serviços para o exterior > Escritórios de serviços contábeis autorizados pela legislação municipal a pagar o ISS em valor fixo em guia do Município | >= 01/2018 |
| 29 | Prestação de Serviços para o exterior > Sujeitos ao fator "r" | >= 01/2018 |
| 30 | Prestação de Serviços para o exterior > Não sujeitos ao fator "r" e tributados pelo Anexo III | >= 01/2018 |
| 31 | Prestação de Serviços para o exterior > Sujeitos ao Anexo IV | >= 01/2018 |
| 32 | Prestação de Serviços — subitens 7.02 e 7.05 da LC 116/2003, para o exterior > Construção civil — Anexo III | >= 01/2018 |
| 33 | Prestação de Serviços — subitens 7.02 e 7.05 da LC 116/2003, para o exterior > Construção civil — Anexo IV | >= 01/2018 |
| 34 | Serviços de comunicação; transporte intermunicipal e interestadual de carga e de passageiros (inciso VI do art. 17 da LC 123), exceto para o exterior > Transporte **sem** substituição tributária de ICMS (o **substituto** tributário deve utilizar essa opção) | >= 01/2018 |
| 35 | Serviços de comunicação; transporte intermunicipal e interestadual (inciso VI do art. 17 da LC 123), exceto para o exterior > Transporte **com** substituição tributária de ICMS (o **substituído** tributário deve utilizar essa opção) | >= 01/2018 |
| 36 | Serviços de comunicação; transporte intermunicipal e interestadual (inciso VI do art. 17 da LC 123), exceto para o exterior > Comunicação **sem** substituição tributária de ICMS (o **substituto** tributário deve utilizar essa opção) | >= 01/2018 |
| 37 | Serviços de comunicação; transporte intermunicipal e interestadual (inciso VI do art. 17 da LC 123), exceto para o exterior > Comunicação **com** substituição tributária de ICMS (o **substituído** tributário deve utilizar essa opção) | >= 01/2018 |
| 38 | Serviços de comunicação; transporte intermunicipal e interestadual (inciso VI do art. 17 da LC 123), para o exterior > Transporte | >= 01/2018 |
| 39 | Serviços de comunicação; transporte intermunicipal e interestadual (inciso VI do art. 17 da LC 123), para o exterior > Comunicação | >= 01/2018 |
| 40 | Atividades com incidência simultânea de IPI e de ISS, exceto para o exterior > Sem retenção/substituição tributária de ISS, com ISS devido a **outro(s) Município(s)** | >= 01/2018 |
| 41 | Atividades com incidência simultânea de IPI e de ISS, exceto para o exterior > Sem retenção/substituição tributária de ISS, com ISS devido ao **próprio Município do estabelecimento** | >= 01/2018 |
| 42 | Atividades com incidência simultânea de IPI e de ISS, exceto para o exterior > Com retenção/substituição tributária de ISS | >= 01/2018 |
| 43 | Atividades com incidência simultânea de IPI e de ISS para o exterior | >= 01/2018 |

---

### 4.3. Tributos

| Código | Tributo |
|---|---|
| 1 | IRPJ |
| 2 | CSLL |
| 3 | COFINS |
| 4 | PIS |
| 5 | INSS |
| 6 | ICMS |
| 7 | IPI |
| 8 | ISS |

---

*Manual de Orientação do Leiaute dos Dados de Declarações do PGDAS-D 2018 — Versão 1.0.2.0 (03/02/2023). Última versão publicada pelo Grupo de Trabalho de TI do CGSN/Simples Nacional.*
