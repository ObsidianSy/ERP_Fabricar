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

(async () => {
  try {
    const res = await pool.query(`
      SELECT id, user_email, user_name, action, details, created_at
      FROM obsidian.activity_logs
      ORDER BY created_at DESC
      LIMIT 30
    `);

    console.log('\nÚltimos 30 activity_logs:');
    res.rows.forEach(r => {
      console.log(`- ${r.created_at.toISOString()} | ${r.action} | ${r.user_email} | ${r.user_name} | details=${r.details}`);
    });

    // contar quantos tem user_name LIKE 'Sistema%'
    const cnt = await pool.query("SELECT COUNT(*) FROM obsidian.activity_logs WHERE user_name ILIKE 'sistema%' OR user_email ILIKE 'sistema%'");
    console.log(`\nContagem de registros com user_name/user_email contendo 'sistema': ${cnt.rows[0].count}`);
  } catch (err) {
    console.error('Erro ao consultar activity_logs:', err.message);
  } finally {
    await pool.end();
  }
})();
