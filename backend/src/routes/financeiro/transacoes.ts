import { Router, Response } from 'express';
import { pool } from '../../database/db';
import { requireAuth, AuthRequest } from '../../middleware/authMiddleware';

const router = Router();

// ==================================================
// GET /api/financeiro/transacoes - Listar transações
// ==================================================
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const { conta_id, tipo, status, data_inicio, data_fim } = req.query;

        let query = `
            SELECT 
                t.id,
                t.descricao,
                t.valor,
                t.tipo,
                t.data_transacao,
                t.data_compensacao,
                t.status,
                t.origem,
                t.referencia,
                c.nome AS conta_nome,
                cd.nome AS conta_destino_nome,
                cat.nome AS categoria_nome,
                cat.tipo AS categoria_tipo,
                t.observacoes,
                t.created_at
            FROM financeiro.transacao t
            JOIN financeiro.conta c ON c.id = t.conta_id
            LEFT JOIN financeiro.conta cd ON cd.id = t.conta_destino_id
            LEFT JOIN financeiro.categoria cat ON cat.id = t.categoria_id
            WHERE t.tenant_id = $1
        `;

        const params: any[] = [tenantId];
        let paramCounter = 2;

        if (conta_id) {
            query += ` AND (t.conta_id = $${paramCounter} OR t.conta_destino_id = $${paramCounter})`;
            params.push(conta_id);
            paramCounter++;
        }

        if (tipo) {
            query += ` AND t.tipo = $${paramCounter++}`;
            params.push(tipo);
        }

        if (status) {
            query += ` AND t.status = $${paramCounter++}`;
            params.push(status);
        }

        if (data_inicio) {
            query += ` AND t.data_transacao >= $${paramCounter++}`;
            params.push(data_inicio);
        }

        if (data_fim) {
            query += ` AND t.data_transacao <= $${paramCounter++}`;
            params.push(data_fim);
        }

        query += ' ORDER BY t.data_transacao DESC, t.created_at DESC LIMIT 1000';

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error: any) {
        console.error('❌ Erro ao listar transações:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar transações',
            error: error.message
        });
    }
});

// ==================================================
// POST /api/financeiro/transacoes - Criar transação
// ==================================================
router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const {
            descricao,
            valor,
            tipo,
            data_transacao,
            data_compensacao,
            status,
            conta_id,
            conta_destino_id,
            categoria_id,
            observacoes
        } = req.body;

        // Validações
        if (!descricao || !valor || !tipo || !data_transacao || !conta_id) {
            res.status(400).json({
                success: false,
                message: 'Descrição, valor, tipo, data e conta são obrigatórios'
            });
            return;
        }

        const tiposValidos = ['credito', 'debito', 'transferencia'];
        if (!tiposValidos.includes(tipo)) {
            res.status(400).json({
                success: false,
                message: `Tipo inválido. Use: ${tiposValidos.join(', ')}`
            });
            return;
        }

        // Validar conta
        const contaResult = await pool.query(
            'SELECT id FROM financeiro.conta WHERE id = $1 AND tenant_id = $2 AND is_deleted = false',
            [conta_id, tenantId]
        );

        if (contaResult.rows.length === 0) {
            res.status(400).json({
                success: false,
                message: 'Conta inválida'
            });
            return;
        }

        // Se for transferência, validar conta destino
        if (tipo === 'transferencia') {
            if (!conta_destino_id) {
                res.status(400).json({
                    success: false,
                    message: 'Conta destino é obrigatória para transferências'
                });
                return;
            }

            const contaDestinoResult = await pool.query(
                'SELECT id FROM financeiro.conta WHERE id = $1 AND tenant_id = $2 AND is_deleted = false',
                [conta_destino_id, tenantId]
            );

            if (contaDestinoResult.rows.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'Conta destino inválida'
                });
                return;
            }
        }

        const result = await pool.query(
            `INSERT INTO financeiro.transacao 
                (tenant_id, descricao, valor, tipo, data_transacao, data_compensacao, status, conta_id, conta_destino_id, categoria_id, observacoes, origem)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'manual')
             RETURNING *`,
            [tenantId, descricao, parseFloat(valor), tipo, data_transacao, data_compensacao, status || 'previsto', conta_id, conta_destino_id, categoria_id, observacoes]
        );

        res.status(201).json({
            success: true,
            message: 'Transação criada com sucesso',
            data: result.rows[0]
        });
    } catch (error: any) {
        console.error('❌ Erro ao criar transação:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar transação',
            error: error.message
        });
    }
});

