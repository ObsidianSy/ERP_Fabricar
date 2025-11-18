-- =====================================================
-- Migration 109: Adicionar flag Cliente Drop
-- =====================================================
-- Criado em: 2025-11-18
-- Descrição: Adiciona coluna is_cliente_drop para marcar clientes
--            que recebem acréscimo automático de R$5 por produto
-- =====================================================

ALTER TABLE obsidian.clientes 
ADD COLUMN IF NOT EXISTS is_cliente_drop BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN obsidian.clientes.is_cliente_drop IS 
'TRUE se o cliente recebe automaticamente +R$5 no preço de cada produto vendido';

-- FIM MIGRATION 109
