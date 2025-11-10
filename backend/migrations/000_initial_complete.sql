-- ============================================================================
-- MIGRATION INICIAL COMPLETA - ERP FÁBRICA
-- Data: 2025-11-10
-- Descrição: Cria todas as tabelas base do sistema + tabelas de produção
-- ============================================================================

-- Criar schemas se não existirem
CREATE SCHEMA IF NOT EXISTS obsidian;
CREATE SCHEMA IF NOT EXISTS logistica;
CREATE SCHEMA IF NOT EXISTS ui;

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- PARTE 1: TABELAS BASE DO SISTEMA
-- ============================================================================

-- 1. Tabela de Usuários
CREATE TABLE IF NOT EXISTS "obsidian"."usuarios" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "nome" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "senha_hash" TEXT NOT NULL,
  "ativo" BOOLEAN DEFAULT true,
  "criado_em" TIMESTAMP DEFAULT now(),
  CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "usuarios_email_key" UNIQUE ("email")
);

-- 2. Tabela de Roles (perfis)
CREATE TABLE IF NOT EXISTS "obsidian"."roles" (
  "id" SERIAL PRIMARY KEY,
  "nome" TEXT NOT NULL UNIQUE
);

-- 3. Tabela de relacionamento usuário-role
CREATE TABLE IF NOT EXISTS "obsidian"."usuario_roles" (
  "usuario_id" UUID NOT NULL,
  "role_id" INTEGER NOT NULL,
  CONSTRAINT "usuario_roles_pkey" PRIMARY KEY ("usuario_id", "role_id"),
  CONSTRAINT "fk_usuario" FOREIGN KEY ("usuario_id") REFERENCES "obsidian"."usuarios"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_role" FOREIGN KEY ("role_id") REFERENCES "obsidian"."roles"("id") ON DELETE CASCADE
);

-- 4. Tabela de Logs de Atividade
CREATE TABLE IF NOT EXISTS "obsidian"."activity_logs" (
  "id" SERIAL PRIMARY KEY,
  "user_email" TEXT NOT NULL,
  "user_name" TEXT,
  "action" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "details" JSONB,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP DEFAULT now()
);

