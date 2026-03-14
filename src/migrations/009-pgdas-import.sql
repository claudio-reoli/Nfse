-- Migration 009: PGDAS-D Import — Campos adicionais + Tabela de importações

-- Adiciona campos do arquivo PGDAS-D na tabela de declarações
ALTER TABLE pgdas_declaracoes
  ADD COLUMN IF NOT EXISTS rbt12_oficial       NUMERIC(15,2),           -- RBT12 oficial do arquivo PGDAS-D (02000.rbt12)
  ADD COLUMN IF NOT EXISTS v_iss_declarado     NUMERIC(15,2),           -- ISS apurado no DAS (soma 03110/03120/03130 filtrado por municipio)
  ADD COLUMN IF NOT EXISTS retido_malha        BOOLEAN DEFAULT FALSE,   -- 00000.RetidoMalha = 1
  ADD COLUMN IF NOT EXISTS impedido_iss        BOOLEAN DEFAULT FALSE,   -- 03000.ImpedidoIcmsIss = 1 (recolhe via guia municipal)
  ADD COLUMN IF NOT EXISTS operacao            CHAR(1)  DEFAULT 'A',    -- 00000.Operacao: A=apuração, R=retificação
  ADD COLUMN IF NOT EXISTS v_receita_pa        NUMERIC(15,2),           -- 00000.Rpa (receita bruta do PA)
  ADD COLUMN IF NOT EXISTS cod_tom_municipio   VARCHAR(4),              -- Cod_TOM do município filtrado
  ADD COLUMN IF NOT EXISTS fonte_importacao    INTEGER;                 -- FK para pgdas_importacoes.id

-- Tabela de log de importações do arquivo PGDAS-D
CREATE TABLE IF NOT EXISTS pgdas_importacoes (
  id               SERIAL PRIMARY KEY,
  nome_arquivo     VARCHAR(255) NOT NULL,
  data_arquivo     DATE,                           -- data extraída do nome do arquivo (aaaamm)
  cod_tom          VARCHAR(4),                     -- Cod_TOM do município filtrado
  total_registros  INTEGER DEFAULT 0,              -- total de CNPJs parseados no arquivo
  importados       INTEGER DEFAULT 0,              -- CNPJs inseridos/atualizados no município
  retidos_malha    INTEGER DEFAULT 0,              -- com RetidoMalha = 1
  impedidos_iss    INTEGER DEFAULT 0,              -- com ImpedidoIcmsIss = 1
  retificacoes     INTEGER DEFAULT 0,              -- com Operacao = R
  status           VARCHAR(20) DEFAULT 'ok',       -- ok | erro | parcial
  mensagem         TEXT,
  importado_por    VARCHAR(100),                   -- usuário que realizou a importação
  importado_em     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pgdas_import_data ON pgdas_importacoes(data_arquivo);
CREATE INDEX IF NOT EXISTS idx_pgdas_import_tom  ON pgdas_importacoes(cod_tom);
CREATE INDEX IF NOT EXISTS idx_pgdas_decl_fonte  ON pgdas_declaracoes(fonte_importacao);
CREATE INDEX IF NOT EXISTS idx_pgdas_decl_malha  ON pgdas_declaracoes(retido_malha) WHERE retido_malha = TRUE;
CREATE INDEX IF NOT EXISTS idx_pgdas_decl_impd   ON pgdas_declaracoes(impedido_iss) WHERE impedido_iss = TRUE;
