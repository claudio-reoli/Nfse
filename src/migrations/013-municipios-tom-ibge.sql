-- Migration 013: Adiciona campo cod_ibge em municipios_tom
ALTER TABLE municipios_tom
  ADD COLUMN IF NOT EXISTS cod_ibge VARCHAR(7);

CREATE INDEX IF NOT EXISTS idx_mun_tom_ibge ON municipios_tom(cod_ibge);
