# 📋 PLANO DE MIGRAÇÃO: E-COMMERCE → FÁBRICA

## 🎯 Objetivo
Transformar o ERP atual (focado em e-commerce/vendas) em um ERP para gestão de fábrica, mantendo a base sólida existente e adicionando funcionalidades específicas de produção.

---

## 📊 FASE 1: ANÁLISE COMPARATIVA

### E-COMMERCE (Atual) vs FÁBRICA (Destino)

| Aspecto | E-Commerce | Fábrica |
|---------|-----------|---------|
| **Origem de Movimento** | Vendas em Marketplaces | Ordens de Produção |
| **Controle de Estoque** | Produtos acabados | Matéria-Prima + Em Processo + Acabados |
| **Financeiro** | Vendas e Pagamentos | Custos de Produção + Vendas |
| **Clientes Internos** | Empresas do grupo vendendo | Setores/Linhas de Produção |
| **Kits** | Combo de produtos para venda | Receitas de Produção (BOM) |
| **Importação** | Planilhas UpSeller (vendas) | Ordens de Produção + Requisições |
| **Fulfillment** | Envio por terceiros | Terceirização de etapas |
| **Devoluções** | Produtos cancelados | Refugos/Perdas na produção |

---

## 🔄 FASE 2: MÓDULOS A REAPROVEITAR

### ✅ Podem ser Reaproveitados (com adaptações)

1. **`obsidian.produtos`**
   - ✅ Mantém estrutura base (sku, nome, categoria, quantidade_atual)
   - ➕ Adicionar: `tipo_estoque` (materia_prima, em_processo, acabado)
   - ➕ Adicionar: `tempo_producao_minutos`, `processo_producao`
   
2. **`obsidian.estoque_movimentos`**
   - ✅ Mantém (já registra entrada/saída)
   - ➕ Novos tipos: `producao`, `consumo_mp`, `perda`, `ajuste_producao`
   
3. **`obsidian.kit_components` e `receita_produto`**
   - ✅ **PERFEITO para BOM (Bill of Materials)**
   - Renomear conceito: Kit → Receita de Produção
   
4. **`obsidian.clientes`**
   - ✅ Pode virar `setores` ou `linhas_producao`
   - Ou manter como `clientes` se a fábrica vender para clientes externos
   
5. **`obsidian.pagamentos`**
   - ✅ Manter para controle financeiro
   - ➕ Adicionar: custos de produção, gastos com matéria-prima
   
6. **`obsidian.activity_logs`**
   - ✅ Essencial para auditoria
   
7. **`obsidian.usuarios` e `roles`**
   - ✅ Manter (operadores de produção, supervisores, etc)

### ❌ Precisam ser Removidos ou Adaptados

1. **`raw_export_orders`** (específico de UpSeller)
   - ❌ Remover ou adaptar para importação de ordens de produção
   
2. **`logistica.full_envio`** (fulfillment externo)
   - ❌ Remover ou adaptar para logística de insumos
   
3. **`public.devolucoes`** (devoluções de venda)
   - 🔄 Adaptar para **refugos** e **retrabalho**

---

## 🆕 FASE 3: NOVOS MÓDULOS NECESSÁRIOS

### 1. **Ordens de Produção**

```sql
CREATE TABLE "obsidian"."ordens_producao" (
  "id" SERIAL PRIMARY KEY,
  "numero_op" TEXT NOT NULL UNIQUE,
  "sku_produto" TEXT NOT NULL, -- Produto a ser fabricado
  "quantidade_planejada" NUMERIC NOT NULL,
  "quantidade_produzida" NUMERIC DEFAULT 0,
  "quantidade_refugo" NUMERIC DEFAULT 0,
  "data_abertura" DATE NOT NULL DEFAULT CURRENT_DATE,
  "data_inicio" TIMESTAMP,
  "data_conclusao" TIMESTAMP,
  "prioridade" TEXT DEFAULT 'normal', -- baixa, normal, alta, urgente
  "status" TEXT DEFAULT 'aguardando', -- aguardando, em_producao, pausada, concluida, cancelada
  "setor_id" INTEGER, -- FK para clientes (setores)
  "observacoes" TEXT,
  "criado_por" UUID,
  "criado_em" TIMESTAMP DEFAULT now(),
  "atualizado_em" TIMESTAMP DEFAULT now(),
  CONSTRAINT "fk_op_produto" FOREIGN KEY ("sku_produto") REFERENCES "obsidian"."produtos"("sku"),
  CONSTRAINT "fk_op_setor" FOREIGN KEY ("setor_id") REFERENCES "obsidian"."clientes"("id")
);
```

