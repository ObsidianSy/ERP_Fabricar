-- ================================================================
-- MIGRATION 108: Sistema Financeiro Completo
-- ================================================================
-- Cria schema financeiro com gestão de:
-- - Contas bancárias/carteiras
-- - Cartões de crédito
-- - Faturas de cartões
-- - Transações financeiras
-- - Categorias hierárquicas
-- ================================================================

-- Criar schema financeiro (se não existir)
CREATE SCHEMA IF NOT EXISTS financeiro;

-- ================================================================
-- 1. TABELA: financeiro.categoria
-- Categorias hierárquicas de receitas/despesas
-- ================================================================
CREATE TABLE financeiro.categoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES obsidian.usuarios(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('despesa', 'receita', 'transferencia')),
    parent_id UUID REFERENCES financeiro.categoria(id) ON DELETE SET NULL,
    icone VARCHAR(50),  -- Nome do ícone (lucide-react)
    cor VARCHAR(20),    -- Cor hex (#FF5733)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_categoria_tenant_tipo ON financeiro.categoria(tenant_id, tipo);
CREATE INDEX idx_categoria_parent ON financeiro.categoria(parent_id);

-- ================================================================
-- 2. TABELA: financeiro.conta
-- Contas bancárias, carteiras, investimentos
-- ================================================================
CREATE TABLE financeiro.conta (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES obsidian.usuarios(id) ON DELETE CASCADE,
    nome VARCHAR(200) NOT NULL,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('corrente', 'poupanca', 'investimento', 'dinheiro', 'carteira')),
    saldo_inicial DECIMAL(15,2) DEFAULT 0.00,
    saldo_atual DECIMAL(15,2) DEFAULT 0.00,
    banco VARCHAR(100),         -- Nome do banco
    agencia VARCHAR(20),        -- Agência
    conta_numero VARCHAR(30),   -- Número da conta
    ativo BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_conta_tenant_ativo ON financeiro.conta(tenant_id, ativo, is_deleted);
CREATE INDEX idx_conta_tipo ON financeiro.conta(tipo);

-- ================================================================
-- 3. TABELA: financeiro.cartao
-- Cartões de crédito
-- ================================================================
CREATE TABLE financeiro.cartao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES obsidian.usuarios(id) ON DELETE CASCADE,
    apelido VARCHAR(100) NOT NULL,
    bandeira VARCHAR(50),       -- Visa, Mastercard, Elo, etc.
    ultimos_digitos VARCHAR(4), -- Últimos 4 dígitos
    limite DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    dia_fechamento INTEGER NOT NULL CHECK (dia_fechamento BETWEEN 1 AND 31),
    dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
    conta_pagamento_id UUID REFERENCES financeiro.conta(id) ON DELETE SET NULL,
    ativo BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Validação: vencimento deve ser após fechamento
    CONSTRAINT check_dias_cartao CHECK (dia_vencimento > dia_fechamento)
);

-- Índices
CREATE INDEX idx_cartao_tenant_ativo ON financeiro.cartao(tenant_id, ativo, is_deleted);
CREATE INDEX idx_cartao_conta_pagamento ON financeiro.cartao(conta_pagamento_id);

-- ================================================================
-- 4. TABELA: financeiro.fatura
-- Faturas mensais dos cartões
-- ================================================================
CREATE TABLE financeiro.fatura (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cartao_id UUID NOT NULL REFERENCES financeiro.cartao(id) ON DELETE CASCADE,
    competencia DATE NOT NULL,  -- YYYY-MM-01 (primeiro dia do mês)
    data_fechamento DATE NOT NULL,
    data_vencimento DATE NOT NULL,
    valor_total DECIMAL(15,2) DEFAULT 0.00,
    valor_pago DECIMAL(15,2) DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'fechada', 'paga', 'vencida')),
    transacao_pagamento_id UUID,  -- ID da transação de pagamento (quando paga)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint: Uma fatura por cartão por mês
    CONSTRAINT uq_fatura_cartao_competencia UNIQUE(cartao_id, competencia)
);

-- Índices
CREATE INDEX idx_fatura_cartao_competencia ON financeiro.fatura(cartao_id, competencia);
CREATE INDEX idx_fatura_status ON financeiro.fatura(status);
CREATE INDEX idx_fatura_vencimento ON financeiro.fatura(data_vencimento);

