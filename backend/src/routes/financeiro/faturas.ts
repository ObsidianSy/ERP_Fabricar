import { Router, Response } from 'express';
import { pool } from '../../database/db';
import { requireAuth, AuthRequest } from '../../middleware/authMiddleware';

const router = Router();

// GET /api/financeiro/faturas - Listar faturas
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const { cartao_id, competencia, status } = req.query;

        let query = `
            SELECT 
                f.id,
                f.cartao_id,
                c.apelido AS cartao_apelido,
                f.competencia,
                f.data_fechamento,
                f.data_vencimento,
                f.valor_total,
                f.valor_pago,
                f.status,
                f.created_at,
                COUNT(fi.id) FILTER (WHERE fi.is_deleted = false) AS total_itens
            FROM financeiro.fatura f
            JOIN financeiro.cartao c ON c.id = f.cartao_id
            LEFT JOIN financeiro.fatura_item fi ON fi.fatura_id = f.id
            WHERE c.tenant_id = $1
        `;

        const params: any[] = [tenantId];
        let paramCounter = 2;

        if (cartao_id) {
            query += ` AND f.cartao_id = $${paramCounter++}`;
            params.push(cartao_id);
        }

        if (competencia) {
            query += ` AND f.competencia = $${paramCounter++}`;
            params.push(competencia);
        }

        if (status) {
            query += ` AND f.status = $${paramCounter++}`;
            params.push(status);
        }

        query += ' GROUP BY f.id, c.apelido ORDER BY f.competencia DESC, f.data_vencimento DESC';

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error: any) {
        console.error('❌ Erro ao listar faturas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar faturas',
            error: error.message
        });
    }
});

// GET /api/financeiro/faturas/:id - Buscar fatura específica com itens
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const { id } = req.params;

        const faturaResult = await pool.query(
            `SELECT f.*, c.apelido AS cartao_apelido, c.tenant_id
             FROM financeiro.fatura f
             JOIN financeiro.cartao c ON c.id = f.cartao_id
             WHERE f.id = $1 AND c.tenant_id = $2`,
            [id, tenantId]
        );

        if (faturaResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Fatura não encontrada'
            });
            return;
        }

        const itensResult = await pool.query(
            `SELECT 
                fi.id,
                fi.descricao,
                fi.valor,
                fi.data_compra,
                fi.parcela_numero,
                fi.parcela_total,
                fi.parcela_group_id,
                fi.observacoes,
                cat.nome AS categoria_nome,
                cat.tipo AS categoria_tipo
             FROM financeiro.fatura_item fi
             LEFT JOIN financeiro.categoria cat ON cat.id = fi.categoria_id
             WHERE fi.fatura_id = $1 AND fi.is_deleted = false
             ORDER BY fi.data_compra DESC`,
            [id]
        );

        res.json({
            success: true,
            data: {
                ...faturaResult.rows[0],
                itens: itensResult.rows
            }
        });
    } catch (error: any) {
        console.error('❌ Erro ao buscar fatura:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar fatura',
            error: error.message
        });
    }
});

// POST /api/financeiro/faturas/:id/fechar - Fechar fatura
router.post('/:id/fechar', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const { id } = req.params;

        const checkResult = await pool.query(
            `SELECT f.*, c.tenant_id 
             FROM financeiro.fatura f
             JOIN financeiro.cartao c ON c.id = f.cartao_id
             WHERE f.id = $1 AND c.tenant_id = $2`,
            [id, tenantId]
        );

        if (checkResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Fatura não encontrada'
            });
            return;
        }

        if (checkResult.rows[0].status !== 'aberta') {
            res.status(400).json({
                success: false,
                message: 'Apenas faturas abertas podem ser fechadas'
            });
            return;
        }

        const result = await pool.query(
            `UPDATE financeiro.fatura 
             SET status = 'fechada', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        res.json({
            success: true,
            message: 'Fatura fechada com sucesso',
            data: result.rows[0]
        });
    } catch (error: any) {
        console.error('❌ Erro ao fechar fatura:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao fechar fatura',
            error: error.message
        });
    }
});

// POST /api/financeiro/faturas/:id/pagar - Pagar fatura
router.post('/:id/pagar', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const { id } = req.params;
        const { valor_pago, data_pagamento } = req.body;

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const faturaResult = await client.query(
                `SELECT f.*, c.conta_pagamento_id, c.apelido, c.tenant_id
                 FROM financeiro.fatura f
                 JOIN financeiro.cartao c ON c.id = f.cartao_id
                 WHERE f.id = $1 AND c.tenant_id = $2`,
                [id, tenantId]
            );

            if (faturaResult.rows.length === 0) {
                await client.query('ROLLBACK');
                res.status(404).json({
                    success: false,
                    message: 'Fatura não encontrada'
                });
                return;
            }

            const fatura = faturaResult.rows[0];

            if (fatura.status === 'paga') {
                await client.query('ROLLBACK');
                res.status(400).json({
                    success: false,
                    message: 'Fatura já foi paga'
                });
                return;
            }

            if (!fatura.conta_pagamento_id) {
                await client.query('ROLLBACK');
                res.status(400).json({
                    success: false,
                    message: 'Cartão não tem conta de pagamento configurada'
                });
                return;
            }

            const valorPago = valor_pago ? parseFloat(valor_pago) : fatura.valor_total;
            const dataPagamento = data_pagamento || new Date().toISOString().split('T')[0];

            // Criar transação de pagamento
            const transacaoResult = await client.query(
                `INSERT INTO financeiro.transacao 
                    (tenant_id, descricao, valor, tipo, data_transacao, status, conta_id, origem, referencia)
                 VALUES ($1, $2, $3, 'debito', $4, 'liquidado', $5, 'fatura', $6)
                 RETURNING id`,
                [tenantId, `Pagamento fatura ${fatura.apelido} - ${fatura.competencia}`, valorPago, dataPagamento, fatura.conta_pagamento_id, id]
            );

            // Atualizar fatura
            await client.query(
                `UPDATE financeiro.fatura 
                 SET status = 'paga', 
                     valor_pago = $1, 
                     transacao_pagamento_id = $2,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3`,
                [valorPago, transacaoResult.rows[0].id, id]
            );

            await client.query('COMMIT');

            res.json({
                success: true,
                message: 'Fatura paga com sucesso',
                data: {
                    fatura_id: id,
                    transacao_id: transacaoResult.rows[0].id,
                    valor_pago: valorPago
                }
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('❌ Erro ao pagar fatura:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao pagar fatura',
            error: error.message
        });
    }
});

export default router;
