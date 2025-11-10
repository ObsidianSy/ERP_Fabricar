# Migração de Produtos do Banco Obsidian para ERP Fabrica

Este guia explica como copiar os dados da tabela `obsidian.produtos` do banco **obsidian** para o banco **erp_fabrica**.

## 📋 Pré-requisitos

- Ambos os bancos (obsidian e erp_fabrica) devem estar no mesmo servidor PostgreSQL
- Acesso com permissões suficientes para criar extensões e foreign tables
- Docker rodando com os containers do banco

## 🚀 Como Executar

### Opção 1: Via Script Node.js (Recomendado)

1. **Configure a senha do banco** no arquivo `.env` do backend:
   ```env
   DB_PASSWORD=sua_senha_do_postgres
   ```

2. **Execute o script de migração:**
   ```bash
   cd backend
   npm run migrate:produtos
   ```
   
   Ou manualmente com ts-node:
   ```bash
   npx ts-node src/scripts/migrate-produtos.ts
   ```

### Opção 2: Via SQL Direto

1. **Conecte no banco erp_fabrica:**
   ```bash
   docker exec -it <seu_container_postgres> psql -U postgres -d erp_fabrica
   ```

2. **Execute o arquivo SQL:**
   ```sql
   \i /caminho/para/backend/migrations/migrate_produtos_from_obsidian.sql
   ```
   
   **OU** copie e cole o conteúdo do arquivo SQL, substituindo `sua_senha_aqui` pela senha real.

### Opção 3: Via pgAdmin ou DBeaver

1. Abra o arquivo `migrate_produtos_from_obsidian.sql`
2. Substitua `sua_senha_aqui` pela senha do banco obsidian
3. Conecte no banco **erp_fabrica**
4. Execute o script completo

## 🔄 O que o Script Faz

1. **Cria a extensão `postgres_fdw`** para acessar bancos remotos
2. **Cria um servidor remoto** apontando para o banco `obsidian`
3. **Mapeia o usuário** para autenticação
4. **Cria uma tabela foreign** temporária para acessar `obsidian.produtos`
5. **Copia todos os dados** para `erp_fabrica.obsidian.produtos`
6. **Atualiza registros duplicados** (baseado no SKU)
7. **Remove a tabela temporária**

## ⚠️ Importante

- **Duplicatas:** O script usa `ON CONFLICT (sku) DO UPDATE` para atualizar produtos que já existem (baseado no SKU único)
- **Dados preservados:** Os dados originais no banco `obsidian` **não são alterados**
- **Segurança:** Após a migração, você pode remover o servidor remoto e mapeamento de usuário (instruções no final do SQL)

## 📊 Verificar Resultados

Após a migração, verifique quantos produtos foram copiados:

```sql
SELECT COUNT(*) FROM obsidian.produtos;
```

Compare com o banco original:

```bash
docker exec -it <container> psql -U postgres -d obsidian -c "SELECT COUNT(*) FROM obsidian.produtos;"
```

## 🔧 Adicionar ao package.json

Adicione este script no `package.json` do backend:

```json
{
  "scripts": {
    "migrate:produtos": "ts-node src/scripts/migrate-produtos.ts"
  }
}
```

## 🐛 Troubleshooting

### Erro: "extension postgres_fdw does not exist"
- Execute como superuser (postgres): `CREATE EXTENSION postgres_fdw;`

### Erro: "authentication failed"
- Verifique se a senha no script está correta
- Verifique se o usuário tem permissão para acessar o banco obsidian

### Erro: "foreign table does not exist"
- Certifique-se de que o banco obsidian está acessível
- Verifique o host e porta no CREATE SERVER

## 📝 Logs

O script Node.js exibe:
- 🚀 Início da migração
- 📝 Execução do script SQL
- ✅ Sucesso com total de produtos
- ❌ Erros detalhados se houver falha

## 🔄 Re-executar a Migração

Pode executar o script quantas vezes quiser! Ele:
- **Atualiza** produtos existentes (mesmo SKU)
- **Adiciona** novos produtos
- **Não remove** produtos que não existem mais no banco origem