-- 5. Tabela de Clientes/Setores
CREATE TABLE IF NOT EXISTS "obsidian"."clientes" (
  "id" SERIAL PRIMARY KEY,
  "nome" TEXT NOT NULL UNIQUE,
  "documento" TEXT,
  "telefone" TEXT,
  "observacoes" TEXT,
  "tipo" TEXT DEFAULT 'externo',
  "codigo_setor" TEXT,
  "criado_em" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON COLUMN "obsidian"."clientes"."tipo" IS 'interno_setor (linha de produção) ou externo (cliente final)';

-- 6. Tabela de Produtos
CREATE TABLE IF NOT EXISTS "obsidian"."produtos" (
  "id" SERIAL PRIMARY KEY,
  "sku" TEXT NOT NULL UNIQUE,
  "nome" TEXT NOT NULL,
  "categoria" TEXT,
  "tipo_produto" TEXT DEFAULT 'Fabricado',
  "tipo_estoque" TEXT DEFAULT 'acabado',
  "quantidade_atual" NUMERIC DEFAULT 0,
  "unidade_medida" TEXT DEFAULT 'UN',
  "preco_unitario" NUMERIC DEFAULT 0,
  "tempo_producao_minutos" INTEGER DEFAULT 0,
  "lote_minimo" NUMERIC DEFAULT 1,
  "ponto_reposicao" NUMERIC DEFAULT 0,
  "ativo" BOOLEAN DEFAULT true,
  "criado_em" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "atualizado_em" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "kit_bom" JSONB DEFAULT '[]'::jsonb,
  "is_kit" BOOLEAN,
  "kit_bom_hash" TEXT
);

COMMENT ON COLUMN "obsidian"."produtos"."tipo_estoque" IS 'materia_prima, em_processo, acabado';

-- 7. Tabela de Matéria-Prima
CREATE TABLE IF NOT EXISTS "obsidian"."materia_prima" (
  "id" SERIAL PRIMARY KEY,
  "sku_mp" TEXT NOT NULL UNIQUE,
  "nome" TEXT NOT NULL,
  "categoria" TEXT,
  "quantidade_atual" NUMERIC DEFAULT 0,
  "unidade_medida" TEXT DEFAULT 'UN',
  "custo_unitario" NUMERIC DEFAULT 0,
  "ativo" BOOLEAN DEFAULT true,
  "criado_em" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "atualizado_em" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 8. Tabela de Receita de Produto (BOM)
CREATE TABLE IF NOT EXISTS "obsidian"."receita_produto" (
  "id" SERIAL PRIMARY KEY,
  "sku_produto" TEXT NOT NULL,
  "sku_mp" TEXT NOT NULL,
  "quantidade_por_produto" NUMERIC NOT NULL,
  "unidade_medida" TEXT DEFAULT 'UN',
  "valor_unitario" NUMERIC DEFAULT 0,
  CONSTRAINT "uq_receita" UNIQUE ("sku_produto", "sku_mp"),
  CONSTRAINT "fk_receita_produto" FOREIGN KEY ("sku_produto") REFERENCES "obsidian"."produtos"("sku") ON DELETE RESTRICT,
  CONSTRAINT "fk_receita_mp" FOREIGN KEY ("sku_mp") REFERENCES "obsidian"."materia_prima"("sku_mp") ON DELETE RESTRICT
);

-- 9. Tabela de Movimentos de Estoque
CREATE TABLE IF NOT EXISTS "obsidian"."estoque_movimentos" (
  "id" SERIAL PRIMARY KEY,
  "ts" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "sku" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "quantidade" NUMERIC NOT NULL,
  "origem_tabela" TEXT,
  "origem_id" TEXT,
  "observacao" TEXT
);

COMMENT ON COLUMN "obsidian"."estoque_movimentos"."tipo" IS 
'Tipos: entrada_mp, consumo_mp, producao, venda, ajuste, refugo, transferencia, perda';

-- 10. Tabela de Kit Components
CREATE TABLE IF NOT EXISTS "obsidian"."kit_components" (
  "kit_sku" TEXT NOT NULL,
  "component_sku" TEXT NOT NULL,
  "qty" NUMERIC NOT NULL,
  CONSTRAINT "kit_components_pkey" PRIMARY KEY ("kit_sku", "component_sku")
);

-- 11. Tabela de Kit Index
CREATE TABLE IF NOT EXISTS "obsidian"."kit_index" (
  "sku_kit" TEXT NOT NULL PRIMARY KEY,
  "composition_hash" TEXT NOT NULL
);

-- 12. Tabela de Vendas
CREATE TABLE IF NOT EXISTS "obsidian"."vendas" (
  "venda_id" SERIAL PRIMARY KEY,
  "data_venda" DATE NOT NULL,
  "nome_cliente" TEXT NOT NULL,
  "sku_produto" TEXT NOT NULL,
  "quantidade_vendida" NUMERIC NOT NULL,
  "preco_unitario" NUMERIC NOT NULL,
  "valor_total" NUMERIC NOT NULL,
  "ext_id" TEXT UNIQUE,
  "nome_produto" TEXT,
  "canal" TEXT,
  "pedido_uid" TEXT,
  "fulfillment_ext" BOOLEAN DEFAULT false,
  "raw_id" BIGINT UNIQUE,
  "import_id" UUID,
  "status_venda" TEXT,
  "client_id" INTEGER,
  "codigo_ml" TEXT,
  "criado_em" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT "vendas_dedupe" UNIQUE ("pedido_uid", "sku_produto"),
  CONSTRAINT "fk_vendas_client" FOREIGN KEY ("client_id") REFERENCES "obsidian"."clientes"("id")
);

-- 13. Tabela de Pagamentos
CREATE TABLE IF NOT EXISTS "obsidian"."pagamentos" (
  "id" SERIAL PRIMARY KEY,
  "data_pagamento" DATE NOT NULL,
  "cliente_id" BIGINT,
  "nome_cliente" TEXT,
  "valor_pago" NUMERIC NOT NULL,
  "forma_pagamento" TEXT,
  "observacoes" TEXT,
  "idempotency_key" TEXT,
  "criado_em" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT "fk_pagamento_cliente" FOREIGN KEY ("cliente_id") REFERENCES "obsidian"."clientes"("id")
);

-- 14. Tabela de SKU Aliases
CREATE TABLE IF NOT EXISTS "obsidian"."sku_aliases" (
  "id" SERIAL PRIMARY KEY,
  "client_id" BIGINT NOT NULL,
  "alias_text" TEXT NOT NULL,
  "stock_sku" TEXT NOT NULL,
  "confidence_default" NUMERIC DEFAULT 0.90,
  "times_used" INTEGER DEFAULT 0,
  "last_used_at" TIMESTAMP WITH TIME ZONE,
  "created_by" BIGINT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 15. Tabela de Import Batches
CREATE TABLE IF NOT EXISTS "obsidian"."import_batches" (
  "import_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" BIGINT NOT NULL,
  "source" TEXT DEFAULT 'upseller',
  "filename" TEXT,
  "total_rows" INTEGER,
  "processed_rows" INTEGER DEFAULT 0,
  "status" TEXT DEFAULT 'processing',
  "started_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "finished_at" TIMESTAMP WITH TIME ZONE,
  "import_date" DATE
);

-- ============================================================================
-- PARTE 2: TABELAS DE PRODUÇÃO
-- ============================================================================

-- 16. Tabela de Ordens de Produção
CREATE TABLE IF NOT EXISTS "obsidian"."ordens_producao" (
  "id" SERIAL PRIMARY KEY,
  "numero_op" TEXT NOT NULL UNIQUE,
  "sku_produto" TEXT NOT NULL,
  "quantidade_planejada" NUMERIC NOT NULL,
  "quantidade_produzida" NUMERIC DEFAULT 0,
  "quantidade_refugo" NUMERIC DEFAULT 0,
  "data_abertura" DATE DEFAULT CURRENT_DATE,
  "data_inicio" TIMESTAMP,
  "data_conclusao" TIMESTAMP,
  "prioridade" TEXT DEFAULT 'normal',
  "status" TEXT DEFAULT 'aguardando',
  "setor_id" INTEGER,
  "observacoes" TEXT,
  "criado_por" UUID,
  "criado_em" TIMESTAMP DEFAULT now(),
  "atualizado_em" TIMESTAMP DEFAULT now(),
  CONSTRAINT "fk_op_produto" FOREIGN KEY ("sku_produto") REFERENCES "obsidian"."produtos"("sku") ON DELETE RESTRICT,
  CONSTRAINT "fk_op_setor" FOREIGN KEY ("setor_id") REFERENCES "obsidian"."clientes"("id") ON DELETE SET NULL,
  CONSTRAINT "fk_op_usuario" FOREIGN KEY ("criado_por") REFERENCES "obsidian"."usuarios"("id") ON DELETE SET NULL
);

COMMENT ON COLUMN "obsidian"."ordens_producao"."status" IS 
'aguardando, aguardando_mp, pronto_para_iniciar, em_producao, pausada, concluida, cancelada';

-- 17. Tabela de Apontamentos de Produção
CREATE TABLE IF NOT EXISTS "obsidian"."apontamentos_producao" (
  "id" SERIAL PRIMARY KEY,
  "op_id" INTEGER NOT NULL,
  "data_apontamento" TIMESTAMP DEFAULT now(),
  "quantidade_produzida" NUMERIC NOT NULL,
  "quantidade_refugo" NUMERIC DEFAULT 0,
  "motivo_refugo" TEXT,
  "tempo_producao_minutos" INTEGER,
  "operador_id" UUID,
  "observacoes" TEXT,
  "criado_em" TIMESTAMP DEFAULT now(),
  CONSTRAINT "fk_apontamento_op" FOREIGN KEY ("op_id") REFERENCES "obsidian"."ordens_producao"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_apontamento_operador" FOREIGN KEY ("operador_id") REFERENCES "obsidian"."usuarios"("id") ON DELETE SET NULL
);

-- 18. Tabela de Consumo de MP por OP
CREATE TABLE IF NOT EXISTS "obsidian"."consumo_mp_op" (
  "id" SERIAL PRIMARY KEY,
  "op_id" INTEGER NOT NULL,
  "sku_mp" TEXT NOT NULL,
  "quantidade_planejada" NUMERIC NOT NULL,
  "quantidade_consumida" NUMERIC DEFAULT 0,
  "criado_em" TIMESTAMP DEFAULT now(),
  CONSTRAINT "uq_consumo_op_mp" UNIQUE ("op_id", "sku_mp"),
  CONSTRAINT "fk_consumo_op" FOREIGN KEY ("op_id") REFERENCES "obsidian"."ordens_producao"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_consumo_mp" FOREIGN KEY ("sku_mp") REFERENCES "obsidian"."materia_prima"("sku_mp") ON DELETE RESTRICT
);

-- 19. Tabela de Refugos
CREATE TABLE IF NOT EXISTS "obsidian"."refugos" (
  "id" SERIAL PRIMARY KEY,
  "op_id" INTEGER,
  "apontamento_id" INTEGER,
  "sku_produto" TEXT NOT NULL,
  "quantidade" NUMERIC NOT NULL,
  "tipo_problema" TEXT NOT NULL,
  "motivo" TEXT,
  "pode_retrabalhar" BOOLEAN DEFAULT false,
  "data_registro" TIMESTAMP DEFAULT now(),
  "registrado_por" UUID,
  CONSTRAINT "fk_refugo_op" FOREIGN KEY ("op_id") REFERENCES "obsidian"."ordens_producao"("id") ON DELETE SET NULL,
  CONSTRAINT "fk_refugo_apontamento" FOREIGN KEY ("apontamento_id") REFERENCES "obsidian"."apontamentos_producao"("id") ON DELETE SET NULL,
  CONSTRAINT "fk_refugo_usuario" FOREIGN KEY ("registrado_por") REFERENCES "obsidian"."usuarios"("id") ON DELETE SET NULL
);

-- 20. Tabela de KPIs de Produção
CREATE TABLE IF NOT EXISTS "obsidian"."kpis_producao" (
  "id" SERIAL PRIMARY KEY,
  "data" DATE NOT NULL,
  "setor_id" INTEGER,
  "op_id" INTEGER,
  "quantidade_planejada" NUMERIC,
  "quantidade_produzida" NUMERIC,
  "quantidade_refugo" NUMERIC,
  "tempo_producao_minutos" INTEGER,
  "eficiencia_percentual" NUMERIC,
  "taxa_refugo_percentual" NUMERIC,
  "criado_em" TIMESTAMP DEFAULT now(),
  CONSTRAINT "fk_kpi_setor" FOREIGN KEY ("setor_id") REFERENCES "obsidian"."clientes"("id") ON DELETE SET NULL,
  CONSTRAINT "fk_kpi_op" FOREIGN KEY ("op_id") REFERENCES "obsidian"."ordens_producao"("id") ON DELETE CASCADE
);

-- ============================================================================
-- PARTE 3: ÍNDICES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_produtos_sku" ON "obsidian"."produtos"("sku");
CREATE INDEX IF NOT EXISTS "idx_produtos_tipo_estoque" ON "obsidian"."produtos"("tipo_estoque");
CREATE INDEX IF NOT EXISTS "idx_materia_prima_sku" ON "obsidian"."materia_prima"("sku_mp");
CREATE INDEX IF NOT EXISTS "idx_estoque_movimentos_sku" ON "obsidian"."estoque_movimentos"("sku");
CREATE INDEX IF NOT EXISTS "idx_estoque_movimentos_ts" ON "obsidian"."estoque_movimentos"("ts");
CREATE INDEX IF NOT EXISTS "idx_op_status" ON "obsidian"."ordens_producao"("status");
CREATE INDEX IF NOT EXISTS "idx_op_data_abertura" ON "obsidian"."ordens_producao"("data_abertura");
CREATE INDEX IF NOT EXISTS "idx_op_setor" ON "obsidian"."ordens_producao"("setor_id");
CREATE INDEX IF NOT EXISTS "idx_apontamento_op" ON "obsidian"."apontamentos_producao"("op_id");
CREATE INDEX IF NOT EXISTS "idx_apontamento_data" ON "obsidian"."apontamentos_producao"("data_apontamento");
CREATE INDEX IF NOT EXISTS "idx_consumo_op" ON "obsidian"."consumo_mp_op"("op_id");
CREATE INDEX IF NOT EXISTS "idx_refugo_op" ON "obsidian"."refugos"("op_id");
CREATE INDEX IF NOT EXISTS "idx_vendas_data" ON "obsidian"."vendas"("data_venda");
CREATE INDEX IF NOT EXISTS "idx_activity_logs_user" ON "obsidian"."activity_logs"("user_email");
CREATE INDEX IF NOT EXISTS "idx_activity_logs_created" ON "obsidian"."activity_logs"("created_at");

-- ============================================================================
-- PARTE 4: VIEWS ÚTEIS
-- ============================================================================

-- View: Ordens de Produção Detalhadas
CREATE OR REPLACE VIEW "obsidian"."v_ordens_producao_detalhadas" AS
SELECT 
  op.id,
  op.numero_op,
  op.sku_produto,
  p.nome AS nome_produto,
  p.categoria,
  op.quantidade_planejada,
  op.quantidade_produzida,
  op.quantidade_refugo,
  (op.quantidade_planejada - op.quantidade_produzida - op.quantidade_refugo) AS quantidade_pendente,
  CASE 
    WHEN op.quantidade_planejada > 0 THEN 
      ROUND((op.quantidade_produzida / op.quantidade_planejada * 100)::numeric, 2)
    ELSE 0
  END AS percentual_conclusao,
  op.data_abertura,
  op.data_inicio,
  op.data_conclusao,
  op.prioridade,
  op.status,
  c.nome AS setor,
  u.nome AS criado_por_nome,
  op.observacoes,
  op.criado_em,
  op.atualizado_em
FROM "obsidian"."ordens_producao" op
LEFT JOIN "obsidian"."produtos" p ON p.sku = op.sku_produto
LEFT JOIN "obsidian"."clientes" c ON c.id = op.setor_id
LEFT JOIN "obsidian"."usuarios" u ON u.id = op.criado_por;

-- View: Necessidade de Matéria-Prima
CREATE OR REPLACE VIEW "obsidian"."v_necessidade_mp" AS
SELECT 
  mp.sku_mp,
  mp.nome,
  mp.quantidade_atual AS estoque_atual,
  mp.unidade_medida,
  COALESCE(SUM(c.quantidade_planejada - c.quantidade_consumida), 0) AS quantidade_reservada,
  mp.quantidade_atual - COALESCE(SUM(c.quantidade_planejada - c.quantidade_consumida), 0) AS disponivel
FROM "obsidian"."materia_prima" mp
LEFT JOIN "obsidian"."consumo_mp_op" c ON c.sku_mp = mp.sku_mp
LEFT JOIN "obsidian"."ordens_producao" op ON op.id = c.op_id 
  AND op.status IN ('aguardando', 'pronto_para_iniciar', 'em_producao', 'pausada')
WHERE mp.ativo = true
GROUP BY mp.sku_mp, mp.nome, mp.quantidade_atual, mp.unidade_medida;

-- ============================================================================
-- PARTE 5: FUNÇÕES SQL
-- ============================================================================

-- Função: Calcular necessidade de MP
CREATE OR REPLACE FUNCTION "obsidian"."calcular_necessidade_mp"(
  p_sku_produto TEXT,
  p_quantidade NUMERIC
) RETURNS TABLE(
  sku_mp TEXT,
  quantidade_necessaria NUMERIC,
  estoque_disponivel NUMERIC,
  falta NUMERIC
) LANGUAGE PLPGSQL AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.sku_mp,
    r.quantidade_por_produto * p_quantidade AS quantidade_necessaria,
    mp.quantidade_atual AS estoque_disponivel,
    GREATEST(0, (r.quantidade_por_produto * p_quantidade) - mp.quantidade_atual) AS falta
  FROM "obsidian"."receita_produto" r
  JOIN "obsidian"."materia_prima" mp ON mp.sku_mp = r.sku_mp
  WHERE r.sku_produto = p_sku_produto
    AND mp.ativo = true;
END;
$$;

-- Função: Gerar número de OP
CREATE OR REPLACE FUNCTION "obsidian"."gerar_numero_op"() 
RETURNS TEXT LANGUAGE PLPGSQL AS $$
DECLARE
  v_ano TEXT;
  v_seq INTEGER;
  v_numero TEXT;
BEGIN
  v_ano := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(numero_op FROM 'OP-' || v_ano || '-(.*)') AS INTEGER)
  ), 0) + 1
  INTO v_seq
  FROM "obsidian"."ordens_producao"
  WHERE numero_op LIKE 'OP-' || v_ano || '-%';
  
  v_numero := 'OP-' || v_ano || '-' || LPAD(v_seq::TEXT, 4, '0');
  
  RETURN v_numero;
