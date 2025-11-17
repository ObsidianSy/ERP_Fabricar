import express, { Request, Response } from 'express';
import { pool } from '../database/db';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';
import { logActivity } from '../services/activityLogger';

const router = express.Router();

// ==================================================
// GET /api/permissoes - Listar todas as permissões disponíveis
// ==================================================
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        console.log('🔑 Buscando permissões disponíveis...');

        const result = await pool.query(
            `SELECT id, chave, nome, descricao, categoria, icone, rota, ordem, ativo
       FROM obsidian.permissoes
       WHERE ativo = TRUE
       ORDER BY ordem ASC, nome ASC`
        );

        console.log(`✅ Encontradas ${result.rows.length} permissões`);

        res.json({
            success: true,
            data: result.rows,
            total: result.rows.length
        });
    } catch (error) {
        console.error('❌ Erro ao listar permissões:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar permissões',
            error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});

// ==================================================
// GET /api/permissoes/usuarios - Listar todos os usuários com resumo de permissões
// ==================================================
router.get('/usuarios', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        console.log('📋 Buscando usuários com permissões...');

        const result = await pool.query(
            `SELECT 
        u.id,
        u.nome,
        u.email,
        u.cargo,
        u.ativo,
        u.criado_em,
        COALESCE(
          json_agg(
            json_build_object(
              'id', p.id,
              'chave', p.chave,
              'nome', p.nome,
              'categoria', p.categoria
            ) ORDER BY p.ordem
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'::json
        ) AS permissoes,
        COUNT(p.id) AS total_permissoes
      FROM obsidian.usuarios u
      LEFT JOIN obsidian.usuarios_permissoes up ON up.usuario_id = u.id
      LEFT JOIN obsidian.permissoes p ON p.id = up.permissao_id AND p.ativo = TRUE
      WHERE u.ativo = TRUE
      GROUP BY u.id, u.nome, u.email, u.cargo, u.ativo, u.criado_em
      ORDER BY u.nome ASC`
        );

        console.log(`✅ Encontrados ${result.rows.length} usuários`);
        console.log('🔍 Primeiro usuário (estrutura):', JSON.stringify(result.rows[0], null, 2));

        // Converter total_permissoes para number explicitamente
        const usuariosFormatados = result.rows.map(row => ({
            ...row,
            total_permissoes: parseInt(row.total_permissoes, 10) || 0
        }));

        res.json({
            success: true,
            data: usuariosFormatados
        });
    } catch (error) {
        console.error('❌ Erro ao listar usuários com permissões:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar usuários',
            error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});

// ==================================================
// GET /api/permissoes/usuario/:usuarioId - Listar permissões de um usuário específico
// ==================================================
router.get('/usuario/:usuarioId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { usuarioId } = req.params;

        // Buscar dados do usuário
        const userResult = await pool.query(
            `SELECT id, nome, email, cargo, ativo
       FROM obsidian.usuarios
       WHERE id = $1`,
            [usuarioId]
        );

        if (userResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Usuário não encontrado'
            });
            return;
        }

        // Buscar permissões do usuário
        const permissoesResult = await pool.query(
            `SELECT 
        p.id,
        p.chave,
        p.nome,
        p.descricao,
        p.categoria,
        p.icone,
        p.rota,
        p.ordem,
        up.concedida_em,
        admin.nome AS concedida_por
      FROM obsidian.usuarios_permissoes up
      JOIN obsidian.permissoes p ON p.id = up.permissao_id
      LEFT JOIN obsidian.usuarios admin ON admin.id = up.concedida_por
      WHERE up.usuario_id = $1 AND p.ativo = TRUE
      ORDER BY p.ordem ASC, p.nome ASC`,
            [usuarioId]
        );

        res.json({
            success: true,
            data: {
                usuario: userResult.rows[0],
                permissoes: permissoesResult.rows
            }
        });
    } catch (error) {
        console.error('Erro ao buscar permissões do usuário:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar permissões',
            error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});

