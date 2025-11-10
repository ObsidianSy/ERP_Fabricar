import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

async function runMigrations() {
    const client = new Client(config);

    try {
        await client.connect();
        console.log('✅ Conectado ao database!\n');

        // Migration 101: Adicionar campo cargo
        console.log('📋 Aplicando migration 101: adicionar campo cargo...');
        const migration101 = fs.readFileSync(
            path.join(__dirname, 'migrations', '101_add_cargo_to_usuarios.sql'),
            'utf8'
        );
        await client.query(migration101);
        console.log('✅ Migration 101 aplicada!\n');

        // Migration 102: Criar tabela devolucoes
        console.log('📋 Aplicando migration 102: criar tabela devolucoes...');
        const migration102 = fs.readFileSync(
            path.join(__dirname, 'migrations', '102_add_devolucoes_table.sql'),
            'utf8'
        );
        await client.query(migration102);
        console.log('✅ Migration 102 aplicada!\n');

        console.log('🎉 Todas as migrations foram aplicadas com sucesso!\n');
        console.log('🔄 Reinicie o backend para aplicar as mudanças.');

        await client.end();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Erro ao aplicar migrations:', error.message);
        await client.end();
        process.exit(1);
    }
}

runMigrations();
