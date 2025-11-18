-- CORREÇÃO: Matérias-primas de correntes que estão com unidade CM mas preço por METRO
-- Identifica correntes com custo > 0.10 e unidade CM (provavelmente preço por metro)

-- 1. Ver quais serão afetadas (RODE ISSO PRIMEIRO para verificar)
SELECT sku_mp, nome, unidade_medida, custo_unitario, quantidade_atual
FROM obsidian.materia_prima
WHERE unidade_medida ILIKE '%cm%'
  AND (nome ILIKE '%corrente%' OR nome ILIKE '%corrent%')
  AND custo_unitario > 0.10
ORDER BY nome;

-- 2. CORREÇÃO: Alterar unidade de CM para METRO (RODE DEPOIS DE VERIFICAR)
UPDATE obsidian.materia_prima
SET unidade_medida = 'METRO'
WHERE unidade_medida ILIKE '%cm%'
  AND (nome ILIKE '%corrente%' OR nome ILIKE '%corrent%')
  AND custo_unitario > 0.10;

-- 3. Verificar resultado
SELECT sku_mp, nome, unidade_medida, custo_unitario, quantidade_atual
FROM obsidian.materia_prima
WHERE nome ILIKE '%corrente%' OR nome ILIKE '%corrent%'
ORDER BY unidade_medida, nome;
