-- Migration: Adicionar suporte para fotos de matérias-primas
-- Data: 2025-11-10

-- A tabela produto_fotos já existe e usa 'produto_base' como chave
-- Vamos criar uma tabela específica para matérias-primas para manter a separação

CREATE TABLE IF NOT EXISTS "obsidian"."materia_prima_fotos" (
  "id" SERIAL PRIMARY KEY,
  "sku_mp" VARCHAR(255) NOT NULL UNIQUE,
  "foto_url" TEXT NOT NULL,
  "foto_filename" VARCHAR(255) NULL,
  "foto_size" INTEGER NULL,
  "created_at" TIMESTAMP DEFAULT now(),
  "updated_at" TIMESTAMP DEFAULT now(),
  CONSTRAINT "fk_mp_fotos_sku" FOREIGN KEY ("sku_mp") 
    REFERENCES "obsidian"."materia_prima"("sku_mp") 
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Índice para busca rápida por SKU
CREATE INDEX IF NOT EXISTS "idx_materia_prima_fotos_sku" ON "obsidian"."materia_prima_fotos"("sku_mp");

-- Comentários
COMMENT ON TABLE "obsidian"."materia_prima_fotos" IS 'Armazena fotos das matérias-primas';
COMMENT ON COLUMN "obsidian"."materia_prima_fotos"."sku_mp" IS 'SKU da matéria-prima (chave única)';
COMMENT ON COLUMN "obsidian"."materia_prima_fotos"."foto_url" IS 'URL da foto (pode ser caminho local ou URL externa)';
COMMENT ON COLUMN "obsidian"."materia_prima_fotos"."foto_filename" IS 'Nome original do arquivo da foto';
COMMENT ON COLUMN "obsidian"."materia_prima_fotos"."foto_size" IS 'Tamanho do arquivo em bytes';