### 2. **Apontamentos de Produção**

```sql
CREATE TABLE "obsidian"."apontamentos_producao" (
  "id" SERIAL PRIMARY KEY,
  "op_id" INTEGER NOT NULL,
  "data_apontamento" TIMESTAMP DEFAULT now(),
  "quantidade_produzida" NUMERIC NOT NULL,
  "quantidade_refugo" NUMERIC DEFAULT 0,
  "motivo_refugo" TEXT,
  "operador_id" UUID,
  "observacoes" TEXT,
  "criado_em" TIMESTAMP DEFAULT now(),
  CONSTRAINT "fk_apontamento_op" FOREIGN KEY ("op_id") REFERENCES "obsidian"."ordens_producao"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_apontamento_operador" FOREIGN KEY ("operador_id") REFERENCES "obsidian"."usuarios"("id")
);
```

### 3. **Consumo de Matéria-Prima por OP**

```sql
CREATE TABLE "obsidian"."consumo_mp_op" (
  "id" SERIAL PRIMARY KEY,
  "op_id" INTEGER NOT NULL,
  "sku_mp" TEXT NOT NULL,
  "quantidade_planejada" NUMERIC NOT NULL,
  "quantidade_consumida" NUMERIC DEFAULT 0,
  "criado_em" TIMESTAMP DEFAULT now(),
  CONSTRAINT "fk_consumo_op" FOREIGN KEY ("op_id") REFERENCES "obsidian"."ordens_producao"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_consumo_mp" FOREIGN KEY ("sku_mp") REFERENCES "obsidian"."materia_prima"("sku_mp")
);
```

### 4. **Refugos e Retrabalho**

```sql
CREATE TABLE "obsidian"."refugos" (
  "id" SERIAL PRIMARY KEY,
  "op_id" INTEGER,
  "apontamento_id" INTEGER,
  "sku_produto" TEXT NOT NULL,
  "quantidade" NUMERIC NOT NULL,
  "tipo_problema" TEXT NOT NULL, -- refugo, retrabalho
  "motivo" TEXT,
  "pode_retrabalhar" BOOLEAN DEFAULT false,
  "data_registro" TIMESTAMP DEFAULT now(),
  "registrado_por" UUID,
  CONSTRAINT "fk_refugo_op" FOREIGN KEY ("op_id") REFERENCES "obsidian"."ordens_producao"("id"),
  CONSTRAINT "fk_refugo_apontamento" FOREIGN KEY ("apontamento_id") REFERENCES "obsidian"."apontamentos_producao"("id"),
  CONSTRAINT "fk_refugo_usuario" FOREIGN KEY ("registrado_por") REFERENCES "obsidian"."usuarios"("id")
);
```

### 5. **Eficiência e KPIs de Produção**

```sql
CREATE TABLE "obsidian"."kpis_producao" (
  "id" SERIAL PRIMARY KEY,
  "data" DATE NOT NULL,
  "setor_id" INTEGER,
  "op_id" INTEGER,
  "quantidade_planejada" NUMERIC,
  "quantidade_produzida" NUMERIC,
  "quantidade_refugo" NUMERIC,
  "tempo_producao_minutos" INTEGER,
  "eficiencia_percentual" NUMERIC, -- (produzida / planejada) * 100
  "taxa_refugo_percentual" NUMERIC, -- (refugo / produzida) * 100
  "criado_em" TIMESTAMP DEFAULT now(),
  CONSTRAINT "fk_kpi_setor" FOREIGN KEY ("setor_id") REFERENCES "obsidian"."clientes"("id"),
  CONSTRAINT "fk_kpi_op" FOREIGN KEY ("op_id") REFERENCES "obsidian"."ordens_producao"("id")
);
```

---

## 🔧 FASE 4: ADAPTAÇÕES DE TABELAS EXISTENTES

