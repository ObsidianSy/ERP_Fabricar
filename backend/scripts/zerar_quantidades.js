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

async function zerarQuantidades() {
  try {
    const result = await pool.query('UPDATE obsidian.produtos SET quantidade_atual = 0');
    console.log(`✅ Zeradas as quantidades de ${result.rowCount} produtos`);
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

zerarQuantidades();
