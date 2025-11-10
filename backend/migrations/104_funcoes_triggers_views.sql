-- ============================================================================
-- MIGRATION SELETIVA: Funções, Triggers e Views Essenciais
-- Data: 2025-11-10
-- Descrição: Adiciona objetos SQL necessários para o sistema funcionar
-- ============================================================================

-- ============================================================================
-- PARTE 1: FUNÇÕES ESSENCIAIS
-- ============================================================================

-- Função: Kit BOM Canonical (normaliza estrutura de kits)
CREATE OR REPLACE FUNCTION "obsidian"."kit_bom_canonical"(IN b JSONB) 
RETURNS JSONB 
LANGUAGE SQL
AS $$
SELECT COALESCE(
  jsonb_agg(jsonb_build_object('sku', x.sku, 'qty', x.qty) ORDER BY x.sku),
  '[]'::jsonb
)
FROM (
  SELECT upper(trim(c->>'sku')) AS sku,
         COALESCE(NULLIF(c->>'qty','')::numeric,0) AS qty
  FROM jsonb_array_elements(COALESCE(b,'[]'::jsonb)) c
  WHERE upper(trim(c->>'sku')) <> '' 
    AND COALESCE(NULLIF(c->>'qty','')::numeric,0) > 0
) x;
$$;

-- Função: Kit BOM Hash (gera hash único para composição de kit)
CREATE OR REPLACE FUNCTION "obsidian"."kit_bom_hash"(IN b JSONB) 
RETURNS TEXT 
LANGUAGE SQL
AS $$
SELECT md5((obsidian.kit_bom_canonical(b))::text);
$$;

-- Função: Processar Pedido (inserir/atualizar vendas com baixa de estoque)
CREATE OR REPLACE FUNCTION "obsidian"."processar_pedido"(
  IN p_pedido_uid TEXT,
  IN p_data_venda DATE,
  IN p_nome_cliente TEXT,
  IN p_canal TEXT,
  IN p_items JSONB,
  IN p_client_id BIGINT,
  IN p_import_id UUID,
  OUT sku_retorno TEXT,
  OUT quantidade_baixada NUMERIC,
  OUT estoque_pos NUMERIC,
  OUT operacao TEXT
) 
RETURNS SETOF RECORD 
LANGUAGE PLPGSQL
AS $$
DECLARE
    item RECORD;
    v_sku TEXT;
    v_quantidade NUMERIC;
    v_preco_unitario NUMERIC;
    v_nome_produto TEXT;
    v_estoque_atual NUMERIC;
    v_venda_existe BOOLEAN;
BEGIN
    FOR item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        sku TEXT,
        nome_produto TEXT,
        quantidade NUMERIC,
        preco_unitario NUMERIC
    )
    LOOP
        v_sku := item.sku;
        v_quantidade := item.quantidade;
        v_preco_unitario := item.preco_unitario;
        v_nome_produto := item.nome_produto;

        -- Buscar nome do produto se não informado
        IF v_nome_produto IS NULL OR v_nome_produto = v_sku THEN
            SELECT nome INTO v_nome_produto
            FROM obsidian.produtos
            WHERE sku = v_sku;

            IF v_nome_produto IS NULL THEN
                v_nome_produto := v_sku;
            END IF;
        END IF;

        -- VERIFICAR SE A VENDA JÁ EXISTE
        SELECT EXISTS(
            SELECT 1 FROM obsidian.vendas
            WHERE pedido_uid = p_pedido_uid AND sku_produto = v_sku
        ) INTO v_venda_existe;

        -- INSERIR OU ATUALIZAR VENDA
        INSERT INTO obsidian.vendas (
            pedido_uid,
            data_venda,
            nome_cliente,
            sku_produto,
            quantidade_vendida,
            preco_unitario,
            valor_total,
            nome_produto,
            canal,
            client_id,
            import_id,
            codigo_ml
        ) VALUES (
            p_pedido_uid,
            p_data_venda,
            p_nome_cliente,
            v_sku,
            v_quantidade,
            v_preco_unitario,
            v_quantidade * v_preco_unitario,
            v_nome_produto,
            p_canal,
            p_client_id,
            p_import_id,
            p_pedido_uid
        )
        ON CONFLICT ON CONSTRAINT vendas_dedupe
        DO UPDATE SET
            quantidade_vendida = EXCLUDED.quantidade_vendida,
            preco_unitario = EXCLUDED.preco_unitario,
            valor_total = EXCLUDED.valor_total,
            data_venda = EXCLUDED.data_venda,
            nome_produto = EXCLUDED.nome_produto,
            canal = EXCLUDED.canal,
            client_id = EXCLUDED.client_id,
            import_id = EXCLUDED.import_id;

        -- Buscar estoque atual
        SELECT quantidade_atual INTO v_estoque_atual
        FROM obsidian.produtos
        WHERE sku = v_sku;

        -- Retornar informação
        sku_retorno := v_sku;
        quantidade_baixada := v_quantidade;
        estoque_pos := v_estoque_atual;
        operacao := CASE WHEN v_venda_existe THEN 'UPDATE' ELSE 'INSERT' END;
        RETURN NEXT;

    END LOOP;
