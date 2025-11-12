import { Router, Response } from 'express';
import { pool } from '../../database/db';
import { requireAuth, AuthRequest } from '../../middleware/authMiddleware';

const router = Router();

// ==================================================
// GET /api/financeiro/cartoes - Listar cartões do usuário
// ==================================================
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;

        const result = await pool.query(
            `SELECT 
                c.id,
                c.apelido,
                c.bandeira,
                c.ultimos_digitos,
                c.limite,
                c.dia_fechamento,
                c.dia_vencimento,
                c.conta_pagamento_id,
                ct.nome AS conta_pagamento_nome,
                c.ativo,
                c.created_at,
                c.updated_at,
                COUNT(DISTINCT f.id) FILTER (WHERE f.status IN ('aberta', 'fechada')) AS faturas_abertas,
                COALESCE(SUM(CASE WHEN f.status IN ('aberta', 'fechada') THEN f.valor_total ELSE 0 END), 0) AS limite_utilizado
            FROM financeiro.cartao c
            LEFT JOIN financeiro.conta ct ON ct.id = c.conta_pagamento_id
            LEFT JOIN financeiro.fatura f ON f.cartao_id = c.id
            WHERE c.tenant_id = $1 AND c.is_deleted = false
            GROUP BY c.id, ct.nome
            ORDER BY c.ativo DESC, c.apelido ASC`,
            [tenantId]
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error: any) {
        console.error('❌ Erro ao listar cartões:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar cartões',
            error: error.message
        });
    }
});

// ==================================================
// GET /api/financeiro/cartoes/:id - Buscar cartão específico
// ==================================================
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const { id } = req.params;

        const result = await pool.query(
            `SELECT c.*, ct.nome AS conta_pagamento_nome
             FROM financeiro.cartao c
             LEFT JOIN financeiro.conta ct ON ct.id = c.conta_pagamento_id
             WHERE c.id = $1 AND c.tenant_id = $2 AND c.is_deleted = false`,
            [id, tenantId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Cartão não encontrado'
            });
            return;
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error: any) {
        console.error('❌ Erro ao buscar cartão:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar cartão',
            error: error.message
        });
    }
});

