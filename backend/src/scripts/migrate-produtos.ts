import { pool } from '../database/db';
import * as fs from 'fs';
import * as path from 'path';

async function migrateProdutos() {
  const client = await pool.connect();

  try {
    console.log('🚀 Iniciando migração de produtos do banco obsidian...');

    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, '../../migrations/migrate_produtos_from_obsidian.sql');
    let sql = fs.readFileSync(sqlPath, 'utf8');

    // Pegar credenciais do ambiente ou usar padrão
    const dbPassword = process.env.DB_PASSWORD || 'postgres';

    // Substituir a senha no SQL
    sql = sql.replace('sua_senha_aqui', dbPassword);

    console.log('📝 Executando script de migração...');

    // Executar o script
    await client.query(sql);

    // Verificar quantos produtos foram migrados
    const result = await client.query('SELECT COUNT(*) as total FROM obsidian.produtos');
    const total = result.rows[0].total;

    console.log(`✅ Migração concluída com sucesso!`);
    console.log(`📦 Total de produtos no banco erp_fabrica: ${total}`);

  } catch (error) {
    console.error('❌ Erro na migração:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Executar se for chamado diretamente
if (require.main === module) {
  migrateProdutos()
    .then(() => {
      console.log('🎉 Script finalizado!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erro fatal:', error);
      process.exit(1);
    });
}

export { migrateProdutos };