// ==================================================
// POST /api/permissoes/usuario/:usuarioId - Conceder permissões a um usuário
// ==================================================
router.post('/usuario/:usuarioId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    const client = await pool.connect();

    try {
        const { usuarioId } = req.params;
        const { permissaoIds } = req.body; // Array de IDs de permissões
        const concedidaPor = (req as any).user?.id; // Admin que está concedendo

        if (!Array.isArray(permissaoIds) || permissaoIds.length === 0) {
            res.status(400).json({
                success: false,
                message: 'Lista de permissões inválida'
            });
            return;
        }

        await client.query('BEGIN');

        // Verificar se usuário existe
        const userCheck = await client.query(
            'SELECT id, nome FROM obsidian.usuarios WHERE id = $1',
            [usuarioId]
        );

        if (userCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            res.status(404).json({
                success: false,
                message: 'Usuário não encontrado'
            });
            return;
        }

        const nomeUsuario = userCheck.rows[0].nome;

        // Inserir permissões (ignorar duplicadas)
        const insertPromises = permissaoIds.map(permissaoId =>
            client.query(
                `INSERT INTO obsidian.usuarios_permissoes (usuario_id, permissao_id, concedida_por)
         VALUES ($1, $2, $3)
         ON CONFLICT (usuario_id, permissao_id) DO NOTHING`,
                [usuarioId, permissaoId, concedidaPor]
            )
        );

        await Promise.all(insertPromises);

        // Buscar nomes das permissões para log
        const permissoesResult = await client.query(
            `SELECT nome FROM obsidian.permissoes WHERE id = ANY($1::int[])`,
            [permissaoIds]
        );

        await client.query('COMMIT');

        // Log da atividade
        await logActivity({
            user_email: req.user?.email || 'sistema@erp.local',
            user_name: req.user?.nome || 'Sistema Automático',
            action: 'CONCEDER_PERMISSOES',
            entity_type: 'usuarios_permissoes',
            entity_id: usuarioId,
            details: {
                usuario: nomeUsuario,
                permissoes_concedidas: permissoesResult.rows.map((p: any) => p.nome)
            },
            ip_address: req.ip,
            user_agent: req.get('user-agent')
        });

        res.json({
            success: true,
            message: `Permissões concedidas com sucesso para ${nomeUsuario}`,
            data: {
                usuario_id: usuarioId,
                permissoes_concedidas: permissaoIds.length
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao conceder permissões:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao conceder permissões',
            error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    } finally {
        client.release();
    }
});

// ==================================================
// DELETE /api/permissoes/usuario/:usuarioId/:permissaoId - Revogar uma permissão
// ==================================================
router.delete('/usuario/:usuarioId/:permissaoId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { usuarioId, permissaoId } = req.params;

        // Buscar informações antes de deletar (para log)
        const infoResult = await pool.query(
            `SELECT u.nome AS usuario_nome, p.nome AS permissao_nome
       FROM obsidian.usuarios_permissoes up
       JOIN obsidian.usuarios u ON u.id = up.usuario_id
       JOIN obsidian.permissoes p ON p.id = up.permissao_id
       WHERE up.usuario_id = $1 AND up.permissao_id = $2`,
            [usuarioId, permissaoId]
        );

        if (infoResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Permissão não encontrada para este usuário'
            });
            return;
        }

        const { usuario_nome, permissao_nome } = infoResult.rows[0];

        // Deletar permissão
        const result = await pool.query(
            `DELETE FROM obsidian.usuarios_permissoes
       WHERE usuario_id = $1 AND permissao_id = $2`,
            [usuarioId, permissaoId]
        );

        if (result.rowCount === 0) {
            res.status(404).json({
                success: false,
                message: 'Permissão não encontrada'
            });
            return;
        }

        // Log da atividade
        await logActivity({
            user_email: req.user?.email || 'sistema@erp.local',
            user_name: req.user?.nome || 'Sistema Automático',
            action: 'REVOGAR_PERMISSAO',
            entity_type: 'usuarios_permissoes',
            entity_id: usuarioId,
            details: {
                usuario: usuario_nome,
                permissao_revogada: permissao_nome
            },
            ip_address: req.ip,
            user_agent: req.get('user-agent')
        });

        res.json({
            success: true,
            message: `Permissão "${permissao_nome}" revogada de ${usuario_nome}`,
            data: {
                usuario_id: usuarioId,
                permissao_id: permissaoId
            }
        });
    } catch (error) {
        console.error('Erro ao revogar permissão:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao revogar permissão',
            error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});

// ==================================================
// DELETE /api/permissoes/usuario/:usuarioId/todas - Revogar TODAS as permissões de um usuário
// ==================================================
router.delete('/usuario/:usuarioId/todas', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { usuarioId } = req.params;

        // Buscar informações do usuário
        const userResult = await pool.query(
            'SELECT nome FROM obsidian.usuarios WHERE id = $1',
            [usuarioId]
        );

        if (userResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Usuário não encontrado'
            });
            return;
        }

        const nomeUsuario = userResult.rows[0].nome;

        // Deletar todas as permissões
        const result = await pool.query(
            'DELETE FROM obsidian.usuarios_permissoes WHERE usuario_id = $1',
            [usuarioId]
        );

        // Log da atividade
        await logActivity({
            user_email: req.user?.email || 'sistema@erp.local',
            user_name: req.user?.nome || 'Sistema Automático',
            action: 'REVOGAR_TODAS_PERMISSOES',
            entity_type: 'usuarios_permissoes',
            entity_id: usuarioId,
            details: {
                usuario: nomeUsuario,
                total_permissoes_revogadas: result.rowCount
            },
            ip_address: req.ip,
            user_agent: req.get('user-agent')
        });

        res.json({
            success: true,
            message: `Todas as permissões de ${nomeUsuario} foram revogadas`,
            data: {
                usuario_id: usuarioId,
                permissoes_revogadas: result.rowCount
            }
        });
    } catch (error) {
        console.error('Erro ao revogar todas as permissões:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao revogar permissões',
            error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});

export default router;
