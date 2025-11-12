-- =====================================================
-- Migration 107: Sistema de Permissões Granulares
-- =====================================================
-- Criado em: 2025-11-12
-- Descrição: Adiciona sistema de permissões por usuário
--            para controlar acesso às páginas/funcionalidades
-- =====================================================

-- 1. Criar tabela de permissões
CREATE TABLE IF NOT EXISTS obsidian.permissoes (
  id SERIAL PRIMARY KEY,
  chave TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT,
  icone TEXT,
  rota TEXT,
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Criar tabela associativa usuarios_permissoes
CREATE TABLE IF NOT EXISTS obsidian.usuarios_permissoes (
  id SERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES obsidian.usuarios(id) ON DELETE CASCADE,
  permissao_id INTEGER NOT NULL REFERENCES obsidian.permissoes(id) ON DELETE CASCADE,
  concedida_por UUID REFERENCES obsidian.usuarios(id) ON DELETE SET NULL,
  concedida_em TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_usuario_permissao UNIQUE (usuario_id, permissao_id)
);

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_usuarios_permissoes_usuario ON obsidian.usuarios_permissoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_permissoes_permissao ON obsidian.usuarios_permissoes(permissao_id);
CREATE INDEX IF NOT EXISTS idx_permissoes_chave ON obsidian.permissoes(chave);
CREATE INDEX IF NOT EXISTS idx_permissoes_ativo ON obsidian.permissoes(ativo) WHERE ativo = TRUE;

-- 4. Inserir permissões padrão baseadas nas páginas da navbar
INSERT INTO obsidian.permissoes (chave, nome, descricao, categoria, icone, rota, ordem) VALUES
  -- Dashboard
  ('dashboard.acessar', 'Dashboard', 'Visualizar painel principal com indicadores', 'Geral', 'Factory', '/', 1),
  
  -- Estoque
  ('estoque.visualizar', 'Estoque', 'Visualizar estoque de produtos', 'Estoque', 'Package', '/estoque', 2),
  ('estoque.editar', 'Editar Estoque', 'Adicionar/remover itens do estoque', 'Estoque', NULL, NULL, 3),
  
  -- Vendas
  ('vendas.visualizar', 'Vendas', 'Visualizar vendas realizadas', 'Vendas', 'ShoppingCart', '/vendas', 4),
  ('vendas.criar', 'Criar Vendas', 'Registrar novas vendas', 'Vendas', NULL, NULL, 5),
  
  -- Clientes
  ('clientes.visualizar', 'Clientes', 'Visualizar lista de clientes', 'Clientes', 'Users', '/clientes', 6),
  ('clientes.editar', 'Editar Clientes', 'Criar/editar clientes', 'Clientes', NULL, NULL, 7),
  
  -- Pagamentos
  ('pagamentos.visualizar', 'Pagamentos', 'Visualizar pagamentos recebidos', 'Financeiro', 'Wallet', '/pagamentos', 8),
  ('pagamentos.criar', 'Registrar Pagamentos', 'Registrar novos pagamentos', 'Financeiro', NULL, NULL, 9),
  
  -- Devoluções
  ('devolucoes.visualizar', 'Devoluções', 'Visualizar devoluções de produtos', 'Operações', 'PackageX', '/devolucoes', 10),
  ('devolucoes.processar', 'Processar Devoluções', 'Processar e conferir devoluções', 'Operações', NULL, NULL, 11),
  
  -- Receitas/BOM
  ('receitas.visualizar', 'Receitas de Produto', 'Visualizar receitas e composição', 'Produção', 'Settings', '/receita-produto', 12),
  ('receitas.editar', 'Editar Receitas', 'Criar/editar receitas de produtos', 'Produção', NULL, NULL, 13),
  
  -- Relatórios
  ('relatorios.visualizar', 'Relatórios', 'Visualizar relatórios e análises', 'Análise', 'BarChart2', '/relatorios', 14),
  
  -- Import
  ('import.planilha', 'Importar Planilha', 'Importar dados via planilha', 'Importação', 'Package', '/import-planilha', 15),
  ('import.planilha_full', 'Importar Planilha Full', 'Importar planilha completa com múltiplas abas', 'Importação', 'Package', '/import-planilha-full', 16),
  
  -- Envios
  ('envios.visualizar', 'FULL Envios', 'Visualizar e gerenciar envios', 'Logística', 'Truck', '/full-envios', 17),
  
  -- Admin
  ('logs.visualizar', 'Logs de Atividade', 'Visualizar logs de atividades do sistema', 'Administração', 'Activity', '/activity-logs', 18),
  ('usuarios.gerenciar', 'Gerenciar Usuários', 'Criar/editar usuários', 'Administração', 'Shield', '/usuarios', 19),
  ('permissoes.gerenciar', 'Gerenciar Permissões', 'Conceder/revogar permissões de usuários', 'Administração', 'Shield', '/admin/permissoes', 20)
ON CONFLICT (chave) DO NOTHING;

-- 5. Comentários nas tabelas
COMMENT ON TABLE obsidian.permissoes IS 'Permissões granulares do sistema para controle de acesso';
COMMENT ON TABLE obsidian.usuarios_permissoes IS 'Associação entre usuários e suas permissões concedidas';

COMMENT ON COLUMN obsidian.permissoes.chave IS 'Identificador único da permissão (ex: estoque.visualizar)';
COMMENT ON COLUMN obsidian.permissoes.nome IS 'Nome amigável da permissão';
COMMENT ON COLUMN obsidian.permissoes.rota IS 'Rota frontend associada (se aplicável)';
COMMENT ON COLUMN obsidian.permissoes.ordem IS 'Ordem de exibição na navbar';
COMMENT ON COLUMN obsidian.usuarios_permissoes.concedida_por IS 'Usuário admin que concedeu a permissão';

-- 6. Criar função helper para verificar permissão
CREATE OR REPLACE FUNCTION obsidian.usuario_tem_permissao(
  p_usuario_id UUID,
  p_chave_permissao TEXT
) RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION obsidian.usuario_tem_permissao IS 'Verifica se um usuário possui determinada permissão';

-- 7. Criar view para facilitar consultas
CREATE OR REPLACE VIEW obsidian.v_usuarios_permissoes AS
SELECT 
  u.id AS usuario_id,
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
FROM obsidian.usuarios_permissoes up
JOIN obsidian.usuarios u ON u.id = up.usuario_id
JOIN obsidian.permissoes p ON p.id = up.permissao_id
LEFT JOIN obsidian.usuarios admin ON admin.id = up.concedida_por
WHERE u.ativo = TRUE AND p.ativo = TRUE;

COMMENT ON VIEW obsidian.v_usuarios_permissoes IS 'View com informações completas de usuários e suas permissões';

-- =====================================================
-- FIM DA MIGRATION 107
-- =====================================================
