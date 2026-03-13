# URLs ADN — Documentação Oficial

Referência: `Fontes/manual-municipios-apis-adn-sistema-nacional-nfs-e-v1-2-out21025.pdf` e `requisitos-nfse-rtc-v2.md`

## Ambiente de Produção Restrita (Sandbox/Homologação)

| Recurso | URL |
|---------|-----|
| Docs Municípios | https://adn.producaorestrita.nfse.gov.br/municipios/docs/index.html |
| Base API Municípios | https://adn.producaorestrita.nfse.gov.br/municipios |
| Distribuição DFe | GET `{base}/DFe/{UltimoNSU}` |

## Ambiente de Produção

| Recurso | URL |
|---------|-----|
| Docs Municípios | https://adn.nfse.gov.br/municipios/docs/index.html |
| Base API Municípios | https://adn.nfse.gov.br/municipios |
| Distribuição DFe | GET `{base}/DFe/{UltimoNSU}` |

## Endpoint de Distribuição (requisitos 6.4.2)

- **Método:** GET
- **Path:** `/DFe/{UltimoNSU}`
- **Descrição:** Obtém até 50 DF-e a partir do último NSU conhecido
- **Autenticação:** mTLS com certificado ICP-Brasil (e-CNPJ da Prefeitura)

## Exemplo de URL completa

**Opção 1 (doc municipios):**
- Sandbox: `https://adn.producaorestrita.nfse.gov.br/municipios/DFe/0`
- Produção: `https://adn.nfse.gov.br/municipios/DFe/0`

**Opção 2 (ACBr/raiz /dfe — tentada primeiro em caso de 404):**
- Sandbox: `https://adn.producaorestrita.nfse.gov.br/dfe/0`
- Produção: `https://adn.nfse.gov.br/dfe/0`
