-- Migração 004: Adiciona prefeitura e brasão à configuração do município
ALTER TABLE config ADD COLUMN IF NOT EXISTS prefeitura VARCHAR(255);
ALTER TABLE config ADD COLUMN IF NOT EXISTS brasao     TEXT;
