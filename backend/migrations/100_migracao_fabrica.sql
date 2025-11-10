-- ============================================================================
-- MIGRAÇÃO: E-COMMERCE → FÁBRICA
-- Data: 2025-11-10
-- Descrição: Adiciona tabelas e campos para gestão de produção industrial
-- ============================================================================

-- ============================================================================
-- PARTE 1: ADAPTAÇÃO DE TABELAS EXISTENTES
-- ============================================================================

-- 1.1. Adicionar campos de produção na tabela produtos
ALTER TABLE "obsidian"."produtos" 
ADD COLUMN IF NOT EXISTS "tipo_estoque" TEXT DEFAULT 'acabado',
ADD COLUMN IF NOT EXISTS "tempo_producao_minutos" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lote_minimo" NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS "ponto_reposicao" NUMERIC DEFAULT 0;

COMMENT ON COLUMN "obsidian"."produtos"."tipo_estoque" IS 
'Tipo de estoque: materia_prima, em_processo, acabado';

COMMENT ON COLUMN "obsidian"."produtos"."tempo_producao_minutos" IS 
'Tempo estimado de produção em minutos (para planejamento)';

COMMENT ON COLUMN "obsidian"."produtos"."lote_minimo" IS 
'Quantidade mínima para produção/compra';

COMMENT ON COLUMN "obsidian"."produtos"."ponto_reposicao" IS 
'Quando estoque chegar neste ponto, alertar reposição';

-- 1.2. Adicionar campos para identificar setores na tabela clientes
ALTER TABLE "obsidian"."clientes" 
ADD COLUMN IF NOT EXISTS "tipo" TEXT DEFAULT 'externo',
ADD COLUMN IF NOT EXISTS "codigo_setor" TEXT;

COMMENT ON COLUMN "obsidian"."clientes"."tipo" IS 
'Tipo: interno_setor (linha de produção) ou externo (cliente final)';

-- 1.3. Adicionar novos tipos de movimento em estoque_movimentos
COMMENT ON COLUMN "obsidian"."estoque_movimentos"."tipo" IS 
'Tipos: entrada_mp, consumo_mp, producao, venda, ajuste, refugo, transferencia, perda';

-- ============================================================================
-- PARTE 2: NOVAS TABELAS PARA PRODUÇÃO
-- ============================================================================

-- 2.1. Tabela de Ordens de Produção (OP)
CREATE TABLE IF NOT EXISTS "obsidian"."ordens_producao" (
  "id" SERIAL PRIMARY KEY,
  "numero_op" TEXT NOT NULL UNIQUE,
  "sku_produto" TEXT NOT NULL,
  "quantidade_planejada" NUMERIC NOT NULL,
  "quantidade_produzida" NUMERIC DEFAULT 0,
  "quantidade_refugo" NUMERIC DEFAULT 0,
  "data_abertura" DATE NOT NULL DEFAULT CURRENT_DATE,
  "data_inicio" TIMESTAMP,
  "data_conclusao" TIMESTAMP,
  "prioridade" TEXT DEFAULT 'normal',
  "status" TEXT DEFAULT 'aguardando',
  "setor_id" INTEGER,
  "observacoes" TEXT,
  "criado_por" UUID,
  "criado_em" TIMESTAMP DEFAULT now(),
  "atualizado_em" TIMESTAMP DEFAULT now(),
  CONSTRAINT "fk_op_produto" FOREIGN KEY ("sku_produto") 
    REFERENCES "obsidian"."produtos"("sku") ON DELETE RESTRICT,
  CONSTRAINT "fk_op_setor" FOREIGN KEY ("setor_id") 
    REFERENCES "obsidian"."clientes"("id") ON DELETE SET NULL,
  CONSTRAINT "fk_op_usuario" FOREIGN KEY ("criado_por") 
    REFERENCES "obsidian"."usuarios"("id") ON DELETE SET NULL
);

