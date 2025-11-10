-- ============================================================================
-- MIGRATION: Funções úteis do sistema antigo
-- Data: 2025-11-10
-- Descrição: Adiciona funções SQL necessárias para o sistema funcionar
-- ============================================================================

-- Função: Extrair produto base do SKU (remove tamanhos e variações)
CREATE OR REPLACE FUNCTION "obsidian"."extrair_produto_base"(IN sku TEXT) 
RETURNS TEXT 
LANGUAGE PLPGSQL
AS $$
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

COMMENT ON FUNCTION "obsidian"."extrair_produto_base" IS 
'Extrai o SKU base de um produto removendo tamanhos e variações';

-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Funções auxiliares criadas com sucesso!';
  RAISE NOTICE '📋 Funções: extrair_produto_base';
END $$;
