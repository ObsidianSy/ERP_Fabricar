import { Router, Response } from 'express';
import { pool } from '../../database/db';
import { requireAuth, AuthRequest } from '../../middleware/authMiddleware';

const router = Router();

// ==================================================
// GET /api/financeiro/contas - Listar contas do usuário
// ==================================================
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id; // ID do usuário logado

        const result = await pool.query(
            `SELECT 
                c.id,
                c.nome,
                c.tipo,
                c.saldo_inicial,
                c.saldo_atual,
                c.banco,
                c.agencia,
                c.conta_numero,
                c.ativo,
                c.created_at,
                c.updated_at,
                COUNT(t.id) AS total_transacoes,
                COALESCE(SUM(CASE WHEN t.tipo = 'credito' AND t.status = 'liquidado' THEN t.valor ELSE 0 END), 0) AS total_creditos,
                COALESCE(SUM(CASE WHEN t.tipo = 'debito' AND t.status = 'liquidado' THEN t.valor ELSE 0 END), 0) AS total_debitos
            FROM financeiro.conta c
            LEFT JOIN financeiro.transacao t ON t.conta_id = c.id
            WHERE c.tenant_id = $1 AND c.is_deleted = false
            GROUP BY c.id
            ORDER BY c.ativo DESC, c.nome ASC`,
            [tenantId]
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error: any) {
        console.error('❌ Erro ao listar contas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar contas',
            error: error.message
        });
    }
});

// ==================================================
// GET /api/financeiro/contas/:id - Buscar conta específica
// ==================================================
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const { id } = req.params;

        const result = await pool.query(
            `SELECT * FROM financeiro.conta 
             WHERE id = $1 AND tenant_id = $2 AND is_deleted = false`,
            [id, tenantId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Conta não encontrada'
            });
            return;
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error: any) {
        console.error('❌ Erro ao buscar conta:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar conta',
            error: error.message
        });
    }
});

// ==================================================
// POST /api/financeiro/contas - Criar nova conta
// ==================================================
router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const { nome, tipo, saldo_inicial, banco, agencia, conta_numero } = req.body;

        // Validações
        if (!nome || !tipo) {
            res.status(400).json({
                success: false,
                message: 'Nome e tipo são obrigatórios'
            });
            return;
        }

        const tiposValidos = ['corrente', 'poupanca', 'investimento', 'dinheiro', 'carteira'];
        if (!tiposValidos.includes(tipo)) {
            res.status(400).json({
                success: false,
                message: `Tipo inválido. Use: ${tiposValidos.join(', ')}`
            });
            return;
        }

        const saldoInicial = parseFloat(saldo_inicial) || 0;

        const result = await pool.query(
            `INSERT INTO financeiro.conta 
                (tenant_id, nome, tipo, saldo_inicial, saldo_atual, banco, agencia, conta_numero)
             VALUES ($1, $2, $3, $4, $4, $5, $6, $7)
             RETURNING *`,
            [tenantId, nome, tipo, saldoInicial, banco, agencia, conta_numero]
        );

        res.status(201).json({
            success: true,
            message: 'Conta criada com sucesso',
            data: result.rows[0]
        });
    } catch (error: any) {
        console.error('❌ Erro ao criar conta:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar conta',
            error: error.message
        });
    }
});

