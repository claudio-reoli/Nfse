-- Migration 006: PGDAS-D — Declarações, RBT12 e Monitoramento de Prazo

-- Declarações PGDAS-D por contribuinte/competência
CREATE TABLE IF NOT EXISTS pgdas_declaracoes (
  id SERIAL PRIMARY KEY,
  cnpj VARCHAR(14) NOT NULL,
  competencia VARCHAR(7) NOT NULL,           -- YYYY-MM
  rb_declarada NUMERIC(15,2) DEFAULT 0,      -- receita bruta declarada no PGDAS-D
  rb_adn NUMERIC(15,2) DEFAULT 0,            -- soma das NFS-e no ADN para a competência
  divergencia NUMERIC(15,2) GENERATED ALWAYS AS (rb_adn - rb_declarada) STORED,
  status VARCHAR(20) DEFAULT 'pendente',     -- pendente | enviado | divergente | ok
  alerta_prazo VARCHAR(20),                  -- null | d17 | d19 | d20 | d21_vencido
  data_envio TIMESTAMPTZ,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cnpj, competencia)
);

-- Histórico de alertas enviados (auditável)
CREATE TABLE IF NOT EXISTS pgdas_alertas_log (
  id SERIAL PRIMARY KEY,
  cnpj VARCHAR(14),
  competencia VARCHAR(7),
  tipo_alerta VARCHAR(20) NOT NULL,          -- d17 | d19 | d20 | d21_vencido | sublimite
  mensagem TEXT,
  enviado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Transições de regime por RBT12 (auditável, imutável)
CREATE TABLE IF NOT EXISTS rbt12_transicoes (
  id SERIAL PRIMARY KEY,
  cnpj VARCHAR(14) NOT NULL,
  competencia VARCHAR(7) NOT NULL,
  rbt12 NUMERIC(15,2) NOT NULL,
  regime_anterior VARCHAR(10),              -- das | guia_municipal | normal
  regime_novo VARCHAR(10) NOT NULL,
  reg_apur_trib_sn VARCHAR(1) NOT NULL,     -- 1 | 2 | 3
  justificativa TEXT,
  registrado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pgdas_cnpj_comp ON pgdas_declaracoes(cnpj, competencia);
CREATE INDEX IF NOT EXISTS idx_pgdas_status ON pgdas_declaracoes(status);
CREATE INDEX IF NOT EXISTS idx_rbt12_cnpj ON rbt12_transicoes(cnpj);
