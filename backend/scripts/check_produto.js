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

async function checkProduto() {
  try {
    const result = await pool.query('SELECT sku, nome, ativo FROM obsidian.produtos WHERE sku = $1', ['B701']);
    console.log('Produto B701:', result.rows[0] || 'não encontrado');
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await pool.end();
  }
}

checkProduto();
