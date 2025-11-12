import { Router, Response } from 'express';
import { pool } from '../../database/db';
import { requireAuth, AuthRequest } from '../../middleware/authMiddleware';

const router = Router();

// ==================================================
// GET /api/financeiro/categorias - Listar categorias (globais + do usuário)
// ==================================================
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const { tipo } = req.query;

        let query = `
            SELECT 
                c.id,
                c.tenant_id,
                c.nome,
                c.tipo,
                c.parent_id,
                p.nome AS parent_nome,
                c.icone,
                c.cor,
                c.created_at,
                CASE WHEN c.tenant_id IS NULL THEN true ELSE false END AS is_global
            FROM financeiro.categoria c
            LEFT JOIN financeiro.categoria p ON p.id = c.parent_id
            WHERE (c.tenant_id = $1 OR c.tenant_id IS NULL)
        `;

        const params: any[] = [tenantId];

        if (tipo) {
            query += ` AND c.tipo = $2`;
            params.push(tipo);
        }

        query += ' ORDER BY c.tipo, c.nome ASC';

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error: any) {
        console.error('❌ Erro ao listar categorias:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar categorias',
            error: error.message
        });
    }
});

// ==================================================
// POST /api/financeiro/categorias - Criar nova categoria customizada
// ==================================================
router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const { nome, tipo, parent_id, icone, cor } = req.body;

        // Validações
        if (!nome || !tipo) {
            res.status(400).json({
                success: false,
                message: 'Nome e tipo são obrigatórios'
            });
            return;
        }

        const tiposValidos = ['despesa', 'receita', 'transferencia'];
        if (!tiposValidos.includes(tipo)) {
            res.status(400).json({
                success: false,
                message: `Tipo inválido. Use: ${tiposValidos.join(', ')}`
            });
            return;
        }

        // Validar parent_id se fornecido
        if (parent_id) {
            const parentResult = await pool.query(
                'SELECT id FROM financeiro.categoria WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)',
                [parent_id, tenantId]
            );

            if (parentResult.rows.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'Categoria pai inválida'
                });
                return;
            }
        }

        const result = await pool.query(
            `INSERT INTO financeiro.categoria 
                (tenant_id, nome, tipo, parent_id, icone, cor)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [tenantId, nome, tipo, parent_id, icone, cor]
        );

        res.status(201).json({
            success: true,
            message: 'Categoria criada com sucesso',
            data: result.rows[0]
        });
    } catch (error: any) {
        console.error('❌ Erro ao criar categoria:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar categoria',
            error: error.message
        });
    }
});

// ==================================================
// PUT /api/financeiro/categorias/:id - Atualizar categoria
// ==================================================
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const { id } = req.params;
        const { nome, tipo, parent_id, icone, cor } = req.body;

        // Verificar se categoria existe e pertence ao usuário (não pode editar globais)
        const checkResult = await pool.query(
            'SELECT * FROM financeiro.categoria WHERE id = $1 AND tenant_id = $2',
            [id, tenantId]
        );

        if (checkResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Categoria não encontrada ou não pode ser editada (categoria global)'
            });
            return;
        }

        // Validar tipo se fornecido
        if (tipo) {
            const tiposValidos = ['despesa', 'receita', 'transferencia'];
            if (!tiposValidos.includes(tipo)) {
                res.status(400).json({
                    success: false,
                    message: `Tipo inválido. Use: ${tiposValidos.join(', ')}`
                });
                return;
            }
        }

        // Atualizar apenas campos fornecidos
        const updates: string[] = [];
        const values: any[] = [];
        let paramCounter = 1;

        if (nome !== undefined) {
            updates.push(`nome = $${paramCounter++}`);
            values.push(nome);
        }
        if (tipo !== undefined) {
            updates.push(`tipo = $${paramCounter++}`);
            values.push(tipo);
        }
        if (parent_id !== undefined) {
            updates.push(`parent_id = $${paramCounter++}`);
            values.push(parent_id);
        }
        if (icone !== undefined) {
            updates.push(`icone = $${paramCounter++}`);
            values.push(icone);
        }
        if (cor !== undefined) {
            updates.push(`cor = $${paramCounter++}`);
            values.push(cor);
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);

        values.push(id, tenantId);

        const result = await pool.query(
            `UPDATE financeiro.categoria 
             SET ${updates.join(', ')}
             WHERE id = $${paramCounter++} AND tenant_id = $${paramCounter++}
             RETURNING *`,
            values
        );

        res.json({
            success: true,
            message: 'Categoria atualizada com sucesso',
            data: result.rows[0]
        });
    } catch (error: any) {
        console.error('❌ Erro ao atualizar categoria:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar categoria',
            error: error.message
        });
    }
});

// ==================================================
// DELETE /api/financeiro/categorias/:id - Deletar categoria customizada
// ==================================================
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const { id } = req.params;

        // Verificar se é categoria customizada do usuário
        const checkResult = await pool.query(
            'SELECT * FROM financeiro.categoria WHERE id = $1 AND tenant_id = $2',
            [id, tenantId]
        );

        if (checkResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Categoria não encontrada ou não pode ser deletada (categoria global)'
            });
            return;
        }

        // Verificar se há transações ou itens de fatura usando esta categoria
        const usageResult = await pool.query(
            `SELECT 
                (SELECT COUNT(*) FROM financeiro.transacao WHERE categoria_id = $1) +
                (SELECT COUNT(*) FROM financeiro.fatura_item WHERE categoria_id = $1) AS total`,
            [id]
        );

        const totalUsage = parseInt(usageResult.rows[0].total);

        if (totalUsage > 0) {
            res.status(400).json({
                success: false,
                message: `Não é possível excluir categoria com ${totalUsage} transação/item vinculado(s)`
            });
            return;
        }

        await pool.query('DELETE FROM financeiro.categoria WHERE id = $1', [id]);

        res.json({
            success: true,
            message: 'Categoria excluída com sucesso'
        });
    } catch (error: any) {
        console.error('❌ Erro ao deletar categoria:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao deletar categoria',
            error: error.message
        });
    }
});

export default router;
