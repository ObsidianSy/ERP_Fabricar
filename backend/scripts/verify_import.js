const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function verificarImportacao() {
  try {
    const result = await pool.query(`
      SELECT 
        c.nome AS cliente, 
        v.client_id, 
        COUNT(*) AS total
      FROM obsidian.vendas v
      JOIN obsidian.clientes c ON v.client_id = c.id
      WHERE v.pedido_uid LIKE 'IMPORT_NOV_%'
      GROUP BY c.nome, v.client_id
      ORDER BY c.nome
    `);

    console.log('\n📊 Verificação da Importação:\n');
    console.table(result.rows);
    
    const totalGeral = result.rows.reduce((sum, row) => sum + parseInt(row.total), 0);
    console.log(`\n✅ Total geral: ${totalGeral} vendas\n`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarImportacao();
