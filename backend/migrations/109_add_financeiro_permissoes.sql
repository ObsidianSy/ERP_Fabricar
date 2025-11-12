-- =====================================================
-- Migration 109: Adicionar Permissões do Sistema Financeiro
-- =====================================================
-- Criado em: 2025-11-12
-- Descrição: Adiciona permissões para o novo módulo financeiro
--            (Contas, Cartões, Faturas, Transações)
-- =====================================================

-- Inserir permissões do sistema financeiro
INSERT INTO obsidian.permissoes (chave, nome, descricao, categoria, icone, rota, ordem) VALUES
  -- Contas Bancárias
  ('financeiro.contas.visualizar', 'Contas Bancárias', 'Visualizar contas bancárias e saldos', 'Financeiro', 'Landmark', '/financeiro/contas', 21),
  ('financeiro.contas.criar', 'Criar Contas', 'Adicionar novas contas bancárias', 'Financeiro', NULL, NULL, 22),
  ('financeiro.contas.editar', 'Editar Contas', 'Editar/excluir contas bancárias', 'Financeiro', NULL, NULL, 23),
  
  -- Cartões de Crédito
  ('financeiro.cartoes.visualizar', 'Cartões de Crédito', 'Visualizar cartões e limites', 'Financeiro', 'CreditCard', '/financeiro/cartoes', 24),
  ('financeiro.cartoes.criar', 'Criar Cartões', 'Adicionar novos cartões de crédito', 'Financeiro', NULL, NULL, 25),
  ('financeiro.cartoes.editar', 'Editar Cartões', 'Editar/excluir cartões de crédito', 'Financeiro', NULL, NULL, 26),
  
  -- Faturas
  ('financeiro.faturas.visualizar', 'Faturas', 'Visualizar faturas de cartões', 'Financeiro', 'Receipt', '/financeiro/faturas', 27),
  ('financeiro.faturas.criar', 'Criar Faturas', 'Adicionar novas faturas', 'Financeiro', NULL, NULL, 28),
  ('financeiro.faturas.editar', 'Editar Faturas', 'Editar/excluir faturas', 'Financeiro', NULL, NULL, 29),
  ('financeiro.faturas.pagar', 'Pagar Faturas', 'Marcar faturas como pagas', 'Financeiro', NULL, NULL, 30),
  
  -- Transações
  ('financeiro.transacoes.visualizar', 'Transações', 'Visualizar transações financeiras', 'Financeiro', 'ArrowLeftRight', '/financeiro/transacoes', 31),
  ('financeiro.transacoes.criar', 'Criar Transações', 'Registrar receitas e despesas', 'Financeiro', NULL, NULL, 32),
  ('financeiro.transacoes.editar', 'Editar Transações', 'Editar/excluir transações', 'Financeiro', NULL, NULL, 33),
  
  -- Categorias Financeiras
  ('financeiro.categorias.visualizar', 'Categorias Financeiras', 'Visualizar categorias de transações', 'Financeiro', NULL, NULL, 34),
  ('financeiro.categorias.editar', 'Editar Categorias', 'Criar/editar categorias financeiras', 'Financeiro', NULL, NULL, 35),
  
  -- Relatórios Financeiros
  ('financeiro.relatorios.visualizar', 'Relatórios Financeiros', 'Visualizar relatórios e análises financeiras', 'Financeiro', 'TrendingUp', NULL, 36),
  ('financeiro.dashboard', 'Dashboard Financeiro', 'Visualizar visão geral financeira', 'Financeiro', 'PieChart', NULL, 37)
ON CONFLICT (chave) DO NOTHING;

-- Comentários explicativos
COMMENT ON COLUMN obsidian.permissoes.chave IS 'Formato: modulo.entidade.acao (ex: financeiro.cartoes.visualizar)';

-- =====================================================
-- FIM DA MIGRATION 109
-- =====================================================