### 4.1. Tabela `produtos`
```sql
-- Adicionar novos campos para produção
ALTER TABLE "obsidian"."produtos" ADD COLUMN "tipo_estoque" TEXT DEFAULT 'acabado'; -- materia_prima, em_processo, acabado
ALTER TABLE "obsidian"."produtos" ADD COLUMN "tempo_producao_minutos" INTEGER DEFAULT 0;
ALTER TABLE "obsidian"."produtos" ADD COLUMN "lote_minimo" NUMERIC DEFAULT 1;
ALTER TABLE "obsidian"."produtos" ADD COLUMN "ponto_reposicao" NUMERIC DEFAULT 0;
```

### 4.2. Tabela `clientes` → pode virar `setores`
```sql
-- Adicionar campo para identificar se é setor ou cliente externo
ALTER TABLE "obsidian"."clientes" ADD COLUMN "tipo" TEXT DEFAULT 'externo'; -- interno_setor, externo
ALTER TABLE "obsidian"."clientes" ADD COLUMN "codigo_setor" TEXT;
```

### 4.3. Tabela `vendas` → adaptar para saídas de produção
```sql
-- Adicionar origem da saída
ALTER TABLE "obsidian"."vendas" ADD COLUMN "origem" TEXT DEFAULT 'venda'; -- venda, consumo_producao, transferencia
ALTER TABLE "obsidian"."vendas" ADD COLUMN "op_id" INTEGER;
ALTER TABLE "obsidian"."vendas" ADD CONSTRAINT "fk_venda_op" FOREIGN KEY ("op_id") REFERENCES "obsidian"."ordens_producao"("id");
```

### 4.4. Tabela `estoque_movimentos` → novos tipos
```sql
-- Tipos já suportados: venda, ajuste, entrada
-- Adicionar comentário com novos tipos permitidos:
COMMENT ON COLUMN "obsidian"."estoque_movimentos"."tipo" IS 
'Tipos: venda, ajuste, entrada, producao, consumo_mp, perda, refugo, transferencia';
```

---

## 📝 FASE 5: REGRAS DE NEGÓCIO PARA FÁBRICA

### 5.1. Criação de Ordem de Produção (OP)

1. ✅ Gera uma OP com status `aguardando`
2. ✅ Calcula matéria-prima necessária (baseado em `receita_produto`)
3. ✅ Verifica disponibilidade de matéria-prima
4. ✅ Se tudo ok → status `pronto_para_iniciar`
5. ❌ Se faltar MP → status `aguardando_mp` (bloqueia produção)

### 5.2. Início de Produção

1. ✅ OP muda para status `em_producao`
2. ✅ Registra timestamp `data_inicio`
3. ✅ **BAIXA matéria-prima do estoque** (movimento: `consumo_mp`)
4. ✅ Registra em `consumo_mp_op`

### 5.3. Apontamento de Produção

1. ✅ Registra quantidade produzida em `apontamentos_producao`
2. ✅ Atualiza `quantidade_produzida` na OP
3. ✅ **ADICIONA produto acabado ao estoque** (movimento: `producao`)
4. ✅ Se houver refugo → registra em `refugos` e decrementa estoque

### 5.4. Conclusão de OP

1. ✅ Se `quantidade_produzida >= quantidade_planejada` → status `concluida`
2. ✅ Registra `data_conclusao`
3. ✅ Calcula KPIs (eficiência, tempo, refugo)
4. ✅ Registra em `kpis_producao`

### 5.5. Cancelamento de OP

1. ✅ Status → `cancelada`
2. ✅ **ESTORNA matéria-prima consumida** (movimento: `ajuste`)
3. ✅ Remove produto em processo (se houver)

---

## 🚀 FASE 6: IMPLEMENTAÇÃO BACKEND

### 6.1. Novos Endpoints API

```
POST   /api/ordens-producao          # Criar OP
GET    /api/ordens-producao          # Listar OPs
GET    /api/ordens-producao/:id      # Detalhe OP
PATCH  /api/ordens-producao/:id      # Atualizar status
DELETE /api/ordens-producao/:id      # Cancelar OP

POST   /api/apontamentos             # Registrar produção
GET    /api/apontamentos             # Listar apontamentos
GET    /api/apontamentos/op/:op_id   # Apontamentos por OP

POST   /api/refugos                  # Registrar refugo
GET    /api/refugos                  # Listar refugos

GET    /api/kpis/producao            # KPIs de produção
GET    /api/kpis/eficiencia          # Eficiência por setor
GET    /api/kpis/refugo              # Taxa de refugo
```

### 6.2. Novos Serviços

