import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '.env') });

const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

console.log('🚀 Configurando banco de dados ERP Fábrica...\n');
console.log('📋 Configuração:');
console.log(`   Host: ${config.host}`);
console.log(`   Port: ${config.port}`);
console.log(`   Database: ${config.database}`);
console.log(`   User: ${config.user}\n`);

async function setupDatabase() {
    // Passo 1: Criar database (conectar ao postgres padrão)
    const clientPostgres = new Client({
        ...config,
        database: 'postgres' // Conecta ao postgres padrão primeiro
    });

    try {
        console.log('📦 Passo 1: Verificando/criando database...');
        await clientPostgres.connect();

        // Verificar se database existe
        const checkDb = await clientPostgres.query(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            [config.database]
        );

        if (checkDb.rows.length === 0) {
            console.log(`   Criando database '${config.database}'...`);
            await clientPostgres.query(`CREATE DATABASE ${config.database}`);
            console.log('   ✅ Database criado!\n');
        } else {
            console.log('   ✅ Database já existe!\n');
        }

        await clientPostgres.end();
    } catch (error) {
        console.error('❌ Erro ao criar database:', error.message);
        await clientPostgres.end();
        // Continua mesmo se o database já existir
    }

    // Passo 2: Executar migration
    const clientApp = new Client(config);

    try {
        console.log('📋 Passo 2: Executando migration inicial...');
        await clientApp.connect();
        console.log('   ✅ Conectado ao database!\n');

        // Ler arquivo de migration
        const migrationPath = path.join(__dirname, 'migrations', '000_initial_complete.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('   Executando SQL... (isso pode levar alguns segundos)\n');

        // Executar migration
        await clientApp.query(migrationSQL);

        console.log('🎉 SUCESSO! Migration executada com sucesso!\n');
        console.log('📊 Tabelas criadas:');

        // Listar tabelas criadas
        const tables = await clientApp.query(`
            SELECT schemaname, tablename 
            FROM pg_tables 
            WHERE schemaname IN ('obsidian', 'logistica', 'ui')
            ORDER BY schemaname, tablename
        `);

        tables.rows.forEach(row => {
            console.log(`   ✓ ${row.schemaname}.${row.tablename}`);
        });

        console.log('\n🔥 Próximos passos:');
        console.log('   1. npm run dev (para iniciar o backend)');
        console.log('   2. Acesse: http://localhost:3001/api/health\n');

        await clientApp.end();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Erro ao executar migration:', error.message);
        console.error('\nDetalhes:', error);
        await clientApp.end();
        process.exit(1);
    }
}

setupDatabase();
