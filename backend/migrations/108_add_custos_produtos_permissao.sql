-- =====================================================
-- Migration 108: Adicionar permissão Custos de Produtos
-- =====================================================
-- Criado em: 2025-11-18
-- Descrição: Adiciona permissão para visualizar a página de Custos de Produtos
-- =====================================================

INSERT INTO obsidian.permissoes (chave, nome, descricao, categoria, icone, rota, ordem)
VALUES (
  'custos.produtos.visualizar',
  'Custos de Produtos',
  'Visualizar a página de custos de produtos (composição e cálculo de custo)',
  'Produção',
  'DollarSign',
  '/custos-produtos',
  12
)
ON CONFLICT (chave) DO NOTHING;

-- FIM MIGRATION 108
