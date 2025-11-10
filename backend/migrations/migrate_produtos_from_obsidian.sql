-- Migração: Copiar dados da tabela produtos do banco obsidian para erp_fabrica
-- Execute este script conectado no banco erp_fabrica

-- 1. Criar a extensão postgres_fdw se não existir
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- 2. Criar o servidor remoto para o banco obsidian
-- (Se já existir, pode ignorar o erro)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_foreign_server WHERE srvname = 'obsidian_server'
    ) THEN
        CREATE SERVER obsidian_server 
        FOREIGN DATA WRAPPER postgres_fdw 
        OPTIONS (host 'localhost', port '5432', dbname 'obsidian');
    END IF;
END $$;

-- 3. Criar o mapeamento de usuário
-- Substitua 'postgres' pelo seu usuário e senha do banco obsidian
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_user_mappings 
        WHERE srvname = 'obsidian_server' 
        AND usename = CURRENT_USER
    ) THEN
        CREATE USER MAPPING FOR CURRENT_USER 
        SERVER obsidian_server 
        OPTIONS (user 'postgres', password 'sua_senha_aqui');
    END IF;
END $$;

-- 4. Criar tabela foreign temporária para acessar os produtos do obsidian
DROP FOREIGN TABLE IF EXISTS obsidian_produtos_remote CASCADE;

CREATE FOREIGN TABLE obsidian_produtos_remote (
  id INTEGER,
  sku TEXT,
  nome TEXT,
  categoria TEXT,
  tipo_produto TEXT,
  tipo_estoque TEXT,
  quantidade_atual NUMERIC,
  unidade_medida TEXT,
  preco_unitario NUMERIC,
  tempo_producao_minutos INTEGER,
  lote_minimo NUMERIC,
  ponto_reposicao NUMERIC,
  ativo BOOLEAN,
  criado_em TIMESTAMP WITH TIME ZONE,
  atualizado_em TIMESTAMP WITH TIME ZONE,
  kit_bom JSONB,
  is_kit BOOLEAN,
  kit_bom_hash TEXT
)
SERVER obsidian_server
OPTIONS (schema_name 'obsidian', table_name 'produtos');

-- 5. Copiar os dados (INSERT com ON CONFLICT para evitar duplicatas)
INSERT INTO obsidian.produtos (
  sku,
  nome,
  categoria,
  tipo_produto,
  tipo_estoque,
  quantidade_atual,
  unidade_medida,
  preco_unitario,
  tempo_producao_minutos,
  lote_minimo,
  ponto_reposicao,
  ativo,
  criado_em,
  atualizado_em,
  kit_bom,
  is_kit,
  kit_bom_hash
)
SELECT 
  sku,
  nome,
  categoria,
  tipo_produto,
  tipo_estoque,
  quantidade_atual,
  unidade_medida,
  preco_unitario,
  tempo_producao_minutos,
  lote_minimo,
  ponto_reposicao,
  ativo,
  criado_em,
  atualizado_em,
  kit_bom,
  is_kit,
  kit_bom_hash
FROM obsidian_produtos_remote
ON CONFLICT (sku) DO UPDATE SET
  nome = EXCLUDED.nome,
  categoria = EXCLUDED.categoria,
  tipo_produto = EXCLUDED.tipo_produto,
  tipo_estoque = EXCLUDED.tipo_estoque,
  quantidade_atual = EXCLUDED.quantidade_atual,
  unidade_medida = EXCLUDED.unidade_medida,
  preco_unitario = EXCLUDED.preco_unitario,
  tempo_producao_minutos = EXCLUDED.tempo_producao_minutos,
  lote_minimo = EXCLUDED.lote_minimo,
  ponto_reposicao = EXCLUDED.ponto_reposicao,
  ativo = EXCLUDED.ativo,
  atualizado_em = now();

-- 6. Mostrar quantos produtos foram copiados
SELECT COUNT(*) as total_produtos_copiados FROM obsidian.produtos;

-- 7. Limpar tabela temporária
DROP FOREIGN TABLE IF EXISTS obsidian_produtos_remote;

-- Opcional: Remover o servidor e mapeamento se não precisar mais
-- DROP USER MAPPING IF EXISTS FOR CURRENT_USER SERVER obsidian_server;
-- DROP SERVER IF EXISTS obsidian_server CASCADE;
