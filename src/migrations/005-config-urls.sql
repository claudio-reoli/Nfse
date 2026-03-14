-- NFSe Freire — Migração 005: URLs Sefin e ADN na configuração do município
-- Permite sobrescrever as URLs padrão das APIs nacionais diretamente pelo cadastro
ALTER TABLE config ADD COLUMN IF NOT EXISTS url_sefin VARCHAR(500);
ALTER TABLE config ADD COLUMN IF NOT EXISTS url_adn   VARCHAR(500);
