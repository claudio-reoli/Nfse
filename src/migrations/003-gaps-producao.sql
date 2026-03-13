-- NFSe Freire — Migração 003: Gaps para Produção
-- contribuinte_sync_state, rate-limit ADN, decisões judiciais

-- Estado de sync ADN por contribuinte (para importação GET /DFe/{NSU})
CREATE TABLE IF NOT EXISTS contribuinte_sync_state (
  cnpj VARCHAR(14) PRIMARY KEY,
  ultimo_nsu INTEGER DEFAULT 0,
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Rate-limit: quando ADN retorna 0 docs e ultNSU = maxNSU, aguardar 1h
ALTER TABLE sync_state ADD COLUMN IF NOT EXISTS last_empty_sync_at TIMESTAMPTZ;

-- Decisões judiciais cadastradas pelo município (autoriza contribuinte a usar bypass)
CREATE TABLE IF NOT EXISTS decisao_judicial (
  id SERIAL PRIMARY KEY,
  cnpj_contribuinte VARCHAR(14) NOT NULL,
  numero_processo VARCHAR(50) NOT NULL,
  tipo VARCHAR(20) DEFAULT 'judicial',
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cnpj_contribuinte, numero_processo)
);

-- Regime tributário do contribuinte (Simples/MEI para apuração)
CREATE TABLE IF NOT EXISTS contribuinte_regime (
  cnpj VARCHAR(14) PRIMARY KEY,
  regime VARCHAR(20) DEFAULT 'normal',
  isento_guia BOOLEAN DEFAULT false,
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);