END;
$$;

-- ============================================================================
-- PARTE 6: TRIGGERS
-- ============================================================================

-- Trigger: Atualizar OP após apontamento
CREATE OR REPLACE FUNCTION "obsidian"."atualizar_op_apos_apontamento"()
RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
BEGIN
  UPDATE "obsidian"."ordens_producao"
  SET quantidade_produzida = quantidade_produzida + NEW.quantidade_produzida,
      quantidade_refugo = quantidade_refugo + COALESCE(NEW.quantidade_refugo, 0),
      atualizado_em = now()
  WHERE id = NEW.op_id;
  
  -- Se atingiu quantidade planejada, marca como concluída
  UPDATE "obsidian"."ordens_producao"
  SET status = 'concluida',
      data_conclusao = now()
  WHERE id = NEW.op_id
    AND quantidade_produzida >= quantidade_planejada
    AND status = 'em_producao';
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_atualizar_op_apos_apontamento" ON "obsidian"."apontamentos_producao";
CREATE TRIGGER "trg_atualizar_op_apos_apontamento"
AFTER INSERT ON "obsidian"."apontamentos_producao"
FOR EACH ROW
EXECUTE FUNCTION "obsidian"."atualizar_op_apos_apontamento"();

-- Trigger: Adicionar produto acabado ao estoque
CREATE OR REPLACE FUNCTION "obsidian"."adicionar_estoque_apos_apontamento"()
RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
DECLARE
  v_sku TEXT;