-- ================================================================
-- 5. TABELA: financeiro.fatura_item
-- Itens/compras nas faturas
-- ================================================================
CREATE TABLE financeiro.fatura_item (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fatura_id UUID NOT NULL REFERENCES financeiro.fatura(id) ON DELETE CASCADE,
    descricao VARCHAR(255) NOT NULL,
    valor DECIMAL(15,2) NOT NULL,
    data_compra DATE NOT NULL,
    categoria_id UUID REFERENCES financeiro.categoria(id) ON DELETE SET NULL,
    parcela_numero INTEGER,     -- Ex: 1, 2, 3...
    parcela_total INTEGER,      -- Ex: 12 (se parcelado em 12x)
    parcela_group_id UUID,      -- ID único para agrupar parcelas da mesma compra
    observacoes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_fatura_item_fatura ON financeiro.fatura_item(fatura_id, is_deleted);
CREATE INDEX idx_fatura_item_categoria ON financeiro.fatura_item(categoria_id);
CREATE INDEX idx_fatura_item_data ON financeiro.fatura_item(data_compra);
CREATE INDEX idx_fatura_item_parcela_group ON financeiro.fatura_item(parcela_group_id);

-- ================================================================
-- 6. TABELA: financeiro.transacao
-- Todas as transações financeiras
-- ================================================================
CREATE TABLE financeiro.transacao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES obsidian.usuarios(id) ON DELETE CASCADE,
    descricao VARCHAR(255) NOT NULL,
    valor DECIMAL(15,2) NOT NULL,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('credito', 'debito', 'transferencia')),
    data_transacao DATE NOT NULL,
    data_compensacao DATE,      -- Data em que o valor foi compensado
    status VARCHAR(50) NOT NULL DEFAULT 'previsto' CHECK (status IN ('previsto', 'liquidado', 'cancelado')),
    origem VARCHAR(50) DEFAULT 'manual',  -- 'manual', 'fatura', 'recorrencia'
    referencia VARCHAR(255),    -- Ex: ID da fatura paga
    conta_id UUID NOT NULL REFERENCES financeiro.conta(id) ON DELETE CASCADE,
    conta_destino_id UUID REFERENCES financeiro.conta(id) ON DELETE SET NULL,  -- Para transferências
    categoria_id UUID REFERENCES financeiro.categoria(id) ON DELETE SET NULL,
    observacoes TEXT,
    anexo_url TEXT,             -- URL do comprovante/nota fiscal
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_transacao_tenant_data ON financeiro.transacao(tenant_id, data_transacao);
CREATE INDEX idx_transacao_conta_status ON financeiro.transacao(conta_id, status);
CREATE INDEX idx_transacao_tipo ON financeiro.transacao(tipo);
CREATE INDEX idx_transacao_categoria ON financeiro.transacao(categoria_id);
CREATE INDEX idx_transacao_conta_destino ON financeiro.transacao(conta_destino_id);

-- ================================================================
-- TRIGGERS
-- ================================================================

