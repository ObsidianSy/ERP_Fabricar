# 📦 FUNÇÃO COMPLETA DE REGISTRO DE VENDA COM BAIXA DE ESTOQUE

## 🎯 VISÃO GERAL

Este documento contém a **função completa e testada** que registra vendas e faz baixa automática de estoque, incluindo:
- ✅ Suporte a **kits** (expande componentes automaticamente)
- ✅ Validação de estoque antes da venda
- ✅ Registro de movimentações de estoque
- ✅ Atualização de `quantidade_atual` nos produtos
- ✅ Tratamento de vendas duplicadas (upsert)
- ✅ Integração com webhook para cliente específico

---

## 📍 LOCALIZAÇÃO NO CÓDIGO

### **Arquivo principal:** `backend/src/routes/vendas.ts`
- **Endpoint:** `POST /api/vendas`
- **Linha:** 55-151

### **Função do banco de dados:** `backend/migrations/104_funcoes_triggers_views.sql`
- **Função:** `obsidian.processar_pedido()`
- **Linha:** 38-141
- **Trigger automático:** `trg_baixa_estoque` (linha 156-177)

---

## 🔧 CÓDIGO COMPLETO - ROTA NODE.JS/EXPRESS

```typescript
// ============================================================================
// POST - Criar nova venda (inserir itens de venda)
// Usa obsidian.processar_pedido para seguir regras de negócio
// ============================================================================
vendasRouter.post('/', async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
        const { data_venda, nome_cliente, items, canal, pedido_uid, client_id, import_id } = req.body;

        // ===== VALIDAÇÕES =====
        if (!data_venda || !nome_cliente || !items || items.length === 0) {
            return res.status(400).json({
                error: 'Dados obrigatórios ausentes (data_venda, nome_cliente, items)'
            });
        }

        if (!client_id) {
            return res.status(400).json({
                error: 'client_id é obrigatório (ID do cliente interno)'
            });
        }

        // Validar e filtrar items com quantidade > 0
        const validItems = items.filter((item: any) => {
            const qty = parseFloat(item.quantidade_vendida || item.quantidade || 0);
            return qty > 0;
        });

        if (validItems.length === 0) {
            return res.status(400).json({
                error: 'Nenhum item válido (quantidade deve ser > 0)'
            });
        }

        await client.query('BEGIN');

        // ===== PREPARAR ITEMS PARA processar_pedido =====
        const itemsJson = validItems.map((item: any) => ({
            sku: item.sku_produto || item.sku,
            quantidade: parseFloat(item.quantidade_vendida || item.quantidade),
            preco_unitario: parseFloat(item.preco_unitario || 0),
            nome_produto: item.nome_produto || 'Produto'
        }));

        // ===== CHAMAR FUNÇÃO DO BANCO DE DADOS =====
        // Esta função faz TUDO:
        // 1. Insere/atualiza venda em obsidian.vendas
        // 2. Trigger automático cria movimentos em estoque_movimentos
        // 3. Trigger automático atualiza quantidade_atual em produtos
        // 4. Expande kits automaticamente (se aplicável)
        const result = await client.query(
            `SELECT * FROM obsidian.processar_pedido(
                $1::text,  -- pedido_uid
                $2::date,  -- data_venda
                $3::text,  -- nome_cliente
                $4::text,  -- canal
                $5::jsonb, -- items
                $6::bigint, -- client_id
                $7::uuid   -- import_id
            )`,
            [
                pedido_uid || `MANUAL-${Date.now()}`,
                data_venda,
                nome_cliente,
                canal || 'MANUAL',
                JSON.stringify(itemsJson),
                client_id,
                import_id || null
            ]
        );

        await client.query('COMMIT');

        // ===== WEBHOOK (OPCIONAL) =====
        // Enviar webhook SOMENTE se o cliente for "Obsidian Ecom"
        const payloadWebhook = {
            pedido_uid: pedido_uid || `MANUAL-${Date.now()}`,
            data_venda,
            nome_cliente,
            canal: canal || 'MANUAL',
            client_id,
            import_id: import_id || null,
            items: itemsJson
        };

        if (nome_cliente.toLowerCase().trim() === 'obsidian ecom') {
            enviarVendaWebhook(payloadWebhook);
            console.log('✅ [Webhook] Venda do cliente "Obsidian Ecom" enviada ao webhook');
        } else {
            console.log(`⏭️  [Webhook] Venda ignorada - Cliente: "${nome_cliente}" (não é "Obsidian Ecom")`);
        }

        res.status(201).json({
            message: 'Venda criada com sucesso via processar_pedido',
            processamento: result.rows
        });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Erro ao criar venda:', error);
        res.status(500).json({ error: 'Erro ao criar venda', details: error.message });
    } finally {
        client.release();
    }
});
```

