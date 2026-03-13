-- NFSe Freire — URL ADN Municípios customizada (override)
-- Permite definir URL base da API ADN na config quando o padrão retorna 404

ALTER TABLE config ADD COLUMN IF NOT EXISTS url_adn_mun VARCHAR(500);