-- Trigger: Atualizar valor_total da fatura ao inserir/atualizar/deletar item
CREATE OR REPLACE FUNCTION financeiro.atualizar_valor_fatura()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalcular valor total da fatura
    UPDATE financeiro.fatura
    SET valor_total = (
        SELECT COALESCE(SUM(valor), 0)
        FROM financeiro.fatura_item
        WHERE fatura_id = COALESCE(NEW.fatura_id, OLD.fatura_id)
          AND is_deleted = false
    ),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = COALESCE(NEW.fatura_id, OLD.fatura_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_atualizar_valor_fatura_insert
AFTER INSERT ON financeiro.fatura_item
FOR EACH ROW EXECUTE FUNCTION financeiro.atualizar_valor_fatura();

CREATE TRIGGER trg_atualizar_valor_fatura_update
AFTER UPDATE ON financeiro.fatura_item
FOR EACH ROW EXECUTE FUNCTION financeiro.atualizar_valor_fatura();

CREATE TRIGGER trg_atualizar_valor_fatura_delete
AFTER DELETE ON financeiro.fatura_item
FOR EACH ROW EXECUTE FUNCTION financeiro.atualizar_valor_fatura();

-- Trigger: Atualizar saldo_atual da conta ao liquidar transação
CREATE OR REPLACE FUNCTION financeiro.atualizar_saldo_conta()
RETURNS TRIGGER AS $$
BEGIN
    -- Se status mudou para 'liquidado'
    IF NEW.status = 'liquidado' AND OLD.status != 'liquidado' THEN
        -- Atualizar saldo da conta origem
        IF NEW.tipo = 'credito' THEN
            UPDATE financeiro.conta
            SET saldo_atual = saldo_atual + NEW.valor,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.conta_id;
        ELSIF NEW.tipo = 'debito' THEN
            UPDATE financeiro.conta
            SET saldo_atual = saldo_atual - NEW.valor,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.conta_id;
        ELSIF NEW.tipo = 'transferencia' AND NEW.conta_destino_id IS NOT NULL THEN
            -- Debita da conta origem
            UPDATE financeiro.conta
            SET saldo_atual = saldo_atual - NEW.valor,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.conta_id;
            
            -- Credita na conta destino
            UPDATE financeiro.conta
            SET saldo_atual = saldo_atual + NEW.valor,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.conta_destino_id;
        END IF;
    END IF;
    
    -- Se status mudou de 'liquidado' para 'cancelado', estornar
    IF NEW.status = 'cancelado' AND OLD.status = 'liquidado' THEN
        IF NEW.tipo = 'credito' THEN
            UPDATE financeiro.conta
            SET saldo_atual = saldo_atual - NEW.valor,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.conta_id;
        ELSIF NEW.tipo = 'debito' THEN
            UPDATE financeiro.conta
            SET saldo_atual = saldo_atual + NEW.valor,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.conta_id;
        ELSIF NEW.tipo = 'transferencia' AND NEW.conta_destino_id IS NOT NULL THEN
            UPDATE financeiro.conta
            SET saldo_atual = saldo_atual + NEW.valor,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.conta_id;
            
            UPDATE financeiro.conta
            SET saldo_atual = saldo_atual - NEW.valor,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.conta_destino_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_atualizar_saldo_conta
AFTER UPDATE ON financeiro.transacao
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION financeiro.atualizar_saldo_conta();

-- Trigger: Atualizar status da fatura para 'vencida' automaticamente
-- (Isso seria melhor em um JOB agendado, mas criamos a função para referência)
CREATE OR REPLACE FUNCTION financeiro.marcar_faturas_vencidas()
RETURNS void AS $$
BEGIN
    UPDATE financeiro.fatura
    SET status = 'vencida',
        updated_at = CURRENT_TIMESTAMP
    WHERE status IN ('aberta', 'fechada')
      AND data_vencimento < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- VIEWS ÚTEIS
-- ================================================================

-- View: Resumo de contas com saldo
CREATE OR REPLACE VIEW financeiro.v_resumo_contas AS
SELECT 
    c.id,
    c.tenant_id,
    c.nome,
    c.tipo,
    c.saldo_inicial,
    c.saldo_atual,
    c.banco,
    c.ativo,
    COUNT(t.id) AS total_transacoes,
    COALESCE(SUM(CASE WHEN t.tipo = 'credito' AND t.status = 'liquidado' THEN t.valor ELSE 0 END), 0) AS total_creditos,
    COALESCE(SUM(CASE WHEN t.tipo = 'debito' AND t.status = 'liquidado' THEN t.valor ELSE 0 END), 0) AS total_debitos
FROM financeiro.conta c
LEFT JOIN financeiro.transacao t ON t.conta_id = c.id
WHERE c.is_deleted = false
GROUP BY c.id, c.tenant_id, c.nome, c.tipo, c.saldo_inicial, c.saldo_atual, c.banco, c.ativo;

-- View: Faturas com resumo de itens
CREATE OR REPLACE VIEW financeiro.v_faturas_resumo AS
SELECT 
    f.id,
    f.cartao_id,
    c.apelido AS cartao_apelido,
    c.tenant_id,
    f.competencia,
    f.data_fechamento,
    f.data_vencimento,
    f.valor_total,
    f.valor_pago,
    f.status,
    COUNT(fi.id) AS total_itens,
    COUNT(fi.id) FILTER (WHERE fi.is_deleted = false) AS itens_ativos
FROM financeiro.fatura f
JOIN financeiro.cartao c ON c.id = f.cartao_id
LEFT JOIN financeiro.fatura_item fi ON fi.fatura_id = f.id
GROUP BY f.id, f.cartao_id, c.apelido, c.tenant_id, f.competencia, f.data_fechamento, f.data_vencimento, f.valor_total, f.valor_pago, f.status;

-- View: Transações com nomes de contas e categorias
CREATE OR REPLACE VIEW financeiro.v_transacoes_detalhadas AS
SELECT 
    t.id,
    t.tenant_id,
    t.descricao,
    t.valor,
    t.tipo,
    t.data_transacao,
    t.data_compensacao,
    t.status,
    t.origem,
    c.nome AS conta_nome,
    c.tipo AS conta_tipo,
    cd.nome AS conta_destino_nome,
    cat.nome AS categoria_nome,
    cat.tipo AS categoria_tipo,
    t.observacoes,
    t.created_at
FROM financeiro.transacao t
JOIN financeiro.conta c ON c.id = t.conta_id
LEFT JOIN financeiro.conta cd ON cd.id = t.conta_destino_id
LEFT JOIN financeiro.categoria cat ON cat.id = t.categoria_id;

-- ================================================================
-- INSERIR CATEGORIAS PADRÃO (globais, tenant_id = NULL)
-- ================================================================

INSERT INTO financeiro.categoria (tenant_id, nome, tipo, icone, cor) VALUES
-- DESPESAS
(NULL, 'Alimentação', 'despesa', 'UtensilsCrossed', '#FF6B6B'),
(NULL, 'Transporte', 'despesa', 'Car', '#4ECDC4'),
(NULL, 'Moradia', 'despesa', 'Home', '#95E1D3'),
(NULL, 'Saúde', 'despesa', 'Heart', '#F38181'),
(NULL, 'Educação', 'despesa', 'GraduationCap', '#AA96DA'),
(NULL, 'Lazer', 'despesa', 'Gamepad2', '#FCBAD3'),
(NULL, 'Vestuário', 'despesa', 'Shirt', '#A8D8EA'),
(NULL, 'Serviços', 'despesa', 'Wrench', '#FFD93D'),
(NULL, 'Impostos', 'despesa', 'FileText', '#6C5CE7'),
(NULL, 'Outros', 'despesa', 'MoreHorizontal', '#95A5A6'),

-- RECEITAS
(NULL, 'Salário', 'receita', 'Wallet', '#00D2D3'),
(NULL, 'Freelance', 'receita', 'Briefcase', '#54A0FF'),
(NULL, 'Investimentos', 'receita', 'TrendingUp', '#48DBFB'),
(NULL, 'Vendas', 'receita', 'ShoppingCart', '#1DD1A1'),
(NULL, 'Prêmios', 'receita', 'Award', '#FFC312'),
(NULL, 'Outros', 'receita', 'Plus', '#C4E538'),

-- TRANSFERÊNCIA
(NULL, 'Transferência entre Contas', 'transferencia', 'ArrowLeftRight', '#A29BFE');

-- ================================================================
-- COMENTÁRIOS NAS TABELAS
-- ================================================================

COMMENT ON SCHEMA financeiro IS 'Schema para gestão financeira completa: contas, cartões, faturas e transações';

COMMENT ON TABLE financeiro.conta IS 'Contas bancárias, carteiras e investimentos';
COMMENT ON TABLE financeiro.categoria IS 'Categorias hierárquicas de receitas e despesas';
COMMENT ON TABLE financeiro.cartao IS 'Cartões de crédito';
COMMENT ON TABLE financeiro.fatura IS 'Faturas mensais dos cartões de crédito';
COMMENT ON TABLE financeiro.fatura_item IS 'Itens/compras nas faturas dos cartões';
COMMENT ON TABLE financeiro.transacao IS 'Registro de todas as transações financeiras';

COMMENT ON COLUMN financeiro.conta.saldo_inicial IS 'Saldo inicial ao criar a conta';
COMMENT ON COLUMN financeiro.conta.saldo_atual IS 'Saldo atual (atualizado automaticamente por transações)';
COMMENT ON COLUMN financeiro.cartao.dia_fechamento IS 'Dia do mês em que a fatura fecha (1-31)';
COMMENT ON COLUMN financeiro.cartao.dia_vencimento IS 'Dia do mês em que a fatura vence (1-31)';
COMMENT ON COLUMN financeiro.fatura.competencia IS 'Mês/ano da fatura no formato YYYY-MM-01';
COMMENT ON COLUMN financeiro.fatura_item.parcela_group_id IS 'ID único para agrupar todas as parcelas de uma mesma compra';
COMMENT ON COLUMN financeiro.transacao.status IS 'previsto: agendado | liquidado: efetivado | cancelado: cancelado';
COMMENT ON COLUMN financeiro.transacao.origem IS 'Origem da transação: manual, fatura, recorrencia';

-- ================================================================
-- FIM DA MIGRATION 108
-- ================================================================

-- Para verificar se foi criado corretamente:
SELECT 
    schemaname, 
    tablename, 
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'financeiro'
ORDER BY tablename;
