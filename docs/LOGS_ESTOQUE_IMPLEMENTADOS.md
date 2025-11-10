# Sistema de Logs - Estoque e Matéria-Prima

## 📋 Resumo
Implementação completa de logs para todas as operações de estoque, matéria-prima e receitas de produtos no sistema ERP.

## ✅ Logs Implementados

### 🏭 Produtos (Estoque)

#### 1. **Criar Produto** (`produto_criado`)
- **Rota**: `POST /api/estoque`
- **Informações Registradas**:
  - Nome do produto
  - Categoria
  - Tipo de produto
  - Quantidade inicial
  - Preço unitário
  - Se é kit ou não
  - Quantidade de componentes (se for kit)

#### 2. **Excluir Produto** (`produto_excluido`)
- **Rota**: `DELETE /api/estoque/:sku`
- **Informações Registradas**:
  - Nome do produto
  - Categoria
  - Tipo de produto
  - Quantidade final no momento da exclusão

#### 3. **Entrada de Produto** (`entrada_produto`)
- **Rota**: `POST /api/estoque/entrada`
- **Informações Registradas**:
  - Nome do produto
  - Quantidade de entrada
  - Saldo anterior
  - Saldo atual
  - Tipo de entrada (fabricação, ajuste, etc.)
  - Quantidade de matérias-primas abatidas
  - Observação

#### 4. **Ajuste de Quantidade** (`ajuste_quantidade_produto`)
- **Rota**: `PATCH /api/estoque/:sku/quantidade`
- **Informações Registradas**:
  - Nome do produto
  - Quantidade anterior
  - Quantidade nova
  - Diferença (positiva ou negativa)

---

### 🧪 Matérias-Primas

#### 5. **Criar Matéria-Prima** (`materia_prima_criada`)
- **Rota**: `POST /api/materia-prima`
- **Informações Registradas**:
  - Nome da matéria-prima
  - Categoria
  - Quantidade inicial
  - Custo unitário

#### 6. **Atualizar Matéria-Prima** (`materia_prima_atualizada`)
- **Rota**: `PUT /api/materia-prima/:sku`
- **Informações Registradas**:
  - Nome da matéria-prima
  - Categoria
  - Quantidade atual
  - Custo unitário
  - Quantidade anterior (para comparação)
  - Diferença de quantidade

#### 7. **Excluir Matéria-Prima** (`materia_prima_excluida`)
- **Rota**: `DELETE /api/materia-prima/:sku`
- **Informações Registradas**:
  - Nome da matéria-prima
  - Categoria
  - Quantidade final
  - Custo unitário

#### 8. **Entrada de Matéria-Prima** (`entrada_materia_prima`)
- **Rota**: `POST /api/materia-prima/entrada` ⭐ **NOVA ROTA**
- **Informações Registradas**:
  - Nome da matéria-prima
  - Quantidade de entrada
  - Saldo anterior
  - Saldo atual
  - Observação

---

### 📝 Receitas de Produtos

#### 9. **Criar/Atualizar Receita** (`receita_produto_criada_atualizada`)
- **Rota**: `POST /api/receita-produto`
- **Informações Registradas**:
  - SKU do produto
  - Quantidade de itens na receita
  - Lista de matérias-primas utilizadas

#### 10. **Excluir Receita** (`receita_produto_excluida`)
- **Rota**: `DELETE /api/receita-produto/:sku`
- **Informações Registradas**:
  - SKU do produto
  - Quantidade de itens excluídos

---

## 🎨 Visualização no Frontend

### Cores dos Badges (ActivityLogs.tsx)

| Ação | Cor | Badge |
|------|-----|-------|
| Produto Criado | Verde Escuro | `bg-green-600` |
| Produto Excluído | Vermelho Escuro | `bg-red-600` |
| Entrada de Produto | Azul Escuro | `bg-blue-600` |
| Ajuste de Quantidade | Amarelo Escuro | `bg-yellow-600` |
| Matéria-Prima Criada | Esmeralda | `bg-emerald-600` |
| Matéria-Prima Atualizada | Azul-esverdeado | `bg-teal-600` |
| Matéria-Prima Excluída | Vermelho Intenso | `bg-red-700` |
| Entrada de Matéria-Prima | Azul Intenso | `bg-blue-700` |
| Receita Criada/Atualizada | Índigo | `bg-indigo-600` |
| Receita Excluída | Vermelho Profundo | `bg-red-800` |

---

## 📊 Estrutura dos Logs

Todos os logs seguem o padrão:

```typescript
{
    user_email: string,      // Email do usuário (ou 'sistema')
    user_name: string,        // Nome do usuário (ou 'Sistema')
    action: string,           // Tipo de ação (ver lista acima)
    entity_type: string,      // Tipo de entidade ('produto', 'materia_prima', 'receita_produto')
    entity_id: string,        // SKU do produto/matéria-prima
    details: {                // Detalhes específicos da operação
        // Varia conforme a ação
    }
}
```

---

## 🔄 Fluxo de Abate de Matérias-Primas

Quando um produto é fabricado (entrada com `tipo_entrada: 'fabricacao'`):

1. Sistema busca a receita do produto
2. Verifica se há matérias-primas suficientes
3. Se houver, abate as quantidades necessárias
4. Registra log de entrada do produto
5. Os abates de matéria-prima são registrados automaticamente via UPDATE

**Observação**: Se a entrada for de outro tipo (ajuste, devolução, etc.), as matérias-primas **NÃO** são abatidas.

---

## 🚀 Nova Funcionalidade

### Rota de Entrada de Matéria-Prima

```typescript
POST /api/materia-prima/entrada
Body: {
    sku_mp: string,         // SKU da matéria-prima
    quantidade: number,      // Quantidade a adicionar
    observacao?: string,     // Observação opcional
    user_email?: string,     // Email do usuário (opcional)
    user_name?: string       // Nome do usuário (opcional)
}
```

**Response**:
```json
{
    "success": true,
    "message": "Entrada registrada com sucesso",
    "sku_mp": "MP-001",
    "nome": "Tecido Algodão",
    "quantidade_adicionada": 50,
    "saldo_anterior": 100,
    "saldo_atual": 150
}
```

---

## 📁 Arquivos Modificados

### Backend
- `backend/src/routes/estoque.ts` - Logs de produtos
- `backend/src/routes/materiaPrima.ts` - Logs de matérias-primas + nova rota de entrada
- `backend/src/routes/receitaProduto.ts` - Logs de receitas

### Frontend
- `src/pages/ActivityLogs.tsx` - Labels e cores para novos logs

---

## 🎯 Rastreabilidade Completa

Agora é possível rastrear:

✅ Quem criou cada produto/matéria-prima  
✅ Quem fez entradas no estoque  
✅ Quem ajustou quantidades  
✅ Quem excluiu itens  
✅ Quem criou/editou receitas  
✅ Quando ocorreu cada operação  
✅ Detalhes completos de cada alteração  

---

## 📅 Data de Implementação
10 de novembro de 2025

## 👨‍💻 Desenvolvido por
GitHub Copilot