// ==================================================
// POST /api/financeiro/cartoes - Criar novo cartão
// ==================================================
router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const {
            apelido,
            bandeira,
            ultimos_digitos,
            limite,
            dia_fechamento,
            dia_vencimento,
            conta_pagamento_id
        } = req.body;

        // Validações
        if (!apelido) {
            res.status(400).json({
                success: false,
                message: 'Apelido é obrigatório'
            });
            return;
        }

        if (!dia_fechamento || !dia_vencimento) {
            res.status(400).json({
                success: false,
                message: 'Dia de fechamento e vencimento são obrigatórios'
            });
            return;
        }

        if (dia_vencimento <= dia_fechamento) {
            res.status(400).json({
                success: false,
                message: 'Dia de vencimento deve ser maior que dia de fechamento'
            });
            return;
        }

        // Validar conta de pagamento se fornecida
        if (conta_pagamento_id) {
            const contaResult = await pool.query(
                'SELECT id FROM financeiro.conta WHERE id = $1 AND tenant_id = $2 AND is_deleted = false',
                [conta_pagamento_id, tenantId]
            );

            if (contaResult.rows.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'Conta de pagamento inválida'
                });
                return;
            }
        }

        const limiteValue = parseFloat(limite) || 0;

        const result = await pool.query(
            `INSERT INTO financeiro.cartao 
                (tenant_id, apelido, bandeira, ultimos_digitos, limite, dia_fechamento, dia_vencimento, conta_pagamento_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [tenantId, apelido, bandeira, ultimos_digitos, limiteValue, dia_fechamento, dia_vencimento, conta_pagamento_id]
        );

        res.status(201).json({
            success: true,
            message: 'Cartão criado com sucesso',
            data: result.rows[0]
        });
    } catch (error: any) {
        console.error('❌ Erro ao criar cartão:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar cartão',
            error: error.message
        });
    }
});

// ==================================================
// PUT /api/financeiro/cartoes/:id - Atualizar cartão
// ==================================================
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const { id } = req.params;
        const {
            apelido,
            bandeira,
            ultimos_digitos,
            limite,
            dia_fechamento,
            dia_vencimento,
            conta_pagamento_id,
            ativo
        } = req.body;

        // Verificar se cartão existe
        const checkResult = await pool.query(
            'SELECT * FROM financeiro.cartao WHERE id = $1 AND tenant_id = $2 AND is_deleted = false',
            [id, tenantId]
        );

        if (checkResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Cartão não encontrado'
            });
            return;
        }

        // Validar dias se fornecidos
        const novoFechamento = dia_fechamento !== undefined ? dia_fechamento : checkResult.rows[0].dia_fechamento;
        const novoVencimento = dia_vencimento !== undefined ? dia_vencimento : checkResult.rows[0].dia_vencimento;

        if (novoVencimento <= novoFechamento) {
            res.status(400).json({
                success: false,
                message: 'Dia de vencimento deve ser maior que dia de fechamento'
            });
            return;
        }

        // Validar conta de pagamento se fornecida
        if (conta_pagamento_id) {
            const contaResult = await pool.query(
                'SELECT id FROM financeiro.conta WHERE id = $1 AND tenant_id = $2 AND is_deleted = false',
                [conta_pagamento_id, tenantId]
            );

            if (contaResult.rows.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'Conta de pagamento inválida'
                });
                return;
            }
        }

        // Atualizar apenas campos fornecidos
        const updates: string[] = [];
        const values: any[] = [];
        let paramCounter = 1;

        if (apelido !== undefined) {
            updates.push(`apelido = $${paramCounter++}`);
            values.push(apelido);
        }
        if (bandeira !== undefined) {
            updates.push(`bandeira = $${paramCounter++}`);
            values.push(bandeira);
        }
        if (ultimos_digitos !== undefined) {
            updates.push(`ultimos_digitos = $${paramCounter++}`);
            values.push(ultimos_digitos);
        }
        if (limite !== undefined) {
            updates.push(`limite = $${paramCounter++}`);
            values.push(parseFloat(limite));
        }
        if (dia_fechamento !== undefined) {
            updates.push(`dia_fechamento = $${paramCounter++}`);
            values.push(dia_fechamento);
        }
        if (dia_vencimento !== undefined) {
            updates.push(`dia_vencimento = $${paramCounter++}`);
            values.push(dia_vencimento);
        }
        if (conta_pagamento_id !== undefined) {
            updates.push(`conta_pagamento_id = $${paramCounter++}`);
            values.push(conta_pagamento_id);
        }
        if (ativo !== undefined) {
            updates.push(`ativo = $${paramCounter++}`);
            values.push(ativo);
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);

        values.push(id, tenantId);

        const result = await pool.query(
            `UPDATE financeiro.cartao 
             SET ${updates.join(', ')}
             WHERE id = $${paramCounter++} AND tenant_id = $${paramCounter++}
             RETURNING *`,
            values
        );

        res.json({
            success: true,
            message: 'Cartão atualizado com sucesso',
            data: result.rows[0]
        });
    } catch (error: any) {
        console.error('❌ Erro ao atualizar cartão:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar cartão',
            error: error.message
        });
    }
});

// ==================================================
// DELETE /api/financeiro/cartoes/:id - Deletar cartão (soft delete)
// ==================================================
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const { id } = req.params;

        // Verificar se há faturas abertas
        const faturasResult = await pool.query(
            `SELECT COUNT(*) as total 
             FROM financeiro.fatura 
             WHERE cartao_id = $1 AND status IN ('aberta', 'fechada')`,
            [id]
        );

        const totalFaturas = parseInt(faturasResult.rows[0].total);

        if (totalFaturas > 0) {
            res.status(400).json({
                success: false,
                message: `Não é possível excluir cartão com ${totalFaturas} fatura(s) aberta(s). Desative o cartão ao invés de excluir.`
            });
            return;
        }

        const result = await pool.query(
            `UPDATE financeiro.cartao 
             SET is_deleted = true, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND tenant_id = $2
             RETURNING id`,
            [id, tenantId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Cartão não encontrado'
            });
            return;
        }

        res.json({
            success: true,
            message: 'Cartão excluído com sucesso'
        });
    } catch (error: any) {
        console.error('❌ Erro ao deletar cartão:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao deletar cartão',
            error: error.message
        });
    }
});

export default router;