```typescript
// backend/src/services/OrdemProducaoService.ts
// backend/src/services/ApontamentoService.ts
// backend/src/services/RefugoService.ts
// backend/src/services/KPIService.ts
```

---

## 🎨 FASE 7: IMPLEMENTAÇÃO FRONTEND

### 7.1. Novas Páginas

```
/producao/ordens              # Lista de OPs
/producao/ordens/nova         # Criar OP
/producao/ordens/:id          # Detalhe OP
/producao/apontamento         # Apontamento rápido
/producao/refugos             # Gestão de refugos
/producao/dashboard           # Dashboard de produção
/producao/kpis                # KPIs e relatórios
```

### 7.2. Componentes Novos

```tsx
// src/components/producao/OrdemProducaoCard.tsx
// src/components/producao/ApontamentoForm.tsx
// src/components/producao/RefugoModal.tsx
// src/components/producao/KPIChart.tsx
// src/components/producao/EstoqueMateriaPrima.tsx
```

---

## 🗂️ FASE 8: MIGRATIONS SQL

### Criar arquivo de migração consolidado:

```
backend/migrations/100_migracao_fabrica.sql
```

Conteúdo:
- Criar tabelas novas
- Alterar tabelas existentes
- Criar views para relatórios
- Criar functions/procedures para lógica de negócio

---

## ✅ FASE 9: CHECKLIST DE MIGRAÇÃO

### 9.1. Preparação
- [ ] Backup completo do banco de dados atual
- [ ] Documentar todas as dependências
- [ ] Criar branch `feat/migracao-fabrica`

### 9.2. Banco de Dados
- [ ] Criar novas tabelas (ordens_producao, apontamentos, refugos, kpis)
- [ ] Alterar tabelas existentes (adicionar campos)
- [ ] Criar triggers para baixa automática de MP
- [ ] Criar views para relatórios
- [ ] Testar migrations em ambiente dev

### 9.3. Backend
- [ ] Criar serviços de Ordem de Produção
- [ ] Criar serviços de Apontamento
- [ ] Criar serviços de Refugo
- [ ] Criar endpoints REST
- [ ] Adicionar validações de negócio
- [ ] Testes unitários

### 9.4. Frontend
- [ ] Criar páginas de produção
- [ ] Criar componentes de OP
- [ ] Criar componentes de apontamento
- [ ] Dashboard de produção
- [ ] Integrar com API

### 9.5. Testes
- [ ] Testar fluxo completo: OP → Consumo MP → Apontamento → Estoque
- [ ] Testar cancelamento e estorno
- [ ] Testar cálculo de KPIs
- [ ] Testar permissões de usuário

### 9.6. Deploy
- [ ] Documentar novo fluxo
- [ ] Atualizar README
- [ ] Treinar usuários
- [ ] Deploy em produção

---

## 🎯 FASE 10: PRIORIZAÇÃO

### 🔥 PRIORIDADE ALTA (MVP Fábrica)
1. Criar tabela `ordens_producao`
2. Criar tabela `apontamentos_producao`
3. Adaptar `estoque_movimentos` para produção
4. Backend: criar endpoints básicos OP
5. Frontend: tela de criação de OP
6. Frontend: tela de apontamento

### 🟡 PRIORIDADE MÉDIA
7. Criar tabela `consumo_mp_op`
8. Criar tabela `refugos`
9. Backend: lógica de consumo automático de MP
10. Frontend: dashboard de produção
11. Frontend: relatórios básicos

### 🟢 PRIORIDADE BAIXA
12. Criar tabela `kpis_producao`
13. Backend: cálculo automático de KPIs
14. Frontend: gráficos avançados
15. Frontend: análise de eficiência

---

## 📌 OBSERVAÇÕES IMPORTANTES

1. **Manter compatibilidade**: Não remover tabelas antigas até validar nova estrutura
2. **Migração gradual**: Rodar em paralelo por um período
3. **Auditoria**: Manter `activity_logs` em tudo
4. **Idempotência**: Garantir que operações possam ser reprocessadas sem duplicar
5. **Testes**: Criar suite completa de testes antes do deploy

---

## 🤝 PRÓXIMOS PASSOS

Quer que eu comece por qual fase?

1. Criar as migrations SQL (tabelas novas)
2. Atualizar `regras_sistema.md` com regras de fábrica
3. Criar estrutura de serviços backend
4. Criar páginas frontend
5. Outro...

**Aguardo sua instrução para começar! 🚀**