BEGIN
  SELECT sku_produto INTO v_sku
  FROM "obsidian"."ordens_producao"
  WHERE id = NEW.op_id;
  
  INSERT INTO "obsidian"."estoque_movimentos" (
    sku, tipo, quantidade, origem_tabela, origem_id, observacao
  ) VALUES (
    v_sku,
    'producao',
    NEW.quantidade_produzida,
    'apontamentos_producao',
    NEW.id::TEXT,
    CONCAT('Apontamento OP #', NEW.op_id)
  );
  
  UPDATE "obsidian"."produtos"
  SET quantidade_atual = quantidade_atual + NEW.quantidade_produzida,
      atualizado_em = now()
  WHERE sku = v_sku;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_adicionar_estoque_apos_apontamento" ON "obsidian"."apontamentos_producao";
CREATE TRIGGER "trg_adicionar_estoque_apos_apontamento"
AFTER INSERT ON "obsidian"."apontamentos_producao"
FOR EACH ROW
EXECUTE FUNCTION "obsidian"."adicionar_estoque_apos_apontamento"();

-- ============================================================================
-- PARTE 7: DADOS INICIAIS
-- ============================================================================

-- Inserir roles padrão
INSERT INTO "obsidian"."roles" (nome) VALUES 
  ('admin'),
  ('operador'),
  ('supervisor'),
  ('visualizador')
ON CONFLICT (nome) DO NOTHING;

-- Inserir um setor padrão
INSERT INTO "obsidian"."clientes" (nome, tipo, codigo_setor) VALUES 
  ('Produção Principal', 'interno_setor', 'PROD-01')
ON CONFLICT (nome) DO NOTHING;

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration inicial concluída com sucesso!';
  RAISE NOTICE '📋 Schemas criados: obsidian, logistica, ui';
  RAISE NOTICE '📊 Tabelas criadas: 20 tabelas';
  RAISE NOTICE '🔍 Índices criados para performance';
  RAISE NOTICE '📈 Views criadas: v_ordens_producao_detalhadas, v_necessidade_mp';
  RAISE NOTICE '⚙️ Funções criadas: calcular_necessidade_mp, gerar_numero_op';
  RAISE NOTICE '🎯 Triggers criados para automação';
  RAISE NOTICE '👤 Dados iniciais: roles e setor padrão';
END $$;