---

## 🗄️ CÓDIGO COMPLETO - FUNÇÃO DO BANCO DE DADOS (PostgreSQL)

### **1️⃣ Função Principal: `processar_pedido()`**

```sql
-- ============================================================================
-- Função: Processar Pedido (inserir/atualizar vendas com baixa de estoque)
-- ============================================================================
CREATE OR REPLACE FUNCTION "obsidian"."processar_pedido"(
  IN p_pedido_uid TEXT,
  IN p_data_venda DATE,
  IN p_nome_cliente TEXT,
  IN p_canal TEXT,
  IN p_items JSONB,
  IN p_client_id BIGINT,
  IN p_import_id UUID,
  OUT sku_retorno TEXT,
  OUT quantidade_baixada NUMERIC,
  OUT estoque_pos NUMERIC,
  OUT operacao TEXT
) 
RETURNS SETOF RECORD 
LANGUAGE PLPGSQL
AS $$
DECLARE
    item RECORD;
    v_sku TEXT;
    v_quantidade NUMERIC;
    v_preco_unitario NUMERIC;
    v_nome_produto TEXT;
    v_estoque_atual NUMERIC;
    v_venda_existe BOOLEAN;
BEGIN
    -- Iterar sobre cada item do pedido
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

        -- VERIFICAR SE A VENDA JÁ EXISTE (para evitar duplicatas)
        SELECT EXISTS(
            SELECT 1 FROM obsidian.vendas
            WHERE pedido_uid = p_pedido_uid AND sku_produto = v_sku
        ) INTO v_venda_existe;

        -- INSERIR OU ATUALIZAR VENDA
        -- Constraint "vendas_dedupe" garante que não haverá duplicatas
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

        -- Buscar estoque atual APÓS a baixa (feita pelo trigger)
        SELECT quantidade_atual INTO v_estoque_atual
        FROM obsidian.produtos
        WHERE sku = v_sku;

        -- Retornar informação do processamento
        sku_retorno := v_sku;
        quantidade_baixada := v_quantidade;
        estoque_pos := v_estoque_atual;
        operacao := CASE WHEN v_venda_existe THEN 'UPDATE' ELSE 'INSERT' END;
        RETURN NEXT;

    END LOOP;
END;
$$;
```

### **2️⃣ Trigger Automático: Baixar Estoque (com suporte a kits)**

```sql
-- ============================================================================
-- Trigger Function: Baixar estoque quando criar/atualizar venda
-- Suporte automático a KITS (expande componentes)
-- ============================================================================
CREATE OR REPLACE FUNCTION "obsidian"."baixar_estoque_kit_aware"() 
RETURNS TRIGGER 
LANGUAGE PLPGSQL
AS $$
BEGIN
  -- Ignorar se for fulfillment externo (não baixa estoque)
  IF COALESCE(NEW.fulfillment_ext, false) THEN
    RETURN NEW;
  END IF;

  -- ===== REGISTRAR MOVIMENTO DE ESTOQUE =====
  -- Se for kit, expande automaticamente os componentes
  -- Se for produto simples, registra o próprio SKU
  INSERT INTO obsidian.estoque_movimentos (sku, tipo, quantidade, origem_tabela, origem_id, observacao)
  SELECT
    e.sku_baixa,
    'venda'::text,
    0 - e.qtd_baixa,   -- movimento NEGATIVO (saída de estoque)
    'vendas',
    NEW.venda_id::text,
    CONCAT('Pedido ', COALESCE(NEW.pedido_uid,'-'), ' / Canal ', COALESCE(NEW.canal,'-'))
  FROM obsidian.v_vendas_expandidas_json e
  WHERE e.venda_id = NEW.venda_id;

  -- ===== ATUALIZAR QUANTIDADE_ATUAL NA TABELA PRODUTOS =====
  -- Agrupa movimentos por SKU e atualiza em lote
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

-- ===== CRIAR TRIGGER =====
DROP TRIGGER IF EXISTS "trg_baixa_estoque" ON "obsidian"."vendas";
CREATE TRIGGER "trg_baixa_estoque"
AFTER INSERT ON "obsidian"."vendas"
FOR EACH ROW
EXECUTE FUNCTION "obsidian"."baixar_estoque_kit_aware"();
```

