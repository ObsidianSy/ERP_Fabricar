import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

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

async function createAdminUser() {
    const client = new Client(config);

    try {
        await client.connect();
        console.log('✅ Conectado ao database!\n');

        // Dados do usuário admin
        const adminEmail = 'deltagarr@gmail.com';
        const adminPassword = 'delta123'; // Senha padrão - MUDAR depois!
        const adminNome = 'Administrador';

        // Hash da senha
        const senhaHash = await bcrypt.hash(adminPassword, 10);

        // Verificar se usuário já existe
        const checkUser = await client.query(
            'SELECT id FROM obsidian.usuarios WHERE email = $1',
            [adminEmail]
        );

        let userId;

        if (checkUser.rows.length > 0) {
            console.log('⚠️  Usuário admin já existe! Atualizando senha...\n');
            await client.query(
                'UPDATE obsidian.usuarios SET senha_hash = $1 WHERE email = $2',
                [senhaHash, adminEmail]
            );
            userId = checkUser.rows[0].id;
        } else {
            console.log('👤 Criando usuário administrador...\n');
            const result = await client.query(
                'INSERT INTO obsidian.usuarios (nome, email, senha_hash, ativo) VALUES ($1, $2, $3, true) RETURNING id',
                [adminNome, adminEmail, senhaHash]
            );
            userId = result.rows[0].id;
        }

        // Atribuir role de admin
        const roleResult = await client.query(
            'SELECT id FROM obsidian.roles WHERE nome = $1',
            ['admin']
        );

        if (roleResult.rows.length > 0) {
            const roleId = roleResult.rows[0].id;

            // Verificar se já tem a role
            const checkRole = await client.query(
                'SELECT 1 FROM obsidian.usuario_roles WHERE usuario_id = $1 AND role_id = $2',
                [userId, roleId]
            );

            if (checkRole.rows.length === 0) {
                await client.query(
                    'INSERT INTO obsidian.usuario_roles (usuario_id, role_id) VALUES ($1, $2)',
                    [userId, roleId]
                );
            }
        }

        console.log('🎉 SUCESSO! Usuário administrador criado/atualizado!\n');
        console.log('📋 Credenciais de acesso:');
        console.log('   Email: ' + adminEmail);
        console.log('   Senha: ' + adminPassword);
        console.log('\n⚠️  IMPORTANTE: Mude essa senha após o primeiro login!\n');
        console.log('🌐 Acesse o sistema em: http://localhost:8080\n');

        await client.end();
        process.exit(0);

    } catch (error) {
        console.error('❌ Erro ao criar usuário:', error.message);
        await client.end();
        process.exit(1);
    }
}

createAdminUser();
