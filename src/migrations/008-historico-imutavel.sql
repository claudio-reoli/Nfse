-- Migration 008: Histórico Imutável de Arrecadação 2019–2026 (Coeficiente IBS)

CREATE TABLE IF NOT EXISTS arrecadacao_historico (
  id SERIAL PRIMARY KEY,
  cnpj VARCHAR(14) NOT NULL,
  competencia VARCHAR(7) NOT NULL,           -- YYYY-MM
  ano INTEGER NOT NULL,
  total_notas INTEGER DEFAULT 0,
  v_servico_bruto NUMERIC(15,2) DEFAULT 0,
  v_iss_apurado NUMERIC(15,2) DEFAULT 0,
  v_iss_deducoes NUMERIC(15,2) DEFAULT 0,
  v_iss_liquido NUMERIC(15,2) DEFAULT 0,
  v_iss_retido_fonte NUMERIC(15,2) DEFAULT 0,
  v_iss_recolhido NUMERIC(15,2) DEFAULT 0,
  total_cancelamentos INTEGER DEFAULT 0,
  total_substituicoes INTEGER DEFAULT 0,
  hash_sha256 VARCHAR(64) NOT NULL,          -- SHA-256 do registro para imutabilidade
  fonte VARCHAR(20) DEFAULT 'ADN',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cnpj, competencia)
);

-- Notas de NT vigentes (gestão de versões)
CREATE TABLE IF NOT EXISTS nt_versoes (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL UNIQUE,        -- ex: NT-004-v2.0
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_publicacao DATE,
  data_obrigatoriedade DATE,
  status VARCHAR(20) DEFAULT 'vigente',      -- vigente | homologando | implementado | obsoleto
  impacto TEXT,
  link_oficial TEXT,
  implementado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Seed das NTs vigentes em março/2026
INSERT INTO nt_versoes (codigo, titulo, descricao, data_publicacao, data_obrigatoriedade, status, impacto, link_oficial)
VALUES
  ('NT-004-v2.0', 'Layout DPS/NFS-e com grupos IBSCBS',
   'Incluiu grupos IBSCBS no layout da DPS/NFS-e. Em 2026 os campos são informativos para o Simples Nacional.',
   '2025-12-01', '2026-01-01', 'implementado',
   'Campos CST, cClassTrib, pAliqIBS (0,1%), pAliqCBS (0,9%), cNBS obrigatórios para regime normal',
   'https://www.gov.br/nfse'),
  ('NT-007-2026', 'Ajustes IBS/CBS, PIS/COFINS/CSLL e numeração NFS-e',
   'Ajustes nos grupos IBS/CBS e regras de numeração sequencial da NFS-e.',
   '2026-01-01', '2026-02-01', 'implementado',
   'Regras de numeração, ajustes pAliqIBS/CBS, PIS/COFINS/CSLL',
   'https://www.gov.br/nfse'),
  ('NT-005', 'Locação de bens móveis/imóveis',
   'Regras específicas para NBS de locação. Data de obrigatoriedade a ser publicada.',
   NULL, NULL, 'homologando',
   'cNBS específico para locação, regras de tributação especial',
   'https://www.gov.br/nfse')
ON CONFLICT (codigo) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_arh_cnpj_comp ON arrecadacao_historico(cnpj, competencia);
CREATE INDEX IF NOT EXISTS idx_arh_ano ON arrecadacao_historico(ano);
