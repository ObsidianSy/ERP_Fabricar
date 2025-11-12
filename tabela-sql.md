CREATE TABLE "obsidian"."activity_logs" ( 
  "id" SERIAL,
  "user_email" TEXT NOT NULL,
  "user_name" TEXT NULL,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NULL,
  "entity_id" TEXT NULL,
  "details" JSONB NULL,
  "ip_address" TEXT NULL,
  "user_agent" TEXT NULL,
  "created_at" TIMESTAMP NULL DEFAULT now() ,
  CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "obsidian"."apontamentos_producao" ( 
  "id" SERIAL,
  "op_id" INTEGER NOT NULL,
  "data_apontamento" TIMESTAMP NULL DEFAULT now() ,
  "quantidade_produzida" NUMERIC NOT NULL,
  "quantidade_refugo" NUMERIC NULL DEFAULT 0 ,
  "motivo_refugo" TEXT NULL,
  "tempo_producao_minutos" INTEGER NULL,
  "operador_id" UUID NULL,
  "observacoes" TEXT NULL,
  "criado_em" TIMESTAMP NULL DEFAULT now() ,
  CONSTRAINT "apontamentos_producao_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "obsidian"."clientes" ( 
  "id" SERIAL,
  "nome" TEXT NOT NULL,
  "documento" TEXT NULL,
  "telefone" TEXT NULL,
  "observacoes" TEXT NULL,
  "tipo" TEXT NULL DEFAULT 'externo'::text ,
  "codigo_setor" TEXT NULL,
  "criado_em" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  CONSTRAINT "clientes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clientes_nome_key" UNIQUE ("nome")
);
CREATE TABLE "obsidian"."consumo_mp_op" ( 
  "id" SERIAL,
  "op_id" INTEGER NOT NULL,
  "sku_mp" TEXT NOT NULL,
  "quantidade_planejada" NUMERIC NOT NULL,
  "quantidade_consumida" NUMERIC NULL DEFAULT 0 ,
  "criado_em" TIMESTAMP NULL DEFAULT now() ,
  CONSTRAINT "consumo_mp_op_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_consumo_op_mp" UNIQUE ("op_id", "sku_mp")
);
CREATE TABLE "obsidian"."devolucoes" ( 
  "id" SERIAL,
  "pedido_uid" TEXT NULL,
  "sku_produto" TEXT NOT NULL,
  "quantidade_esperada" NUMERIC NULL,
  "quantidade_recebida" NUMERIC NULL,
  "tipo_problema" TEXT NULL,
  "motivo_cancelamento" TEXT NULL,
  "produto_real_recebido" TEXT NULL,
  "conferido_em" TIMESTAMP NULL,
  "conferido_por" TEXT NULL,
  "observacoes" TEXT NULL,
  "codigo_rastreio" TEXT NULL,
  "created_at" TIMESTAMP NULL DEFAULT now() ,
  CONSTRAINT "devolucoes_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "obsidian"."estoque_movimentos" ( 
  "id" SERIAL,
  "ts" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  "sku" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "quantidade" NUMERIC NOT NULL,
  "origem_tabela" TEXT NULL,
  "origem_id" TEXT NULL,
  "observacao" TEXT NULL,
  CONSTRAINT "estoque_movimentos_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "obsidian"."import_batches" ( 
  "import_id" UUID NOT NULL DEFAULT gen_random_uuid() ,
  "client_id" BIGINT NOT NULL,
  "source" TEXT NULL DEFAULT 'upseller'::text ,
  "filename" TEXT NULL,
  "total_rows" INTEGER NULL,
  "processed_rows" INTEGER NULL DEFAULT 0 ,
  "status" TEXT NULL DEFAULT 'processing'::text ,
  "started_at" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  "finished_at" TIMESTAMP WITH TIME ZONE NULL,
  "import_date" DATE NULL,
  CONSTRAINT "import_batches_pkey" PRIMARY KEY ("import_id")
);
CREATE TABLE "obsidian"."kit_components" ( 
  "kit_sku" TEXT NOT NULL,
  "component_sku" TEXT NOT NULL,
  "qty" NUMERIC NOT NULL,
  CONSTRAINT "kit_components_pkey" PRIMARY KEY ("kit_sku", "component_sku")
);
CREATE TABLE "obsidian"."kit_index" ( 
  "sku_kit" TEXT NOT NULL,
  "composition_hash" TEXT NOT NULL,
  CONSTRAINT "kit_index_pkey" PRIMARY KEY ("sku_kit")
);
CREATE TABLE "obsidian"."kpis_producao" ( 
  "id" SERIAL,
  "data" DATE NOT NULL,
  "setor_id" INTEGER NULL,
  "op_id" INTEGER NULL,
  "quantidade_planejada" NUMERIC NULL,
  "quantidade_produzida" NUMERIC NULL,
  "quantidade_refugo" NUMERIC NULL,
  "tempo_producao_minutos" INTEGER NULL,
  "eficiencia_percentual" NUMERIC NULL,
  "taxa_refugo_percentual" NUMERIC NULL,
  "criado_em" TIMESTAMP NULL DEFAULT now() ,
  CONSTRAINT "kpis_producao_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "obsidian"."materia_prima" ( 
  "id" SERIAL,
  "sku_mp" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "categoria" TEXT NULL,
  "quantidade_atual" NUMERIC NULL DEFAULT 0 ,
  "unidade_medida" TEXT NULL DEFAULT 'UN'::text ,
  "custo_unitario" NUMERIC NULL DEFAULT 0 ,
  "ativo" BOOLEAN NULL DEFAULT true ,
  "criado_em" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  "atualizado_em" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  CONSTRAINT "materia_prima_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "materia_prima_sku_mp_key" UNIQUE ("sku_mp")
);
CREATE TABLE "obsidian"."materia_prima_fotos" ( 
  "id" SERIAL,
  "sku_mp" VARCHAR(255) NOT NULL,
  "foto_url" TEXT NOT NULL,
  "foto_filename" VARCHAR(255) NULL,
  "foto_size" INTEGER NULL,
  "created_at" TIMESTAMP NULL DEFAULT now() ,
  "updated_at" TIMESTAMP NULL DEFAULT now() ,
  CONSTRAINT "materia_prima_fotos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "materia_prima_fotos_sku_mp_key" UNIQUE ("sku_mp")
);
CREATE TABLE "obsidian"."ordens_producao" ( 
  "id" SERIAL,
  "numero_op" TEXT NOT NULL,
  "sku_produto" TEXT NOT NULL,
  "quantidade_planejada" NUMERIC NOT NULL,
  "quantidade_produzida" NUMERIC NULL DEFAULT 0 ,
  "quantidade_refugo" NUMERIC NULL DEFAULT 0 ,
  "data_abertura" DATE NULL DEFAULT CURRENT_DATE ,
  "data_inicio" TIMESTAMP NULL,
  "data_conclusao" TIMESTAMP NULL,
  "prioridade" TEXT NULL DEFAULT 'normal'::text ,
  "status" TEXT NULL DEFAULT 'aguardando'::text ,
  "setor_id" INTEGER NULL,
  "observacoes" TEXT NULL,
  "criado_por" UUID NULL,
  "criado_em" TIMESTAMP NULL DEFAULT now() ,
  "atualizado_em" TIMESTAMP NULL DEFAULT now() ,
  CONSTRAINT "ordens_producao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ordens_producao_numero_op_key" UNIQUE ("numero_op")
);
CREATE TABLE "obsidian"."pagamentos" ( 
  "id" SERIAL,
  "data_pagamento" DATE NOT NULL,
  "cliente_id" BIGINT NULL,
  "nome_cliente" TEXT NULL,
  "valor_pago" NUMERIC NOT NULL,
  "forma_pagamento" TEXT NULL,
  "observacoes" TEXT NULL,
  "idempotency_key" TEXT NULL,
  "criado_em" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "obsidian"."permissoes" ( 
  "id" SERIAL,
  "chave" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "descricao" TEXT NULL,
  "categoria" TEXT NULL,
  "icone" TEXT NULL,
  "rota" TEXT NULL,
  "ordem" INTEGER NULL DEFAULT 0 ,
  "ativo" BOOLEAN NULL DEFAULT true ,
  "created_at" TIMESTAMP NULL DEFAULT now() ,
  CONSTRAINT "permissoes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "permissoes_chave_key" UNIQUE ("chave")
);
CREATE TABLE "obsidian"."produto_fotos" ( 
  "id" SERIAL,
  "produto_base" VARCHAR(255) NOT NULL,
  "foto_url" TEXT NOT NULL,
  "foto_filename" VARCHAR(255) NULL,
  "foto_size" INTEGER NULL,
  "created_at" TIMESTAMP NULL DEFAULT now() ,
  "updated_at" TIMESTAMP NULL DEFAULT now() ,
  CONSTRAINT "produto_fotos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "produto_fotos_produto_base_key" UNIQUE ("produto_base")
);
CREATE TABLE "obsidian"."produtos" ( 
  "id" SERIAL,
  "sku" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "categoria" TEXT NULL,
  "tipo_produto" TEXT NULL DEFAULT 'Fabricado'::text ,
  "tipo_estoque" TEXT NULL DEFAULT 'acabado'::text ,
  "quantidade_atual" NUMERIC NULL DEFAULT 0 ,
  "unidade_medida" TEXT NULL DEFAULT 'UN'::text ,
  "preco_unitario" NUMERIC NULL DEFAULT 0 ,
  "tempo_producao_minutos" INTEGER NULL DEFAULT 0 ,
  "lote_minimo" NUMERIC NULL DEFAULT 1 ,
  "ponto_reposicao" NUMERIC NULL DEFAULT 0 ,
  "ativo" BOOLEAN NULL DEFAULT true ,
  "criado_em" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  "atualizado_em" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  "kit_bom" JSONB NULL DEFAULT '[]'::jsonb ,
  "is_kit" BOOLEAN NULL,
  "kit_bom_hash" TEXT NULL,
  CONSTRAINT "produtos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "produtos_sku_key" UNIQUE ("sku")
);
CREATE TABLE "obsidian"."receita_produto" ( 
  "id" SERIAL,
  "sku_produto" TEXT NOT NULL,
  "sku_mp" TEXT NOT NULL,
  "quantidade_por_produto" NUMERIC NOT NULL,
  "unidade_medida" TEXT NULL DEFAULT 'UN'::text ,
  "valor_unitario" NUMERIC NULL DEFAULT 0 ,
  CONSTRAINT "receita_produto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_receita" UNIQUE ("sku_produto", "sku_mp")
);
CREATE TABLE "obsidian"."refugos" ( 
  "id" SERIAL,
  "op_id" INTEGER NULL,
  "apontamento_id" INTEGER NULL,
  "sku_produto" TEXT NOT NULL,
  "quantidade" NUMERIC NOT NULL,
  "tipo_problema" TEXT NOT NULL,
  "motivo" TEXT NULL,
  "pode_retrabalhar" BOOLEAN NULL DEFAULT false ,
  "data_registro" TIMESTAMP NULL DEFAULT now() ,
  "registrado_por" UUID NULL,
  CONSTRAINT "refugos_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "obsidian"."roles" ( 
  "id" SERIAL,
  "nome" TEXT NOT NULL,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "roles_nome_key" UNIQUE ("nome")
);
CREATE TABLE "obsidian"."sku_aliases" ( 
  "id" SERIAL,
  "client_id" BIGINT NOT NULL,
  "alias_text" TEXT NOT NULL,
  "stock_sku" TEXT NOT NULL,
  "confidence_default" NUMERIC NULL DEFAULT 0.90 ,
  "times_used" INTEGER NULL DEFAULT 0 ,
  "last_used_at" TIMESTAMP WITH TIME ZONE NULL,
  "created_by" BIGINT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  CONSTRAINT "sku_aliases_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "obsidian"."usuario_roles" ( 
  "usuario_id" UUID NOT NULL,
  "role_id" INTEGER NOT NULL,
  CONSTRAINT "usuario_roles_pkey" PRIMARY KEY ("usuario_id", "role_id")
);
CREATE TABLE "obsidian"."usuarios" ( 
  "id" UUID NOT NULL DEFAULT gen_random_uuid() ,
  "nome" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "senha_hash" TEXT NOT NULL,
  "ativo" BOOLEAN NULL DEFAULT true ,
  "criado_em" TIMESTAMP NULL DEFAULT now() ,
  "cargo" TEXT NULL DEFAULT 'operador'::text ,
  CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "usuarios_email_key" UNIQUE ("email")
);
CREATE TABLE "obsidian"."usuarios_permissoes" ( 
  "id" SERIAL,
  "usuario_id" UUID NOT NULL,
  "permissao_id" INTEGER NOT NULL,
  "concedida_por" UUID NULL,
  "concedida_em" TIMESTAMP NULL DEFAULT now() ,
  CONSTRAINT "usuarios_permissoes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_usuario_permissao" UNIQUE ("usuario_id", "permissao_id")
);
CREATE TABLE "obsidian"."vendas" ( 
  "venda_id" SERIAL,
  "data_venda" DATE NOT NULL,
  "nome_cliente" TEXT NOT NULL,
  "sku_produto" TEXT NOT NULL,
  "quantidade_vendida" NUMERIC NOT NULL,
  "preco_unitario" NUMERIC NOT NULL,
  "valor_total" NUMERIC NOT NULL,
  "ext_id" TEXT NULL,
  "nome_produto" TEXT NULL,
  "canal" TEXT NULL,
  "pedido_uid" TEXT NULL,
  "fulfillment_ext" BOOLEAN NULL DEFAULT false ,
  "raw_id" BIGINT NULL,
  "import_id" UUID NULL,
  "status_venda" TEXT NULL,
  "client_id" INTEGER NULL,
  "codigo_ml" TEXT NULL,
  "criado_em" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  CONSTRAINT "vendas_pkey" PRIMARY KEY ("venda_id"),
  CONSTRAINT "vendas_ext_id_key" UNIQUE ("ext_id"),
  CONSTRAINT "vendas_raw_id_key" UNIQUE ("raw_id"),
  CONSTRAINT "vendas_dedupe" UNIQUE ("pedido_uid", "sku_produto")
);
ALTER TABLE "obsidian"."apontamentos_producao" ADD CONSTRAINT "fk_apontamento_op" FOREIGN KEY ("op_id") REFERENCES "obsidian"."ordens_producao" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "obsidian"."apontamentos_producao" ADD CONSTRAINT "fk_apontamento_operador" FOREIGN KEY ("operador_id") REFERENCES "obsidian"."usuarios" ("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "obsidian"."consumo_mp_op" ADD CONSTRAINT "fk_consumo_op" FOREIGN KEY ("op_id") REFERENCES "obsidian"."ordens_producao" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "obsidian"."consumo_mp_op" ADD CONSTRAINT "fk_consumo_mp" FOREIGN KEY ("sku_mp") REFERENCES "obsidian"."materia_prima" ("sku_mp") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "obsidian"."kpis_producao" ADD CONSTRAINT "fk_kpi_setor" FOREIGN KEY ("setor_id") REFERENCES "obsidian"."clientes" ("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "obsidian"."kpis_producao" ADD CONSTRAINT "fk_kpi_op" FOREIGN KEY ("op_id") REFERENCES "obsidian"."ordens_producao" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "obsidian"."ordens_producao" ADD CONSTRAINT "fk_op_produto" FOREIGN KEY ("sku_produto") REFERENCES "obsidian"."produtos" ("sku") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "obsidian"."ordens_producao" ADD CONSTRAINT "fk_op_setor" FOREIGN KEY ("setor_id") REFERENCES "obsidian"."clientes" ("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "obsidian"."ordens_producao" ADD CONSTRAINT "fk_op_usuario" FOREIGN KEY ("criado_por") REFERENCES "obsidian"."usuarios" ("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "obsidian"."pagamentos" ADD CONSTRAINT "fk_pagamento_cliente" FOREIGN KEY ("cliente_id") REFERENCES "obsidian"."clientes" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "obsidian"."receita_produto" ADD CONSTRAINT "fk_receita_produto" FOREIGN KEY ("sku_produto") REFERENCES "obsidian"."produtos" ("sku") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "obsidian"."receita_produto" ADD CONSTRAINT "fk_receita_mp" FOREIGN KEY ("sku_mp") REFERENCES "obsidian"."materia_prima" ("sku_mp") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "obsidian"."refugos" ADD CONSTRAINT "fk_refugo_op" FOREIGN KEY ("op_id") REFERENCES "obsidian"."ordens_producao" ("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "obsidian"."refugos" ADD CONSTRAINT "fk_refugo_apontamento" FOREIGN KEY ("apontamento_id") REFERENCES "obsidian"."apontamentos_producao" ("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "obsidian"."refugos" ADD CONSTRAINT "fk_refugo_usuario" FOREIGN KEY ("registrado_por") REFERENCES "obsidian"."usuarios" ("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "obsidian"."usuario_roles" ADD CONSTRAINT "fk_usuario" FOREIGN KEY ("usuario_id") REFERENCES "obsidian"."usuarios" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "obsidian"."usuario_roles" ADD CONSTRAINT "fk_role" FOREIGN KEY ("role_id") REFERENCES "obsidian"."roles" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "obsidian"."usuarios_permissoes" ADD CONSTRAINT "usuarios_permissoes_permissao_id_fkey" FOREIGN KEY ("permissao_id") REFERENCES "obsidian"."permissoes" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "obsidian"."vendas" ADD CONSTRAINT "fk_vendas_client" FOREIGN KEY ("client_id") REFERENCES "obsidian"."clientes" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE FUNCTION "obsidian"."adicionar_estoque_apos_apontamento"() RETURNS TRIGGER LANGUAGE PLPGSQL
AS
$$

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
CREATE FUNCTION "obsidian"."ajustar_estoque_update_venda"() RETURNS TRIGGER LANGUAGE PLPGSQL
AS
$$

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
CREATE FUNCTION "public"."armor"() RETURNS TEXT|TEXT LANGUAGE C
AS
$$
pg_armor
$$;
CREATE FUNCTION "obsidian"."assert_kit_tipo"() RETURNS TRIGGER LANGUAGE PLPGSQL
AS
$$

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
CREATE FUNCTION "obsidian"."atualizar_op_apos_apontamento"() RETURNS TRIGGER LANGUAGE PLPGSQL
AS
$$

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
CREATE FUNCTION "obsidian"."baixar_estoque_kit_aware"() RETURNS TRIGGER LANGUAGE PLPGSQL
AS
$$

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
CREATE FUNCTION "obsidian"."calcular_necessidade_mp"(IN p_sku_produto TEXT, IN p_quantidade NUMERIC, OUT sku_mp TEXT, OUT quantidade_necessaria NUMERIC, OUT estoque_disponivel NUMERIC, OUT falta NUMERIC) RETURNS RECORD LANGUAGE PLPGSQL
AS
$$

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
CREATE FUNCTION "public"."crypt"() RETURNS TEXT LANGUAGE C
AS
$$
pg_crypt
$$;
CREATE FUNCTION "public"."dearmor"() RETURNS BYTEA LANGUAGE C
AS
$$
pg_dearmor
$$;
CREATE FUNCTION "public"."decrypt"() RETURNS BYTEA LANGUAGE C
AS
$$
pg_decrypt
$$;
CREATE FUNCTION "public"."decrypt_iv"() RETURNS BYTEA LANGUAGE C
AS
$$
pg_decrypt_iv
$$;
CREATE FUNCTION "public"."digest"() RETURNS BYTEA|BYTEA LANGUAGE C
AS
$$
pg_digest
$$;
CREATE FUNCTION "public"."encrypt"() RETURNS BYTEA LANGUAGE C
AS
$$
pg_encrypt
$$;
CREATE FUNCTION "public"."encrypt_iv"() RETURNS BYTEA LANGUAGE C
AS
$$
pg_encrypt_iv
$$;
CREATE FUNCTION "obsidian"."extrair_produto_base"(IN sku TEXT) RETURNS TEXT LANGUAGE PLPGSQL
AS
$$

DECLARE
    sku_upper TEXT;
    sku_clean TEXT;
BEGIN
    -- Converter para maiúsculas e remover espaços
    sku_upper := UPPER(TRIM(sku));
    
    -- Remover tamanhos do final:
    -- Números: ATR-AZL-37 → ATR-AZL, CH202-PRETO-40 → CH202-PRETO
    -- Letras: H302-PTO-P → H302-PTO, CH202-PRETO-M → CH202-PRETO
    -- Combinação: ATR-AZL-37P → ATR-AZL
    sku_clean := REGEXP_REPLACE(sku_upper, '-?[0-9]*[PPMGXS]+$', '');
    sku_clean := REGEXP_REPLACE(sku_clean, '-?\d+$', '');
    
    -- Remover traço final se sobrou
    sku_clean := REGEXP_REPLACE(sku_clean, '-$', '');
    
    RETURN sku_clean;
END;

$$;
CREATE FUNCTION "obsidian"."fn_refresh_kit_index"() RETURNS TRIGGER LANGUAGE PLPGSQL
AS
$$

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
CREATE FUNCTION "public"."gen_random_bytes"() RETURNS BYTEA LANGUAGE C
AS
$$
pg_random_bytes
$$;
CREATE FUNCTION "public"."gen_random_uuid"() RETURNS UUID LANGUAGE C
AS
$$
pg_random_uuid
$$;
CREATE FUNCTION "public"."gen_salt"() RETURNS TEXT|TEXT LANGUAGE C
AS
$$
pg_gen_salt_rounds
$$;
CREATE FUNCTION "obsidian"."gerar_numero_op"() RETURNS TEXT LANGUAGE PLPGSQL
AS
$$

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
CREATE FUNCTION "public"."gin_extract_query_trgm"() RETURNS INTERNAL LANGUAGE C
AS
$$
gin_extract_query_trgm
$$;
CREATE FUNCTION "public"."gin_extract_value_trgm"() RETURNS INTERNAL LANGUAGE C
AS
$$
gin_extract_value_trgm
$$;
CREATE FUNCTION "public"."gin_trgm_consistent"() RETURNS BOOLEAN LANGUAGE C
AS
$$
gin_trgm_consistent
$$;
CREATE FUNCTION "public"."gin_trgm_triconsistent"() RETURNS "CHAR" LANGUAGE C
AS
$$
gin_trgm_triconsistent
$$;
CREATE FUNCTION "public"."gtrgm_compress"() RETURNS INTERNAL LANGUAGE C
AS
$$
gtrgm_compress
$$;
CREATE FUNCTION "public"."gtrgm_consistent"() RETURNS BOOLEAN LANGUAGE C
AS
$$
gtrgm_consistent
$$;
CREATE FUNCTION "public"."gtrgm_decompress"() RETURNS INTERNAL LANGUAGE C
AS
$$
gtrgm_decompress
$$;
CREATE FUNCTION "public"."gtrgm_distance"() RETURNS DOUBLE PRECISION LANGUAGE C
AS
$$
gtrgm_distance
$$;
CREATE FUNCTION "public"."gtrgm_in"() RETURNS USER-DEFINED LANGUAGE C
AS
$$
gtrgm_in
$$;
CREATE FUNCTION "public"."gtrgm_options"() RETURNS VOID LANGUAGE C
AS
$$
gtrgm_options
$$;
CREATE FUNCTION "public"."gtrgm_out"() RETURNS CSTRING LANGUAGE C
AS
$$
gtrgm_out
$$;
CREATE FUNCTION "public"."gtrgm_penalty"() RETURNS INTERNAL LANGUAGE C
AS
$$
gtrgm_penalty
$$;
CREATE FUNCTION "public"."gtrgm_picksplit"() RETURNS INTERNAL LANGUAGE C
AS
$$
gtrgm_picksplit
$$;
CREATE FUNCTION "public"."gtrgm_same"() RETURNS INTERNAL LANGUAGE C
AS
$$
gtrgm_same
$$;
CREATE FUNCTION "public"."gtrgm_union"() RETURNS USER-DEFINED LANGUAGE C
AS
$$
gtrgm_union
$$;
CREATE FUNCTION "public"."hmac"() RETURNS BYTEA|BYTEA LANGUAGE C
AS
$$
pg_hmac
$$;
CREATE FUNCTION "obsidian"."kit_bom_canonical"(IN b JSONB) RETURNS JSONB LANGUAGE SQL
AS
$$

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
CREATE FUNCTION "obsidian"."kit_bom_hash"(IN b JSONB) RETURNS TEXT LANGUAGE SQL
AS
$$

SELECT md5((obsidian.kit_bom_canonical(b))::text);

$$;
CREATE FUNCTION "public"."pgp_armor_headers"(OUT key TEXT, OUT value TEXT) RETURNS RECORD LANGUAGE C
AS
$$
pgp_armor_headers
$$;
CREATE FUNCTION "public"."pgp_key_id"() RETURNS TEXT LANGUAGE C
AS
$$
pgp_key_id_w
$$;
CREATE FUNCTION "public"."pgp_pub_decrypt"() RETURNS TEXT|TEXT|TEXT LANGUAGE C
AS
$$
pgp_pub_decrypt_text
$$;
CREATE FUNCTION "public"."pgp_pub_decrypt_bytea"() RETURNS BYTEA|BYTEA|BYTEA LANGUAGE C
AS
$$
pgp_pub_decrypt_bytea
$$;
CREATE FUNCTION "public"."pgp_pub_encrypt"() RETURNS BYTEA|BYTEA LANGUAGE C
AS
$$
pgp_pub_encrypt_text
$$;
CREATE FUNCTION "public"."pgp_pub_encrypt_bytea"() RETURNS BYTEA|BYTEA LANGUAGE C
AS
$$
pgp_pub_encrypt_bytea
$$;
CREATE FUNCTION "public"."pgp_sym_decrypt"() RETURNS TEXT|TEXT LANGUAGE C
AS
$$
pgp_sym_decrypt_text
$$;
CREATE FUNCTION "public"."pgp_sym_decrypt_bytea"() RETURNS BYTEA|BYTEA LANGUAGE C
AS
$$
pgp_sym_decrypt_bytea
$$;
CREATE FUNCTION "public"."pgp_sym_encrypt"() RETURNS BYTEA|BYTEA LANGUAGE C
AS
$$
pgp_sym_encrypt_text
$$;
CREATE FUNCTION "public"."pgp_sym_encrypt_bytea"() RETURNS BYTEA|BYTEA LANGUAGE C
AS
$$
pgp_sym_encrypt_bytea
$$;
CREATE FUNCTION "obsidian"."processar_pedido"(IN p_pedido_uid TEXT, IN p_data_venda DATE, IN p_nome_cliente TEXT, IN p_canal TEXT, IN p_items JSONB, IN p_client_id BIGINT, IN p_import_id UUID, OUT sku_retorno TEXT, OUT quantidade_baixada NUMERIC, OUT estoque_pos NUMERIC, OUT operacao TEXT) RETURNS RECORD LANGUAGE PLPGSQL
AS
$$

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
CREATE FUNCTION "public"."set_limit"() RETURNS REAL LANGUAGE C
AS
$$
set_limit
$$;
CREATE FUNCTION "public"."show_limit"() RETURNS REAL LANGUAGE C
AS
$$
show_limit
$$;
CREATE FUNCTION "public"."show_trgm"() RETURNS ARRAY LANGUAGE C
AS
$$
show_trgm
$$;
CREATE FUNCTION "public"."similarity"() RETURNS REAL LANGUAGE C
AS
$$
similarity
$$;
CREATE FUNCTION "public"."similarity_dist"() RETURNS REAL LANGUAGE C
AS
$$
similarity_dist
$$;
CREATE FUNCTION "public"."similarity_op"() RETURNS BOOLEAN LANGUAGE C
AS
$$
similarity_op
$$;
CREATE FUNCTION "public"."strict_word_similarity"() RETURNS REAL LANGUAGE C
AS
$$
strict_word_similarity
$$;
CREATE FUNCTION "public"."strict_word_similarity_commutator_op"() RETURNS BOOLEAN LANGUAGE C
AS
$$
strict_word_similarity_commutator_op
$$;
CREATE FUNCTION "public"."strict_word_similarity_dist_commutator_op"() RETURNS REAL LANGUAGE C
AS
$$
strict_word_similarity_dist_commutator_op
$$;
CREATE FUNCTION "public"."strict_word_similarity_dist_op"() RETURNS REAL LANGUAGE C
AS
$$
strict_word_similarity_dist_op
$$;
CREATE FUNCTION "public"."strict_word_similarity_op"() RETURNS BOOLEAN LANGUAGE C
AS
$$
strict_word_similarity_op
$$;
CREATE FUNCTION "obsidian"."usuario_tem_permissao"(IN p_usuario_id UUID, IN p_chave_permissao TEXT) RETURNS BOOLEAN LANGUAGE PLPGSQL
AS
$$

BEGIN
RETURN EXISTS (
SELECT 1
FROM obsidian.usuarios_permissoes up
JOIN obsidian.permissoes p ON p.id = up.permissao_id
WHERE up.usuario_id = p_usuario_id
AND p.chave = p_chave_permissao
AND p.ativo = TRUE
);
END;

$$;
CREATE FUNCTION "public"."uuid_generate_v1"() RETURNS UUID LANGUAGE C
AS
$$
uuid_generate_v1
$$;
CREATE FUNCTION "public"."uuid_generate_v1mc"() RETURNS UUID LANGUAGE C
AS
$$
uuid_generate_v1mc
$$;
CREATE FUNCTION "public"."uuid_generate_v3"(IN namespace UUID, IN name TEXT) RETURNS UUID LANGUAGE C
AS
$$
uuid_generate_v3
$$;
CREATE FUNCTION "public"."uuid_generate_v4"() RETURNS UUID LANGUAGE C
AS
$$
uuid_generate_v4
$$;
CREATE FUNCTION "public"."uuid_generate_v5"(IN namespace UUID, IN name TEXT) RETURNS UUID LANGUAGE C
AS
$$
uuid_generate_v5
$$;
CREATE FUNCTION "public"."uuid_nil"() RETURNS UUID LANGUAGE C
AS
$$
uuid_nil
$$;
CREATE FUNCTION "public"."uuid_ns_dns"() RETURNS UUID LANGUAGE C
AS
$$
uuid_ns_dns
$$;
CREATE FUNCTION "public"."uuid_ns_oid"() RETURNS UUID LANGUAGE C
AS
$$
uuid_ns_oid
$$;
CREATE FUNCTION "public"."uuid_ns_url"() RETURNS UUID LANGUAGE C
AS
$$
uuid_ns_url
$$;
CREATE FUNCTION "public"."uuid_ns_x500"() RETURNS UUID LANGUAGE C
AS
$$
uuid_ns_x500
$$;
CREATE FUNCTION "public"."word_similarity"() RETURNS REAL LANGUAGE C
AS
$$
word_similarity
$$;
CREATE FUNCTION "public"."word_similarity_commutator_op"() RETURNS BOOLEAN LANGUAGE C
AS
$$
word_similarity_commutator_op
$$;
CREATE FUNCTION "public"."word_similarity_dist_commutator_op"() RETURNS REAL LANGUAGE C
AS
$$
word_similarity_dist_commutator_op
$$;
CREATE FUNCTION "public"."word_similarity_dist_op"() RETURNS REAL LANGUAGE C
AS
$$
word_similarity_dist_op
$$;
CREATE FUNCTION "public"."word_similarity_op"() RETURNS BOOLEAN LANGUAGE C
AS
$$
word_similarity_op
$$;
CREATE VIEW "obsidian"."v_kit_components_json"
AS
 SELECT t.sku AS kit_sku,
    (c.value ->> 'sku'::text) AS component_sku,
    ((c.value ->> 'qty'::text))::numeric AS qty
   FROM (obsidian.produtos t
     CROSS JOIN LATERAL jsonb_array_elements(t.kit_bom) c(value))
  WHERE t.is_kit;;
CREATE VIEW "obsidian"."v_necessidade_mp"
AS
 SELECT mp.sku_mp,
    mp.nome,
    mp.quantidade_atual AS estoque_atual,
    mp.unidade_medida,
    COALESCE(sum((c.quantidade_planejada - c.quantidade_consumida)), (0)::numeric) AS quantidade_reservada,
    (mp.quantidade_atual - COALESCE(sum((c.quantidade_planejada - c.quantidade_consumida)), (0)::numeric)) AS disponivel
   FROM ((obsidian.materia_prima mp
     LEFT JOIN obsidian.consumo_mp_op c ON ((c.sku_mp = mp.sku_mp)))
     LEFT JOIN obsidian.ordens_producao op ON (((op.id = c.op_id) AND (op.status = ANY (ARRAY['aguardando'::text, 'pronto_para_iniciar'::text, 'em_producao'::text, 'pausada'::text])))))
  WHERE (mp.ativo = true)
  GROUP BY mp.sku_mp, mp.nome, mp.quantidade_atual, mp.unidade_medida;;
CREATE VIEW "obsidian"."v_ordens_producao_detalhadas"
AS
 SELECT op.id,
    op.numero_op,
    op.sku_produto,
    p.nome AS nome_produto,
    p.categoria,
    op.quantidade_planejada,
    op.quantidade_produzida,
    op.quantidade_refugo,
    ((op.quantidade_planejada - op.quantidade_produzida) - op.quantidade_refugo) AS quantidade_pendente,
        CASE
            WHEN (op.quantidade_planejada > (0)::numeric) THEN round(((op.quantidade_produzida / op.quantidade_planejada) * (100)::numeric), 2)
            ELSE (0)::numeric
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
   FROM (((obsidian.ordens_producao op
     LEFT JOIN obsidian.produtos p ON ((p.sku = op.sku_produto)))
     LEFT JOIN obsidian.clientes c ON ((c.id = op.setor_id)))
     LEFT JOIN obsidian.usuarios u ON ((u.id = op.criado_por)));;
CREATE VIEW "obsidian"."v_receita_produto"
AS
 SELECT sku_produto AS "SKU Produto",
    sku_mp AS "SKU Matéria-Prima",
    quantidade_por_produto AS "Quantidade por Produto",
    unidade_medida AS "Unidade de Medida",
    valor_unitario AS "Valor Unitario",
    ((quantidade_por_produto * valor_unitario))::numeric(14,6) AS "Valor"
   FROM obsidian.receita_produto r;;
CREATE VIEW "obsidian"."v_usuarios_permissoes"
AS
 SELECT u.id AS usuario_id,
    u.nome AS usuario_nome,
    u.email AS usuario_email,
    u.cargo AS usuario_cargo,
    p.id AS permissao_id,
    p.chave AS permissao_chave,
    p.nome AS permissao_nome,
    p.categoria AS permissao_categoria,
    p.rota AS permissao_rota,
    up.concedida_em,
    admin.nome AS concedida_por_nome
   FROM (((obsidian.usuarios_permissoes up
     JOIN obsidian.usuarios u ON ((u.id = up.usuario_id)))
     JOIN obsidian.permissoes p ON ((p.id = up.permissao_id)))
     LEFT JOIN obsidian.usuarios admin ON ((admin.id = up.concedida_por)))
  WHERE ((u.ativo = true) AND (p.ativo = true));;
CREATE VIEW "obsidian"."v_vendas_expandidas_json"
AS
 SELECT v.venda_id,
    v.data_venda,
    v.nome_cliente,
    COALESCE(vc.component_sku, v.sku_produto) AS sku_baixa,
        CASE
            WHEN p.is_kit THEN (v.quantidade_vendida * vc.qty)
            ELSE v.quantidade_vendida
        END AS qtd_baixa,
    v.canal,
    v.fulfillment_ext
   FROM ((obsidian.vendas v
     JOIN obsidian.produtos p ON ((p.sku = v.sku_produto)))
     LEFT JOIN obsidian.v_kit_components_json vc ON (((vc.kit_sku = v.sku_produto) AND p.is_kit)));;
CREATE VIEW "obsidian"."v_vendas_flat"
AS
 SELECT data_venda AS "Data Venda",
    nome_cliente AS "Nome Cliente",
    sku_produto AS "SKU Produto",
    nome_produto AS "Nome Produto",
    quantidade_vendida AS "Quantidade Vendida",
    preco_unitario AS "Preço Unitário",
    valor_total AS "Valor Total",
    ext_id AS "ID",
    canal AS "Canal",
    criado_em AS "Criado Em"
   FROM obsidian.vendas v;;
