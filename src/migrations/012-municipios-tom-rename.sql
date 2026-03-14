-- Migration 012: Renomeia nome → nome_empresarial + adiciona data_criacao em municipios_tom

-- Renomeia coluna nome para nome_empresarial
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'municipios_tom' AND column_name = 'nome'
  ) THEN
    ALTER TABLE municipios_tom RENAME COLUMN nome TO nome_empresarial;
  END IF;
END;
$$;

-- Adiciona coluna data_criacao (registro da data de importação dos dados)
ALTER TABLE municipios_tom
  ADD COLUMN IF NOT EXISTS data_criacao TIMESTAMPTZ DEFAULT NOW();

-- Popula data_criacao nos registros que ainda não têm (NULL)
UPDATE municipios_tom
SET data_criacao = NOW()
WHERE data_criacao IS NULL;
