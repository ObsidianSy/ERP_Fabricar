# 📦 Import Excel com Múltiplas Abas - Estoque

## ✨ O Que Foi Implementado

A funcionalidade de importação de Excel na página de Estoque foi melhorada para **importar automaticamente** produtos e matérias-primas de **múltiplas abas** de uma única planilha!

### 🎯 **Antes:**
- ❌ Lia apenas a primeira aba do Excel
- ❌ Detectava automaticamente se era produto ou matéria-prima
- ❌ Só importava um tipo por vez

### 🎯 **Agora:**
- ✅ Lê **duas abas específicas** automaticamente
- ✅ **Aba "Estoque"** → Importa produtos para `obsidian.produtos`
- ✅ **Aba "Estoque_Materia_Prima"** → Importa matérias-primas para `obsidian.materia_prima`
- ✅ Importa **ambas de uma vez** na mesma planilha!

---

## 📋 Como Usar

### 1️⃣ **Prepare sua Planilha Excel**

A planilha deve ter **duas abas** com os nomes:
- `Estoque` (ou qualquer nome contendo "estoque" sem "materia" ou "prima")
- `Estoque_Materia_Prima` (ou qualquer nome contendo "estoque" E ("materia" OU "prima"))

### 2️⃣ **Estrutura da Aba "Estoque" (Produtos)**

Colunas obrigatórias:
- `SKU` - Código único do produto
- `Nome Produto` ou `Nome do Produto` - Nome do produto

Colunas opcionais:
- `Categoria`
- `Tipo Produto` ou `Tipo` (padrão: "Fabricado")
- `Quantidade Atual` ou `Quantidade`
- `Unidade de Medida` ou `Unidade` (padrão: "UN")
- `Preço Unitário` ou `Preco Unitario`

**Exemplo:**

| SKU   | Nome Produto                  | Categoria | Tipo Produto | Quantidade Atual | Unidade de Medida | Preço Unitário |
|-------|-------------------------------|-----------|--------------|------------------|-------------------|----------------|
| H101  | Choker Gargantilha Lisa       | Choker    | Fabricado    | 4                | UN                | 5.00           |
| H102  | Choker com Pingente           | Choker    | Fabricado    | 34               | UN                | 8.00           |

### 3️⃣ **Estrutura da Aba "Estoque_Materia_Prima" (Matérias-Primas)**

Colunas obrigatórias:
- `SKU Matéria-Prima` ou `SKU` - Código único da matéria-prima
- `Nome Matéria-Prima` ou `Nome` - Nome da matéria-prima

Colunas opcionais:
- `Categoria MP` ou `Categoria`
- `Quantidade Atual` ou `Quantidade`
- `Unidade de Medida` ou `Unidade` (padrão: "UN")
- `Custo Unitário` ou `Custo Unitario`

**Exemplo:**

| SKU Matéria-Prima | Nome Matéria-Prima     | Categoria MP | Quantidade Atual | Unidade de Medida | Custo Unitário |
|-------------------|------------------------|--------------|------------------|-------------------|----------------|
| FIV10NP           | FIVELA 10mm niquel P   | metal        | 16100            | UN                | 0.30           |
| ARG25NP           | ARGOLA 25mm niquel P   | metal        | 4511             | UN                | 0.25           |

### 4️⃣ **Importar no Sistema**

1. Acesse **Estoque** no menu
2. Clique no botão **"Importar Excel"** (ícone Upload)
3. Selecione seu arquivo `.xlsx` ou `.xls`
4. Aguarde o processamento
5. Veja o resultado no toast de notificação:
   - ✅ **Sucesso:** Mostra quantos produtos e matérias-primas foram importados
   - ❌ **Erros:** Se houver erros, veja os detalhes no console do navegador (F12)

---

## 🔄 Comportamento da Importação

### **Atualização Inteligente:**
- Se o SKU **já existe** → **Atualiza** os dados
- Se o SKU **não existe** → **Cria** novo registro

### **Validações:**
- SKU e Nome são **obrigatórios**
- Campos numéricos são convertidos automaticamente
- Valores vazios usam padrões (UN, 0, etc)

### **Logs Detalhados:**
- Todos os passos são logados no console (F12)
- Abas encontradas
- Quantidade de itens processados
- Sucessos e erros por item

---

## 📊 Exemplo de Resultado

Após importar uma planilha com:
- 25 produtos na aba "Estoque"
- 20 matérias-primas na aba "Estoque_Materia_Prima"

Você verá:
```
✅ 25 produtos e 20 matérias-primas importados
```

Se houver erros:
```
✅ 23 produtos e 18 matérias-primas importados | ❌ 4 com erro
```

---

## 🐛 Troubleshooting

### Problema: "Abas não encontradas"
**Solução:** Verifique se as abas têm os nomes corretos:
- Deve conter a palavra "estoque" (maiúscula ou minúscula)
- Para matéria-prima, deve conter "materia" ou "prima" também

### Problema: "Nenhum item importado"
**Solução:** 
1. Abra o console (F12)
2. Veja os logs detalhados
3. Verifique se as colunas obrigatórias (SKU e Nome) estão preenchidas

### Problema: "Alguns itens com erro"
**Solução:**
1. Abra o console (F12)
2. Veja o array `errosDetalhados` para saber quais SKUs falharam
3. Corrija os dados e reimporte

---

## 🎨 Melhorias Futuras (Opcional)

- [ ] Upload via drag-and-drop
- [ ] Preview dos dados antes de importar
- [ ] Download de planilha modelo
- [ ] Relatório de importação em PDF
- [ ] Suporte para mais formatos (CSV, ODS)
- [ ] Importação em lote (múltiplos arquivos)

---

## 📝 Código Modificado

**Arquivo:** `src/pages/Estoque.tsx`

**Função:** `importarDeExcel`

**Mudanças:**
1. Busca automaticamente as abas "Estoque" e "Estoque_Materia_Prima"
2. Processa ambas as abas em paralelo
3. Mapeamento flexível de colunas (aceita variações de nomes)
4. Validação robusta com tratamento de erros
5. Feedback consolidado de sucessos/erros
6. Logs detalhados no console

---

## ✅ Pronto para Usar!

A funcionalidade está **100% operacional** e pronta para uso em produção! 🚀
