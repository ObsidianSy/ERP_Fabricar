// Script temporário para executar migração
import { pool } from './src/database/db.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
    try {
        console.log('🔄 Executando migração: 006_add_materia_prima_fotos.sql');

        const sql = readFileSync(
            join(__dirname, 'migrations', '006_add_materia_prima_fotos.sql'),
            'utf-8'
        );

        await pool.query(sql);

        console.log('✅ Migração executada com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao executar migração:', error);
        process.exit(1);
    }
}

runMigration();