COMMENT ON TABLE "obsidian"."ordens_producao" IS 
'Ordens de Produção - controla o que será fabricado';

COMMENT ON COLUMN "obsidian"."ordens_producao"."numero_op" IS 
'Número único da OP (ex: OP-2025-001)';

COMMENT ON COLUMN "obsidian"."ordens_producao"."prioridade" IS 
'Prioridade: baixa, normal, alta, urgente';

COMMENT ON COLUMN "obsidian"."ordens_producao"."status" IS 
'Status: aguardando, aguardando_mp, pronto_para_iniciar, em_producao, pausada, concluida, cancelada';

-- 2.2. Tabela de Apontamentos de Produção
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
  CONSTRAINT "fk_apontamento_op" FOREIGN KEY ("op_id") 
    REFERENCES "obsidian"."ordens_producao"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_apontamento_operador" FOREIGN KEY ("operador_id") 
    REFERENCES "obsidian"."usuarios"("id") ON DELETE SET NULL
);

COMMENT ON TABLE "obsidian"."apontamentos_producao" IS 
'Registros de produção realizada em cada OP';

-- 2.3. Tabela de Consumo de Matéria-Prima por OP
CREATE TABLE IF NOT EXISTS "obsidian"."consumo_mp_op" (
  "id" SERIAL PRIMARY KEY,
  "op_id" INTEGER NOT NULL,
  "sku_mp" TEXT NOT NULL,
  "quantidade_planejada" NUMERIC NOT NULL,
  "quantidade_consumida" NUMERIC DEFAULT 0,
  "criado_em" TIMESTAMP DEFAULT now(),
  CONSTRAINT "fk_consumo_op" FOREIGN KEY ("op_id") 
    REFERENCES "obsidian"."ordens_producao"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_consumo_mp" FOREIGN KEY ("sku_mp") 
    REFERENCES "obsidian"."materia_prima"("sku_mp") ON DELETE RESTRICT,
  CONSTRAINT "uq_consumo_op_mp" UNIQUE ("op_id", "sku_mp")
);

COMMENT ON TABLE "obsidian"."consumo_mp_op" IS 
'Rastreabilidade de consumo de matéria-prima por OP';

-- 2.4. Tabela de Refugos e Retrabalho
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
  CONSTRAINT "fk_refugo_op" FOREIGN KEY ("op_id") 
    REFERENCES "obsidian"."ordens_producao"("id") ON DELETE SET NULL,
  CONSTRAINT "fk_refugo_apontamento" FOREIGN KEY ("apontamento_id") 
    REFERENCES "obsidian"."apontamentos_producao"("id") ON DELETE SET NULL,
  CONSTRAINT "fk_refugo_usuario" FOREIGN KEY ("registrado_por") 
    REFERENCES "obsidian"."usuarios"("id") ON DELETE SET NULL
);

COMMENT ON TABLE "obsidian"."refugos" IS 
'Registro de refugos e perdas na produção';

COMMENT ON COLUMN "obsidian"."refugos"."tipo_problema" IS 
'Tipo: refugo, retrabalho, perda_materia_prima';

-- 2.5. Tabela de KPIs de Produção (opcional para fase 2)
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
  CONSTRAINT "fk_kpi_setor" FOREIGN KEY ("setor_id") 
    REFERENCES "obsidian"."clientes"("id") ON DELETE SET NULL,
  CONSTRAINT "fk_kpi_op" FOREIGN KEY ("op_id") 
    REFERENCES "obsidian"."ordens_producao"("id") ON DELETE CASCADE
);

COMMENT ON TABLE "obsidian"."kpis_producao" IS 
'KPIs calculados de produção (eficiência, refugo, tempo)';

