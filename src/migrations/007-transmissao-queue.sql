-- Migration 007: Fila de Transmissão DPS ao ADN com retry

CREATE TABLE IF NOT EXISTS transmissao_queue (
  id SERIAL PRIMARY KEY,
  chave_acesso VARCHAR(50),
  cnpj VARCHAR(14),
  competencia VARCHAR(7),
  tipo VARCHAR(20) DEFAULT 'DPS',            -- DPS | cancelamento | substituicao
  payload JSONB,                             -- XML/JSON a transmitir
  tentativas INTEGER DEFAULT 0,
  max_tentativas INTEGER DEFAULT 3,
  status VARCHAR(20) DEFAULT 'pendente',     -- pendente | processando | autorizado | rejeitado | erro
  ultimo_erro TEXT,
  codigo_retorno_adn VARCHAR(20),
  resposta_adn JSONB,
  proxima_tentativa TIMESTAMPTZ DEFAULT NOW(),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  processado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tq_status ON transmissao_queue(status);
CREATE INDEX IF NOT EXISTS idx_tq_cnpj ON transmissao_queue(cnpj);
CREATE INDEX IF NOT EXISTS idx_tq_proxima ON transmissao_queue(proxima_tentativa) WHERE status IN ('pendente','erro');
