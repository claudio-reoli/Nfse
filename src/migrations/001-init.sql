-- NFSe Antigravity — Schema PostgreSQL
-- Migração 001: Tabelas iniciais

-- Configuração do município (single-row)
CREATE TABLE IF NOT EXISTS config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ibge VARCHAR(7),
  ambiente VARCHAR(20) DEFAULT 'sandbox',
  nome VARCHAR(255),
  uf VARCHAR(2),
  cnpj VARCHAR(14),
  cert_subject TEXT,
  cert_serial_number TEXT,
  cert_not_before TIMESTAMPTZ,
  cert_not_after TIMESTAMPTZ,
  cert_loaded_at TIMESTAMPTZ,
  cert_file_name VARCHAR(255),
  cert_key_algorithm VARCHAR(50),
  cert_issuer TEXT,
  insc_estadual VARCHAR(50),
  endereco TEXT,
  email VARCHAR(255),
  telefone VARCHAR(50),
  cert_passphrase TEXT
);

-- Estado de sincronização (single-row)
CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  max_nsu_lido INTEGER DEFAULT 0
);

-- Usuários (contribuinte + município)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  cpf VARCHAR(14) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL,
  user_type VARCHAR(20) NOT NULL,
  password_hash TEXT NOT NULL,
  auth_level VARCHAR(50),
  cnpj_vinculado VARCHAR(14) DEFAULT '',
  status VARCHAR(20) DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notas fiscais (híbrido: colunas indexáveis + JSONB)
CREATE TABLE IF NOT EXISTS notas (
  id SERIAL PRIMARY KEY,
  chave_acesso VARCHAR(50) UNIQUE NOT NULL,
  nsu INTEGER NOT NULL,
  tipo_documento VARCHAR(20) DEFAULT 'NFSE',
  fonte VARCHAR(20) DEFAULT 'ADN',
  data_importacao TIMESTAMPTZ DEFAULT NOW(),
  dh_emi TIMESTAMPTZ,
  d_compet DATE,
  n_nfse VARCHAR(20),
  c_loc_incid VARCHAR(7),
  c_stat VARCHAR(10),
  prestador_cnpj VARCHAR(14),
  prestador_nome VARCHAR(255),
  tomador_cnpj VARCHAR(14),
  tomador_nome VARCHAR(255),
  v_serv NUMERIC(15,2) DEFAULT 0,
  v_bc NUMERIC(15,2) DEFAULT 0,
  v_liq NUMERIC(15,2) DEFAULT 0,
  v_iss NUMERIC(15,2) DEFAULT 0,
  p_aliq NUMERIC(5,2) DEFAULT 0,
  dados_gerais JSONB DEFAULT '{}',
  prestador JSONB DEFAULT '{}',
  tomador JSONB DEFAULT '{}',
  servico JSONB DEFAULT '{}',
  valores JSONB DEFAULT '{}',
  tributos JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'Ativa',
  competencia VARCHAR(10)
);

-- Apurações mensais
CREATE TABLE IF NOT EXISTS apuracoes (
  id VARCHAR(50) PRIMARY KEY,
  cnpj VARCHAR(14) NOT NULL,
  competencia VARCHAR(10) NOT NULL,
  total_notas_emitidas INTEGER DEFAULT 0,
  total_iss_proprio NUMERIC(15,2) DEFAULT 0,
  total_iss_terceiros NUMERIC(15,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'Aberta',
  guia JSONB,
  data_pagamento TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_notas_nsu ON notas(nsu);
CREATE INDEX IF NOT EXISTS idx_notas_c_loc_incid ON notas(c_loc_incid);
CREATE INDEX IF NOT EXISTS idx_notas_prestador_cnpj ON notas(prestador_cnpj);
CREATE INDEX IF NOT EXISTS idx_notas_d_compet ON notas(d_compet);
CREATE INDEX IF NOT EXISTS idx_apuracoes_cnpj_competencia ON apuracoes(cnpj, competencia);

-- Colunas extras em apuracoes (para guia e pagamento)
ALTER TABLE apuracoes ADD COLUMN IF NOT EXISTS guia JSONB;
ALTER TABLE apuracoes ADD COLUMN IF NOT EXISTS data_pagamento TIMESTAMPTZ;

-- Inserir linha inicial para config e sync_state
INSERT INTO config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO sync_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