-- ============================================================================
-- PARTE 3: ÍNDICES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_op_status" ON "obsidian"."ordens_producao"("status");
CREATE INDEX IF NOT EXISTS "idx_op_data_abertura" ON "obsidian"."ordens_producao"("data_abertura");
CREATE INDEX IF NOT EXISTS "idx_op_setor" ON "obsidian"."ordens_producao"("setor_id");
CREATE INDEX IF NOT EXISTS "idx_apontamento_op" ON "obsidian"."apontamentos_producao"("op_id");
CREATE INDEX IF NOT EXISTS "idx_apontamento_data" ON "obsidian"."apontamentos_producao"("data_apontamento");
CREATE INDEX IF NOT EXISTS "idx_consumo_op" ON "obsidian"."consumo_mp_op"("op_id");
CREATE INDEX IF NOT EXISTS "idx_refugo_op" ON "obsidian"."refugos"("op_id");
CREATE INDEX IF NOT EXISTS "idx_kpi_data" ON "obsidian"."kpis_producao"("data");

-- ============================================================================
-- PARTE 4: VIEWS ÚTEIS PARA PRODUÇÃO
-- ============================================================================

-- View: Ordens de Produção com detalhes do produto
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

COMMENT ON VIEW "obsidian"."v_ordens_producao_detalhadas" IS 
'View com informações completas das OPs incluindo progresso';

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

COMMENT ON VIEW "obsidian"."v_necessidade_mp" IS 
'View mostrando disponibilidade real de MP considerando OPs em andamento';

-- ============================================================================
-- PARTE 5: FUNÇÕES AUXILIARES
-- ============================================================================

-- Função: Calcular necessidade de MP para uma OP
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

COMMENT ON FUNCTION "obsidian"."calcular_necessidade_mp" IS 
'Calcula necessidade de matéria-prima para produzir determinada quantidade de produto';

-- Função: Gerar número de OP sequencial
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

COMMENT ON FUNCTION "obsidian"."gerar_numero_op" IS 
'Gera número sequencial de OP no formato OP-YYYY-0001';

-- ============================================================================
-- PARTE 6: TRIGGERS
-- ============================================================================

-- Trigger: Atualizar quantidade produzida na OP ao criar apontamento
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

CREATE TRIGGER "trg_atualizar_op_apos_apontamento"
AFTER INSERT ON "obsidian"."apontamentos_producao"
FOR EACH ROW
EXECUTE FUNCTION "obsidian"."atualizar_op_apos_apontamento"();

-- Trigger: Adicionar produto acabado ao estoque após apontamento
CREATE OR REPLACE FUNCTION "obsidian"."adicionar_estoque_apos_apontamento"()
RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
DECLARE
  v_sku TEXT;
BEGIN
  -- Buscar SKU do produto da OP
  SELECT sku_produto INTO v_sku
  FROM "obsidian"."ordens_producao"
  WHERE id = NEW.op_id;
  
  -- Registrar movimento de entrada
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
  
  -- Atualizar quantidade em produtos
  UPDATE "obsidian"."produtos"
  SET quantidade_atual = quantidade_atual + NEW.quantidade_produzida,
      atualizado_em = now()
  WHERE sku = v_sku;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_adicionar_estoque_apos_apontamento"
AFTER INSERT ON "obsidian"."apontamentos_producao"
FOR EACH ROW
EXECUTE FUNCTION "obsidian"."adicionar_estoque_apos_apontamento"();

-- ============================================================================
-- FIM DA MIGRAÇÃO
-- ============================================================================

-- Log de migração concluída
DO $$
BEGIN
  RAISE NOTICE '✅ Migração para Fábrica concluída com sucesso!';
  RAISE NOTICE '📋 Tabelas criadas: ordens_producao, apontamentos_producao, consumo_mp_op, refugos, kpis_producao';
  RAISE NOTICE '🔧 Campos adicionados em: produtos, clientes';
  RAISE NOTICE '📊 Views criadas: v_ordens_producao_detalhadas, v_necessidade_mp';
  RAISE NOTICE '⚙️ Funções criadas: calcular_necessidade_mp, gerar_numero_op';
END $$;
