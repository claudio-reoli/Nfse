-- Migration 014: Altera data_criacao de TIMESTAMPTZ para DATE em municipios_tom
ALTER TABLE municipios_tom
  ALTER COLUMN data_criacao TYPE DATE USING data_criacao::DATE;