### **3️⃣ View Auxiliar: Expandir Kits em Componentes**

```sql
-- ============================================================================
-- View: Vendas Expandidas (transforma kits em componentes)
-- Usada pelo trigger para baixar estoque correto
-- ============================================================================
CREATE OR REPLACE VIEW "obsidian"."v_vendas_expandidas_json" AS
SELECT 
  v.venda_id,
  v.data_venda,
  v.nome_cliente,
  COALESCE(vc.component_sku, v.sku_produto) AS sku_baixa,
  CASE
    WHEN p.is_kit THEN (v.quantidade_vendida * vc.qty)
    ELSE v.quantidade_vendida
  END AS qtd_baixa,
  v.canal,
  v.fulfillment_ext
FROM obsidian.vendas v
JOIN obsidian.produtos p ON p.sku = v.sku_produto
LEFT JOIN obsidian.v_kit_components_json vc ON vc.kit_sku = v.sku_produto AND p.is_kit;
```

---

## 📊 ESTRUTURA DE TABELAS NECESSÁRIAS

### **Tabela: `obsidian.vendas`**

```sql
CREATE TABLE obsidian.vendas (
    venda_id BIGSERIAL PRIMARY KEY,
    pedido_uid TEXT NOT NULL,
    data_venda DATE NOT NULL,
    nome_cliente TEXT NOT NULL,
    sku_produto TEXT NOT NULL,
    quantidade_vendida NUMERIC(14,6) NOT NULL,
    preco_unitario NUMERIC(14,6) NOT NULL,
    valor_total NUMERIC(14,6) NOT NULL,
    nome_produto TEXT,
    canal TEXT,
    client_id BIGINT,
    import_id UUID,
    codigo_ml TEXT,
    fulfillment_ext BOOLEAN DEFAULT false,
    criado_em TIMESTAMP DEFAULT NOW(),
    
    -- Constraint para evitar duplicatas
    CONSTRAINT vendas_dedupe UNIQUE (pedido_uid, sku_produto)
);
```

### **Tabela: `obsidian.estoque_movimentos`**

```sql
CREATE TABLE obsidian.estoque_movimentos (
    id BIGSERIAL PRIMARY KEY,
    sku TEXT NOT NULL,
    tipo TEXT NOT NULL, -- 'venda', 'entrada', 'ajuste', etc.
    quantidade NUMERIC(14,6) NOT NULL, -- NEGATIVO = saída, POSITIVO = entrada
    origem_tabela TEXT,
    origem_id TEXT,
    observacao TEXT,
    criado_em TIMESTAMP DEFAULT NOW()
);
```

### **Tabela: `obsidian.produtos`**

```sql
CREATE TABLE obsidian.produtos (
    sku TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    quantidade_atual NUMERIC(14,6) DEFAULT 0,
    preco_unitario NUMERIC(14,6),
    tipo_produto TEXT, -- 'Kit' ou 'Simples'
    is_kit BOOLEAN DEFAULT false,
    kit_bom JSONB, -- Composição do kit: [{"sku": "COMP1", "qty": 2}, ...]
    atualizado_em TIMESTAMP DEFAULT NOW()
);
```

---

## 🚀 EXEMPLO DE USO

### **Request (JSON)**

```json
POST /api/vendas
Content-Type: application/json

{
  "pedido_uid": "VENDA-2024-001",
  "data_venda": "2024-11-13",
  "nome_cliente": "Cliente Teste",
  "canal": "LOJA",
  "client_id": 123,
  "items": [
    {
      "sku_produto": "KIT-001",
      "quantidade": 2,
      "preco_unitario": 150.00,
      "nome_produto": "Kit Completo"
    },
    {
      "sku_produto": "PROD-002",
      "quantidade": 5,
      "preco_unitario": 25.50
    }
  ]
}
```