// ==================================================
// PUT /api/financeiro/transacoes/:id - Atualizar transação
// ==================================================
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const { id } = req.params;
        const { descricao, valor, data_transacao, categoria_id, observacoes } = req.body;

        // Verificar se transação existe
        const checkResult = await pool.query(
            'SELECT * FROM financeiro.transacao WHERE id = $1 AND tenant_id = $2',
            [id, tenantId]
        );

        if (checkResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Transação não encontrada'
            });
            return;
        }

        // Não permitir edição de transações liquidadas
        if (checkResult.rows[0].status === 'liquidado') {
            res.status(400).json({
                success: false,
                message: 'Não é possível editar transação liquidada. Cancele e crie uma nova.'
            });
            return;
        }

        const updates: string[] = [];
        const values: any[] = [];
        let paramCounter = 1;

        if (descricao !== undefined) {
            updates.push(`descricao = $${paramCounter++}`);
            values.push(descricao);
        }
        if (valor !== undefined) {
            updates.push(`valor = $${paramCounter++}`);
            values.push(parseFloat(valor));
        }
        if (data_transacao !== undefined) {
            updates.push(`data_transacao = $${paramCounter++}`);
            values.push(data_transacao);
        }
        if (categoria_id !== undefined) {
            updates.push(`categoria_id = $${paramCounter++}`);
            values.push(categoria_id);
        }
        if (observacoes !== undefined) {
            updates.push(`observacoes = $${paramCounter++}`);
            values.push(observacoes);
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id, tenantId);

        const result = await pool.query(
            `UPDATE financeiro.transacao 
             SET ${updates.join(', ')}
             WHERE id = $${paramCounter++} AND tenant_id = $${paramCounter++}
             RETURNING *`,
            values
        );

        res.json({
            success: true,
            message: 'Transação atualizada com sucesso',
            data: result.rows[0]
        });
    } catch (error: any) {
        console.error('❌ Erro ao atualizar transação:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar transação',
            error: error.message
        });
    }
});

// ==================================================
// POST /api/financeiro/transacoes/:id/liquidar - Liquidar transação
// ==================================================
router.post('/:id/liquidar', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const { id } = req.params;
        const { data_compensacao } = req.body;

        // Verificar se transação existe
        const checkResult = await pool.query(
            'SELECT * FROM financeiro.transacao WHERE id = $1 AND tenant_id = $2',
            [id, tenantId]
        );

        if (checkResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Transação não encontrada'
            });
            return;
        }

        if (checkResult.rows[0].status === 'liquidado') {
            res.status(400).json({
                success: false,
                message: 'Transação já está liquidada'
            });
            return;
        }

        // Atualizar status (trigger vai atualizar saldo da conta automaticamente)
        const result = await pool.query(
            `UPDATE financeiro.transacao 
             SET status = 'liquidado', 
                 data_compensacao = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND tenant_id = $3
             RETURNING *`,
            [data_compensacao || new Date().toISOString().split('T')[0], id, tenantId]
        );

        res.json({
            success: true,
            message: 'Transação liquidada com sucesso',
            data: result.rows[0]
        });
    } catch (error: any) {
        console.error('❌ Erro ao liquidar transação:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao liquidar transação',
            error: error.message
        });
    }
});

// ==================================================
// DELETE /api/financeiro/transacoes/:id - Deletar transação
// ==================================================
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const { id } = req.params;

        // Verificar se transação existe
        const checkResult = await pool.query(
            'SELECT * FROM financeiro.transacao WHERE id = $1 AND tenant_id = $2',
            [id, tenantId]
        );

        if (checkResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Transação não encontrada'
            });
            return;
        }

        // Se liquidada, cancelar ao invés de deletar (para manter histórico)
        if (checkResult.rows[0].status === 'liquidado') {
            await pool.query(
                `UPDATE financeiro.transacao 
                 SET status = 'cancelado', updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [id]
            );

            res.json({
                success: true,
                message: 'Transação cancelada (liquidada não pode ser deletada)'
            });
            return;
        }

        // Deletar transação prevista
        await pool.query('DELETE FROM financeiro.transacao WHERE id = $1', [id]);

        res.json({
            success: true,
            message: 'Transação excluída com sucesso'
        });
    } catch (error: any) {
        console.error('❌ Erro ao deletar transação:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao deletar transação',
            error: error.message
        });
    }
});

export default router;