END;
$$;

COMMENT ON FUNCTION "obsidian"."processar_pedido" IS 
'Processa pedido: insere/atualiza vendas e retorna informações de estoque';

-- ============================================================================
-- PARTE 2: TRIGGERS PARA VENDAS
-- ============================================================================

-- Trigger Function: Baixar estoque quando criar/atualizar venda (com suporte a kits)
CREATE OR REPLACE FUNCTION "obsidian"."baixar_estoque_kit_aware"() 
RETURNS TRIGGER 
LANGUAGE PLPGSQL
AS $$
BEGIN
  -- Ignorar se for fulfillment externo
  IF COALESCE(NEW.fulfillment_ext, false) THEN
    RETURN NEW;
  END IF;

  -- Registrar movimento de estoque (negativo = saída)
  -- Se for kit, expande os componentes
  INSERT INTO obsidian.estoque_movimentos (sku, tipo, quantidade, origem_tabela, origem_id, observacao)
  SELECT
    e.sku_baixa,
    'venda'::text,
    0 - e.qtd_baixa,   -- movimento negativo
    'vendas',
    NEW.venda_id::text,
    CONCAT('Pedido ', COALESCE(NEW.pedido_uid,'-'), ' / Canal ', COALESCE(NEW.canal,'-'))
  FROM obsidian.v_vendas_expandidas_json e
  WHERE e.venda_id = NEW.venda_id;

  -- Atualizar quantidade_atual na tabela produtos
  UPDATE obsidian.produtos p
  SET quantidade_atual = p.quantidade_atual + m.soma_qtd,
      atualizado_em = now()
  FROM (
    SELECT sku, SUM(quantidade) AS soma_qtd
    FROM obsidian.estoque_movimentos
    WHERE origem_tabela = 'vendas'
      AND origem_id = NEW.venda_id::text
    GROUP BY sku
  ) m
  WHERE p.sku = m.sku;

  RETURN NEW;
END;
$$;

-- Criar trigger para baixar estoque ao inserir venda
DROP TRIGGER IF EXISTS "trg_baixa_estoque" ON "obsidian"."vendas";
CREATE TRIGGER "trg_baixa_estoque"
AFTER INSERT ON "obsidian"."vendas"
FOR EACH ROW
EXECUTE FUNCTION "obsidian"."baixar_estoque_kit_aware"();

-- Trigger Function: Ajustar estoque ao atualizar quantidade vendida
CREATE OR REPLACE FUNCTION "obsidian"."ajustar_estoque_update_venda"() 
RETURNS TRIGGER 
LANGUAGE PLPGSQL
AS $$
DECLARE
  v_diferenca NUMERIC;
BEGIN
  -- Se quantidade mudou, ajustar estoque
  IF OLD.quantidade_vendida <> NEW.quantidade_vendida THEN
    v_diferenca := NEW.quantidade_vendida - OLD.quantidade_vendida;
    
    -- Registrar movimento da diferença (negativo para baixar estoque)
    INSERT INTO obsidian.estoque_movimentos (
      sku, 
      tipo, 
      quantidade, 
      origem_tabela, 
      origem_id, 
      observacao
    )
    VALUES (
      NEW.sku_produto,
      'venda_ajuste',
      0 - v_diferenca,  -- Movimento negativo (baixa)
      'vendas',
      NEW.venda_id::text,
      CONCAT('Ajuste pedido ', COALESCE(NEW.pedido_uid,'-'), ' de ', OLD.quantidade_vendida, ' para ', NEW.quantidade_vendida, ' (+', v_diferenca, ')')
    );
    
    -- Atualizar estoque diretamente
    UPDATE obsidian.produtos p
    SET quantidade_atual = p.quantidade_atual - v_diferenca,
        atualizado_em = now()
    WHERE p.sku = NEW.sku_produto;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para ajustar estoque ao atualizar venda
DROP TRIGGER IF EXISTS "trg_ajusta_estoque_venda" ON "obsidian"."vendas";
CREATE TRIGGER "trg_ajusta_estoque_venda"
AFTER UPDATE ON "obsidian"."vendas"
FOR EACH ROW
EXECUTE FUNCTION "obsidian"."ajustar_estoque_update_venda"();

-- ============================================================================
-- PARTE 3: TRIGGERS PARA KITS
-- ============================================================================

-- Trigger Function: Validar que kit_sku é do tipo 'Kit'
CREATE OR REPLACE FUNCTION "obsidian"."assert_kit_tipo"() 
RETURNS TRIGGER 
LANGUAGE PLPGSQL
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM obsidian.produtos p
    WHERE p.sku = new.sku_kit
      AND upper(p.tipo_produto) = 'KIT'
  ) THEN
    RAISE EXCEPTION 'sku_kit % não é Tipo de Produto = KIT', new.sku_kit;
  END IF;
  RETURN NEW;
