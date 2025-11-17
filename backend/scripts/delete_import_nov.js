/**
 * Script para deletar vendas importadas incorretamente de Novembro
 * 
 * ATENÇÃO: Este script deleta vendas com pedido_uid começando com 'IMPORT_NOV_'
 * 
 * USO:
 * node backend/scripts/delete_import_nov.js
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Carregar variáveis de ambiente do backend
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function deletarVendasImportadas() {
  try {
    console.log('🔍 Buscando vendas com pedido_uid IMPORT_NOV_...\n');
    
    // Contar vendas a deletar
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM obsidian.vendas WHERE pedido_uid LIKE 'IMPORT_NOV_%'`
    );
    
    const total = parseInt(countResult.rows[0].total);
    
    if (total === 0) {
      console.log('✅ Nenhuma venda de importação encontrada para deletar.');
      await pool.end();
      return;
    }
    
    console.log(`⚠️  Encontradas ${total} vendas para deletar.`);
    console.log('   Aguarde 5 segundos ou pressione CTRL+C para cancelar...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Deletar vendas
    const deleteResult = await pool.query(
      `DELETE FROM obsidian.vendas WHERE pedido_uid LIKE 'IMPORT_NOV_%'`
    );
    
    console.log(`✅ ${deleteResult.rowCount} vendas deletadas com sucesso!\n`);
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Erro ao deletar vendas:', error);
    await pool.end();
    process.exit(1);
  }
}

deletarVendasImportadas()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Erro fatal:', err);
    process.exit(1);
  });