// ==================================================
// PUT /api/financeiro/contas/:id - Atualizar conta
// ==================================================
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const { id } = req.params;
        const { nome, tipo, saldo_inicial, banco, agencia, conta_numero, ativo } = req.body;

        // Verificar se conta existe e pertence ao usuário
        const checkResult = await pool.query(
            'SELECT * FROM financeiro.conta WHERE id = $1 AND tenant_id = $2 AND is_deleted = false',
            [id, tenantId]
        );

        if (checkResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Conta não encontrada'
            });
            return;
        }

        // Validar tipo se fornecido
        if (tipo) {
            const tiposValidos = ['corrente', 'poupanca', 'investimento', 'dinheiro', 'carteira'];
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
        if (saldo_inicial !== undefined) {
            const saldoAtual = checkResult.rows[0].saldo_atual;
            const saldoAnterior = checkResult.rows[0].saldo_inicial;
            const diferenca = parseFloat(saldo_inicial) - saldoAnterior;

            updates.push(`saldo_inicial = $${paramCounter++}`);
            values.push(parseFloat(saldo_inicial));

            updates.push(`saldo_atual = $${paramCounter++}`);
            values.push(saldoAtual + diferenca);
        }
        if (banco !== undefined) {
            updates.push(`banco = $${paramCounter++}`);
            values.push(banco);
        }
        if (agencia !== undefined) {
            updates.push(`agencia = $${paramCounter++}`);
            values.push(agencia);
        }
        if (conta_numero !== undefined) {
            updates.push(`conta_numero = $${paramCounter++}`);
            values.push(conta_numero);
        }
        if (ativo !== undefined) {
            updates.push(`ativo = $${paramCounter++}`);
            values.push(ativo);
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);

        values.push(id, tenantId);

        const result = await pool.query(
            `UPDATE financeiro.conta 
             SET ${updates.join(', ')}
             WHERE id = $${paramCounter++} AND tenant_id = $${paramCounter++}
             RETURNING *`,
            values
        );

        res.json({
            success: true,
            message: 'Conta atualizada com sucesso',
            data: result.rows[0]
        });
    } catch (error: any) {
        console.error('❌ Erro ao atualizar conta:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar conta',
            error: error.message
        });
    }
});

// ==================================================
// DELETE /api/financeiro/contas/:id - Deletar conta (soft delete)
// ==================================================
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const { id } = req.params;

        // Verificar se há transações ativas
        const transacoesResult = await pool.query(
            `SELECT COUNT(*) as total 
             FROM financeiro.transacao 
             WHERE conta_id = $1 AND status = 'liquidado'`,
            [id]
        );

        const totalTransacoes = parseInt(transacoesResult.rows[0].total);

        if (totalTransacoes > 0) {
            res.status(400).json({
                success: false,
                message: `Não é possível excluir conta com ${totalTransacoes} transações liquidadas. Desative a conta ao invés de excluir.`
            });
            return;
        }

        const result = await pool.query(
            `UPDATE financeiro.conta 
             SET is_deleted = true, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND tenant_id = $2
             RETURNING id`,
            [id, tenantId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Conta não encontrada'
            });
            return;
        }

        res.json({
            success: true,
            message: 'Conta excluída com sucesso'
        });
    } catch (error: any) {
        console.error('❌ Erro ao deletar conta:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao deletar conta',
            error: error.message
        });
    }
});

// ==================================================
// GET /api/financeiro/contas/:id/extrato - Extrato da conta
// ==================================================
router.get('/:id/extrato', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const { id } = req.params;
        const { data_inicio, data_fim, status } = req.query;

        // Verificar se conta pertence ao usuário
        const contaResult = await pool.query(
            'SELECT * FROM financeiro.conta WHERE id = $1 AND tenant_id = $2 AND is_deleted = false',
            [id, tenantId]
        );

        if (contaResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Conta não encontrada'
            });
            return;
        }

        // Montar query de extrato
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
                cat.nome AS categoria_nome,
                t.observacoes,
                t.created_at
            FROM financeiro.transacao t
            LEFT JOIN financeiro.categoria cat ON cat.id = t.categoria_id
            WHERE t.conta_id = $1
        `;

        const params: any[] = [id];
        let paramCounter = 2;

        if (data_inicio) {
            query += ` AND t.data_transacao >= $${paramCounter++}`;
            params.push(data_inicio);
        }

        if (data_fim) {
            query += ` AND t.data_transacao <= $${paramCounter++}`;
            params.push(data_fim);
        }

        if (status) {
            query += ` AND t.status = $${paramCounter++}`;
            params.push(status);
        }

        query += ' ORDER BY t.data_transacao DESC, t.created_at DESC';

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: {
                conta: contaResult.rows[0],
                transacoes: result.rows
            }
        });
    } catch (error: any) {
        console.error('❌ Erro ao buscar extrato:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar extrato',
            error: error.message
        });
    }
});

export default router;
