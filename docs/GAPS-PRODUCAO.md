# Gaps para Produção — Módulos Contribuinte e Município

**Baseado em:** `Fontes/`, `requisitos-nfse-rtc-v2.md`, `requisitos-nfse-futuros-v1.md`, `plano-implementacao-municipio-v1.md`

---

## Resumo Executivo

| Módulo | Status Geral | Bloqueadores para Produção |
|--------|--------------|----------------------------|
| **Contribuinte** | Parcial | mTLS real, importação ADN, Decisão Judicial |
| **Município** | Parcial | Importação ADN (404), Integração bancária, Guias reais |

---

## 1. MÓDULO DO CONTRIBUINTE

### 1.1. Críticos (bloqueiam produção)

| Item | Descrição | Fonte | Status |
|------|-----------|-------|--------|
| **mTLS real** | APIs Sefin/ADN exigem certificado ICP-Brasil. O frontend usa proxy, mas emissão real precisa de mTLS no backend com certificado do contribuinte. | requisitos 11.1, requisitos-futuros 2.2 | ⚠️ Parcial — proxy existe, mas certificado A1 no browser não faz mTLS direto |
| **Importação ADN** | Distribuição DFe por NSU (`GET /DFe/{NSU}`) — contribuinte precisa consumir notas distribuídas ao seu CNPJ. | requisitos 6.3, manual-contribuintes-apis-adn | ❌ Não implementado — tela ADN existe mas depende de proxy/API |
| **Certificado A3** | Token/Smart Card — navegador não acessa hardware. Necessário componente local (Java/C#) ou uso exclusivo de A1. | requisitos-futuros 1.1 | ❌ Fora do escopo web |

### 1.2. Importantes (recomendados)

| Item | Descrição | Fonte | Status |
|------|-----------|-------|--------|
| **Decisão Judicial/Administrativa** | Fluxo bypass `POST /decisao-judicial/nfse` para notas com cStat=102. Contribuinte envia NFS-e completa; município cadastra decisão antes. | requisitos 6.2 | ❌ Não implementado |
| **Parâmetros municipais — POST** | Apenas GET implementado. POST para manutenção de parâmetros exige certificado municipal. | requisitos 6.5, requisitos-futuros 2.1 | ⚠️ Apenas leitura |
| **Eventos de ofício** | Sincronização passiva com `GET /nfse/{chave}/eventos` para capturar cancelamento deferido, confirmação tácita etc. | requisitos 6.1.4, requisitos-futuros 2.3 | ⚠️ Parcial — POST existe, GET para listar não sincroniza |
| **tpRetPisCofins ampliado** | NT 007: códigos 0, 3–9 para PIS/COFINS/CSLL. Códigos 1 e 2 serão suprimidos. | requisitos 4.3.3 | ⚠️ Verificar se catálogo está completo |
| **indZFMALC** | Novo campo (NT 007) para ZFM/ALC — alíquota zero CBS. | requisitos 4.1 | ⚠️ Verificar no xml-builder |
| **Catálogo CST PIS/COFINS completo** | Faixas 00–99. Atualmente recortado para serviços. | requisitos 4.3.2, requisitos-futuros 2.4 | ⚠️ Parcial |
| **Novos fatos geradores (99.xx)** | Locação imóveis, bens móveis, cessão onerosa etc. Códigos 99.01–99.04. | requisitos 5.1 | ⚠️ Verificar se lista NBS está completa |
| **DANFSe via ADN** | `GET /danfse/{chaveAcesso}` — PDF oficial. Hoje gera HTML local. | requisitos 6.4.4 | ⚠️ Geração local existe; download ADN não |

### 1.3. Já implementado ✓

- Emissão DPS → NFS-e (via proxy Sefin)
- Consulta NFS-e por chave
- Cancelamento, substituição, manifestação, análise fiscal (POST eventos)
- Grupo IBSCBS na DPS (opcional 2026)
- Parâmetros municipais GET (convênio, alíquotas, regimes)
- Autenticação JWT, login por senha e certificado A1
- Geração DANFSe em HTML para impressão

---

## 2. MÓDULO DO MUNICÍPIO

### 2.1. Críticos (bloqueiam produção)

| Item | Descrição | Fonte | Status |
|------|-----------|-------|--------|
| **Importação ADN (404)** | `GET /DFe/{UltimoNSU}` — sincronização de notas. Retorna 404; URL/certificado em investigação. | requisitos 6.4.2, plano Phase 2 | 🔴 Bloqueado — 404 persistente |
| **Compartilhamento ADN** | `POST /DFe/` — municípios emissores devem enviar lotes de DF-e ao ADN. Sistemas próprios municipais. | requisitos 6.4.1 | ❌ Não implementado (escopo: recepção apenas) |
| **Integração bancária** | Geração de guia real (DAM, código de barras, PIX) e baixa automática. | plano Phase 5 | ⚠️ Guia simulada (QR placeholder) |
| **Certificado municipal** | mTLS com certificado ICP-Brasil da Prefeitura. Upload existe; 404 pode indicar problema de cert. | requisitos 11.1 | ⚠️ Configurado; validar com ADN |

### 2.2. Importantes (recomendados)

| Item | Descrição | Fonte | Status |
|------|-----------|-------|--------|
| **Tratamento de eventos** | Worker deve processar eventos (cancelamento, substituição) e atualizar status das notas. | plano Phase 3 | ⚠️ Parcial — estrutura existe; validar fluxo completo |
| **Consulta NFS-e por chave** | `GET /nfse/{chaveAcesso}` no ADN — para complementar dados. | requisitos 6.4.2 | ⚠️ Verificar se usado |
| **DANFSe ADN** | `GET /danfse/{chaveAcesso}` — PDF oficial para compartilhamento. | requisitos 6.4.4 | ❌ Não implementado |
| **Painel administrativo** | POST em `/parametros_municipais/{codMun}/...` — manutenção de alíquotas, benefícios, retenções. | requisitos 6.5, guia-painel-administrativo | ❌ Não implementado |
| **Simples Nacional / MEI** | Deduções e regimes especiais na apuração. Ignorar guia para Simples/DAS. | plano 4.1 | ⚠️ Verificar regras no motor |
| **Decisões judiciais (cStat=102)** | Alertar auditor; notas de bypass exigem homologação manual. | plano 6.3 | ❌ Não implementado |
| **Particionamento BD** | Tabelas particionadas por mês para volume. | plano 6.1 | ❌ Não implementado |
| **Rate-limit 1h** | Aguardar 1h entre consultas quando ultNSU = maxNSU. | requisitos 11.4, plano 2.1 | ⚠️ Verificar no cron |
| **Portal do contribuinte municipal** | Contribuinte acessa guias, extratos, certidões. | plano Phase 6 | ⚠️ Parcial — telas existem |

### 2.3. Já implementado ✓

- Backend com mTLS (certificado municipal)
- Worker de sync ADN (estrutura; 404 impede dados)
- Motor de apuração ISSQN (agrupamento, localidade, retenções)
- Geração de guia (valor; código de barras/PIX simulado)
- Dashboard município, consulta notas, gestão acessos
- Configurações (ambiente, certificado, IBGE)
- Continuidade de NSU (sync_state + max das notas)

---

## 3. PRIORIZAÇÃO PARA PRODUÇÃO

### Fase 1 — Desbloquear (obrigatório)

1. **Resolver 404 importação ADN** — certificado, URL, ambiente
2. **mTLS real no backend** — emissão contribuinte via BFF com cert A1
3. **Integração bancária mínima** — guia com código real ou PIX dinâmico

### Fase 2 — Conformidade

4. Decisão Judicial (bypass)
5. Sincronização passiva de eventos (contribuinte)
6. Eventos no worker (cancelamento/substituição)
7. tpRetPisCofins e indZFMALC (NT 007)
8. Rate-limit 1h no sync ADN

### Fase 3 — Evolução

9. Painel administrativo (POST parâmetros)
10. DANFSe via ADN
11. Particionamento BD
12. Certificado A3 (componente auxiliar)
13. MAN (quando disponível)

---

## 4. DOCUMENTOS FONTES CONSULTADOS

| Documento | Pasta Fontes | Conteúdo |
|-----------|--------------|----------|
| Manual Municípios APIs ADN | manual-municipios-apis-adn-...-v1-2-out21025.pdf | Distribuição DFe, compartilhamento, NSU |
| Manual Contribuintes APIs ADN | manual-contribuintes-apis-adn-... | Distribuição por NSU, eventos |
| Manual Municípios Emissor Público | manual-municipios-emissor-publico-... | Parâmetros, emissão municipal |
| Anexo IV ADN | anexo_iv-adn-snnfse-v1-00-20251216.xlsx | Regras ADN |
| Guia Painel Administrativo | guia-do-painel-administrativo-municipal-... | Parametrizações |
| NT 005, NT 007 | nt-005-..., nt-007-... | Layout IBS/CBS, PIS/COFINS |
| Requisitos RTC v2 | requisitos-nfse-rtc-v2.md | Consolidação completa |
| Requisitos Futuros v1 | requisitos-nfse-futuros-v1.md | Gaps conhecidos |

---

*Documento gerado com base na análise do código e documentação em Fontes — Março 2026.*
