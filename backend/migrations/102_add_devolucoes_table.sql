-- Criar tabela de devoluções (versão simplificada para contexto de fábrica)
CREATE TABLE IF NOT EXISTS "obsidian"."devolucoes" (
  "id" SERIAL PRIMARY KEY,
  "pedido_uid" TEXT,
  "sku_produto" TEXT NOT NULL,
  "quantidade_esperada" NUMERIC,
  "quantidade_recebida" NUMERIC,
  "tipo_problema" TEXT,
  "motivo_cancelamento" TEXT,
  "produto_real_recebido" TEXT,
  "conferido_em" TIMESTAMP,
  "conferido_por" TEXT,
  "observacoes" TEXT,
  "codigo_rastreio" TEXT,
  "created_at" TIMESTAMP DEFAULT now(),
  CONSTRAINT "fk_devolucao_produto" FOREIGN KEY ("sku_produto") REFERENCES "obsidian"."produtos"("sku") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "idx_devolucoes_pedido" ON "obsidian"."devolucoes"("pedido_uid");
CREATE INDEX IF NOT EXISTS "idx_devolucoes_sku" ON "obsidian"."devolucoes"("sku_produto");
CREATE INDEX IF NOT EXISTS "idx_devolucoes_conferido" ON "obsidian"."devolucoes"("conferido_em");

COMMENT ON TABLE "obsidian"."devolucoes" IS 'Registro de devoluções de produtos (retrabalho, refugo, etc)';