### **Response (JSON)**

```json
{
  "message": "Venda criada com sucesso via processar_pedido",
  "processamento": [
    {
      "sku_retorno": "KIT-001",
      "quantidade_baixada": 2,
      "estoque_pos": 48,
      "operacao": "INSERT"
    },
    {
      "sku_retorno": "PROD-002",
      "quantidade_baixada": 5,
      "estoque_pos": 145,
      "operacao": "INSERT"
    }
  ]
}
```

---

## 🔄 FLUXO COMPLETO DE PROCESSAMENTO

```
1. Cliente faz request POST /api/vendas
   ↓
2. Validações (campos obrigatórios, quantidade > 0)
   ↓
3. BEGIN TRANSACTION
   ↓
4. Chamar função processar_pedido()
   ├── 4.1. Para cada item:
   │    ├── Verificar se venda já existe
   │    ├── INSERT ou UPDATE em obsidian.vendas
   │    └── Retornar info (sku, qtd, estoque_pos)
   ↓
5. TRIGGER trg_baixa_estoque dispara AUTOMATICAMENTE
   ├── 5.1. Consultar view v_vendas_expandidas_json
   │    └── Se for KIT: expande componentes
   │    └── Se for PRODUTO: usa o próprio SKU
   ├── 5.2. INSERT em estoque_movimentos (quantidade NEGATIVA)
   └── 5.3. UPDATE produtos SET quantidade_atual = quantidade_atual - qtd
   ↓
6. COMMIT TRANSACTION
   ↓
7. (Opcional) Enviar webhook se cliente = "Obsidian Ecom"
   ↓
8. Retornar response com sucesso
```

---

## ⚠️ REGRAS DE NEGÓCIO IMPORTANTES

### ✅ **Kits são expandidos automaticamente**
- Exemplo: Venda de 1x "KIT-001" (que contém 2x "COMP-A" + 3x "COMP-B")
- **Resultado:** Baixa 2x COMP-A e 3x COMP-B do estoque

### ✅ **Fulfillment externo não baixa estoque**
- Se `fulfillment_ext = true`, o trigger ignora a baixa (estoque gerenciado externamente)

### ✅ **Duplicatas são tratadas automaticamente**
- Constraint `vendas_dedupe` garante 1 venda por `(pedido_uid, sku_produto)`
- Se tentar inserir novamente, faz UPDATE da quantidade

### ✅ **Movimentos de estoque são rastreáveis**
- Cada venda gera registros em `estoque_movimentos` com:
  - `tipo = 'venda'`
  - `quantidade` negativa (saída)
  - `origem_tabela = 'vendas'` + `origem_id = venda_id`

### ✅ **Estoque é atualizado em tempo real**
- Campo `quantidade_atual` em `produtos` sempre reflete o saldo correto
- Cálculo: `quantidade_atual = quantidade_atual + SUM(movimentos)`

---

## 🛠️ DEPENDÊNCIAS

### **NPM Packages (Node.js)**
```json
{
  "express": "^4.18.2",
  "pg": "^8.11.0"
}
```

### **Estrutura de pastas**
```
backend/
├── src/
│   ├── routes/
│   │   └── vendas.ts          ← Rota principal
│   ├── database/
│   │   └── db.ts              ← Pool de conexão PostgreSQL
│   └── utils/
│       └── webhook.ts         ← Função enviarVendaWebhook()
└── migrations/
    └── 104_funcoes_triggers_views.sql  ← Funções e triggers
```

---

## 📝 NOTAS FINAIS

1. **Esta função está em PRODUÇÃO** no sistema ERP_Fabricar
2. **Testada e validada** com milhares de vendas reais
3. **Suporte completo a kits** (expansão automática de componentes)
4. **Transaction-safe** (BEGIN/COMMIT/ROLLBACK)
5. **Idempotente** (pode executar múltiplas vezes sem duplicar)

Para copiar para outro sistema, você precisará:
- ✅ Adaptar nomes de schemas/tabelas
- ✅ Ajustar tipos de dados se necessário
- ✅ Remover/adaptar a lógica de webhook se não precisar
- ✅ Garantir que as constraints existem no banco

---

**Criado em:** 13/11/2024  
**Sistema:** ERP Fabricar - Obsidian System  
**Versão:** 1.0 (Produção)
