-- Migration 011: Campo ente em municipios_tom (nome limpo do município)
-- Remove prefixos/sufixos institucionais preservando apenas o nome do ente.

ALTER TABLE municipios_tom ADD COLUMN IF NOT EXISTS ente VARCHAR(255);

-- ─── Passo 1: prefixos padrão + sufixos padrão ───────────────────────────────
UPDATE municipios_tom SET ente = TRIM(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  -- 0) Remove pontos/chars especiais no início
                  REGEXP_REPLACE(nome_empresarial, '^[^A-Za-z]+', '', 'g'),
                  -- 1) PREFEITURA DO MUNICIPIO DE
                  '^PREFEITURA\s+DO\s+MUNIC[Í|I]PIO\s+DE\s+', '', 'ig'
                ),
                -- 2) PREFEITURA MUNICIPAL DE
                '^PREFEITURA\s+MUNICIPAL\s+DE\s+', '', 'ig'
              ),
              -- 3) PREFEITURA MUNICIPAL (sem DE)
              '^PREFEITURA\s+MUNICIPAL\s+', '', 'ig'
            ),
            -- 4) PREFEITURA DE
            '^PREFEITURA\s+DE\s+', '', 'ig'
          ),
          -- 5) PREFEITURA (sozinha no início)
          '^PREFEITURA\s+', '', 'ig'
        ),
        -- 6) MUNICIPIO DE / MUNICÍPIO DE
        '^MUNIC[Í|I]PIO\s+DE\s+', '', 'ig'
      ),
      -- 7) MUNICIPIO / MUNICÍPIO (sozinho)
      '^MUNIC[Í|I]PIO\s+', '', 'ig'
    ),
    -- 8) Sufixo: " PREFEITURA" ou " PREFEITURA MUNICIPAL" (e variantes com ponto/extra)
    '\s+PREFEITURA(\s+MUNICIPAL(\s+DE)?)?(\s+[A-Z].*)?$', '', 'ig'
  )
);

-- ─── Passo 2: sufixos com traço  "NOME-PREFEITURA..." ────────────────────────
UPDATE municipios_tom
SET ente = TRIM(SUBSTRING(ente FROM 1 FOR POSITION('-PREFEITURA' IN UPPER(ente)) - 1))
WHERE UPPER(ente) LIKE '%-PREFEITURA%';

-- ─── Passo 3: residual "DO MUNICIPIO DE NOME" (de PREFEITURA DO MUNICIPIO DE) ─
UPDATE municipios_tom
SET ente = TRIM(REGEXP_REPLACE(ente, '^DO\s+MUNIC[Í|I]PIO\s+DE\s+', '', 'ig'))
WHERE ente ILIKE 'DO MUNIC%';

-- ─── Passo 4: remove sufixo parentético "(PREFEITURA...)" ────────────────────
UPDATE municipios_tom
SET ente = TRIM(REGEXP_REPLACE(ente, '\s*\(PREFEITURA[^)]*\)', '', 'ig'))
WHERE ente ILIKE '%(PREFEITURA%';

-- ─── Passo 5: remove typo "MUNCIPAL" (sem o I) ───────────────────────────────
UPDATE municipios_tom
SET ente = TRIM(REGEXP_REPLACE(ente, '\s+MUNCIPAL.*$', '', 'ig'))
WHERE ente ILIKE '%MUNCIPAL%';

-- ─── Passo 6: limpa pontos e espaços residuais ───────────────────────────────
UPDATE municipios_tom
SET ente = TRIM(REGEXP_REPLACE(ente, '[.\s]+$', ''))
WHERE ente ~ '[.\s]$';

-- ─── Passo 7: casos especiais residuais ─────────────────────────────────────

-- "GOVERNO DO MUNICIPIO DE NOME" → "NOME"
UPDATE municipios_tom
SET ente = TRIM(REGEXP_REPLACE(ente, '^GOVERNO\s+DO\s+MUNIC[Í|I]PIO\s+DE\s+', '', 'ig'))
WHERE ente ILIKE 'GOVERNO DO MUNIC%';

-- "NOME - MUNICIPIO DE NOME" → pega só a parte antes do traço
UPDATE municipios_tom
SET ente = TRIM(SUBSTRING(ente FROM 1 FOR POSITION(' - ' IN ente) - 1))
WHERE ente LIKE '% - %' AND (ente ILIKE '% - MUNICIPIO%' OR ente ILIKE '% - MUNIC%');

-- "PREFEITURA MUNCIPAL DE NOME" (typo: MUNCIPAL sem I) → "NOME"
UPDATE municipios_tom
SET ente = TRIM(REGEXP_REPLACE(ente, '^PREFEITURA\s+MUNCIPAL\s+DE\s+|^MUNCIPAL\s+DE\s+', '', 'ig'))
WHERE ente ILIKE 'PREFEITURA MUNCIPAL%' OR ente ILIKE 'MUNCIPAL DE%';

-- Sufixo " MUNICIPIO" sozinho (ex: "TOLEDO MUNICIPIO", "SANTO ANTONIO DE GOIAS MUNICIPIO")
UPDATE municipios_tom
SET ente = TRIM(REGEXP_REPLACE(ente, '\s+MUNIC[Í|I]PIO\s*$', '', 'ig'))
WHERE ente ~* '\s+MUNIC[Í|I]PIO$';

-- Sufixo "PREFEITURAL MUNICIPAL" (typo: PREFEITURAL)
UPDATE municipios_tom
SET ente = TRIM(REGEXP_REPLACE(ente, '\s+PREFEITURAL\s+MUNICIPAL\s*$', '', 'ig'))
WHERE ente ILIKE '%PREFEITURAL%';

-- Sufixo com barra "NOME/PREFEITURA..."
UPDATE municipios_tom
SET ente = TRIM(SUBSTRING(ente FROM 1 FOR POSITION('/PREFEITURA' IN UPPER(ente)) - 1))
WHERE UPPER(ente) LIKE '%/PREFEITURA%';

-- Índice para buscas por ente
CREATE INDEX IF NOT EXISTS idx_mun_tom_ente ON municipios_tom(ente);