END;
$$;

-- Criar trigger para validar kits
DROP TRIGGER IF EXISTS "trg_assert_kit_tipo" ON "obsidian"."kit_components";
CREATE TRIGGER "trg_assert_kit_tipo"
BEFORE INSERT OR UPDATE ON "obsidian"."kit_components"
FOR EACH ROW
EXECUTE FUNCTION "obsidian"."assert_kit_tipo"();

-- Trigger Function: Atualizar kit_index quando kit_components mudar
CREATE OR REPLACE FUNCTION "obsidian"."fn_refresh_kit_index"() 
RETURNS TRIGGER 
LANGUAGE PLPGSQL
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  -- Calcular novo hash da composição
  SELECT md5(string_agg(component_sku || ':' || qty::text, '|' ORDER BY component_sku))
  INTO v_hash
  FROM obsidian.kit_components
  WHERE kit_sku = COALESCE(NEW.kit_sku, OLD.kit_sku);

  -- Atualizar ou inserir em kit_index
  INSERT INTO obsidian.kit_index (sku_kit, composition_hash)
  VALUES (COALESCE(NEW.kit_sku, OLD.kit_sku), v_hash)
  ON CONFLICT (sku_kit)
  DO UPDATE SET composition_hash = EXCLUDED.composition_hash;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Criar trigger para manter kit_index atualizado
DROP TRIGGER IF EXISTS "trg_refresh_kit_index" ON "obsidian"."kit_components";
CREATE TRIGGER "trg_refresh_kit_index"
AFTER INSERT OR UPDATE OR DELETE ON "obsidian"."kit_components"
FOR EACH ROW
EXECUTE FUNCTION "obsidian"."fn_refresh_kit_index"();

-- ============================================================================
-- PARTE 4: VIEWS ESSENCIAIS
-- ============================================================================

-- View: Componentes de Kits (extrai do campo kit_bom JSON)
CREATE OR REPLACE VIEW "obsidian"."v_kit_components_json" AS
SELECT 
  t.sku AS kit_sku,
  (c.value ->> 'sku'::text) AS component_sku,
  ((c.value ->> 'qty'::text))::numeric AS qty
FROM obsidian.produtos t
CROSS JOIN LATERAL jsonb_array_elements(t.kit_bom) c(value)
WHERE t.is_kit;

-- View: Vendas Expandidas (transforma kits em componentes)
CREATE OR REPLACE VIEW "obsidian"."v_vendas_expandidas_json" AS
SELECT 
  v.venda_id,
  v.data_venda,
  v.nome_cliente,
  COALESCE(vc.component_sku, v.sku_produto) AS sku_baixa,
  CASE
    WHEN p.is_kit THEN (v.quantidade_vendida * vc.qty)
    ELSE v.quantidade_vendida
  END AS qtd_baixa,
  v.canal,
  v.fulfillment_ext
FROM obsidian.vendas v
JOIN obsidian.produtos p ON p.sku = v.sku_produto
LEFT JOIN obsidian.v_kit_components_json vc ON vc.kit_sku = v.sku_produto AND p.is_kit;

-- View: Vendas Flat (para relatórios)
CREATE OR REPLACE VIEW "obsidian"."v_vendas_flat" AS
SELECT 
  data_venda AS "Data Venda",
  nome_cliente AS "Nome Cliente",
  sku_produto AS "SKU Produto",
  nome_produto AS "Nome Produto",
  quantidade_vendida AS "Quantidade Vendida",
  preco_unitario AS "Preço Unitário",
  valor_total AS "Valor Total",
  ext_id AS "ID",
  canal AS "Canal",
  criado_em AS "Criado Em"
FROM obsidian.vendas v;

-- View: Receita de Produto (para relatórios)
CREATE OR REPLACE VIEW "obsidian"."v_receita_produto" AS
SELECT 
  sku_produto AS "SKU Produto",
  sku_mp AS "SKU Matéria-Prima",
  quantidade_por_produto AS "Quantidade por Produto",
  unidade_medida AS "Unidade de Medida",
  valor_unitario AS "Valor Unitario",
  (quantidade_por_produto * valor_unitario)::numeric(14,6) AS "Valor"
FROM obsidian.receita_produto r;

-- ============================================================================
-- FIM DA MIGRATION SELETIVA
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration seletiva concluída com sucesso!';
  RAISE NOTICE '📋 Funções criadas: kit_bom_canonical, kit_bom_hash, processar_pedido';
  RAISE NOTICE '🔧 Triggers criados: baixar estoque, ajustar estoque, validar kits';
  RAISE NOTICE '📊 Views criadas: v_kit_components_json, v_vendas_expandidas_json, v_vendas_flat, v_receita_produto';
  RAISE NOTICE '⚠️  IMPORTANTE: Reinicie o backend após aplicar esta migration';
END $$;
