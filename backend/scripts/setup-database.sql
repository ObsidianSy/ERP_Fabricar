-- ============================================================================
-- SETUP DO DATABASE ERP_FABRICA
-- Execute este script ANTES da migration principal
-- ============================================================================

-- 1. Criar o database erp_fabrica (se não existir)
SELECT 'CREATE DATABASE erp_fabrica'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'erp_fabrica')\gexec

-- 2. Conectar ao database (no psql use: \c erp_fabrica)

-- Pronto! Agora execute a migration principal:
-- \i backend/migrations/000_initial_complete.sql
