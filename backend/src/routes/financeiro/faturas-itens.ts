import { Router, Response } from 'express';
import { pool } from '../../database/db';
import { requireAuth, AuthRequest } from '../../middleware/authMiddleware';

const router = Router();

// POST /api/financeiro/faturas-itens - Adicionar item à fatura (com suporte a parcelamento)
router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const {
            cartao_id,
            descricao,
            valor_total,
            data_compra,
            categoria_id,
            parcelas,
            observacoes
        } = req.body;

        // Validações
        if (!cartao_id || !descricao || !valor_total || !data_compra) {
            res.status(400).json({
                success: false,
                message: 'Cartão, descrição, valor e data são obrigatórios'
            });
            return;
        }

        // Verificar se cartão pertence ao usuário
        const cartaoResult = await pool.query(
            'SELECT * FROM financeiro.cartao WHERE id = $1 AND tenant_id = $2 AND is_deleted = false',
            [cartao_id, tenantId]
        );

        if (cartaoResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Cartão não encontrado'
            });
            return;
        }

        const cartao = cartaoResult.rows[0];
        const numeroParcelas = parseInt(parcelas) || 1;
        const valorParcela = parseFloat(valor_total) / numeroParcelas;
        const dataCompraObj = new Date(data_compra);

        // Gerar UUID para agrupar parcelas (usando pg)
        let parcelaGroupId: string | null = null;
        if (numeroParcelas > 1) {
            const uuidResult = await pool.query('SELECT uuid_generate_v4() AS uuid');
            parcelaGroupId = uuidResult.rows[0].uuid;
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const itensIds: string[] = [];

            // Criar item para cada parcela
            for (let i = 1; i <= numeroParcelas; i++) {
                // Calcular competência da parcela
                const mesCompra = dataCompraObj.getMonth();
                const anoCompra = dataCompraObj.getFullYear();
                const diaCompra = dataCompraObj.getDate();

                let mesCompetencia = mesCompra;
                let anoCompetencia = anoCompra;

                // Se compra foi após o fechamento, vai para próxima fatura
                if (diaCompra > cartao.dia_fechamento) {
                    mesCompetencia++;
                }

                // Adicionar meses conforme parcela
                mesCompetencia += (i - 1);

                // Ajustar ano se necessário
                while (mesCompetencia > 11) {
                    mesCompetencia -= 12;
                    anoCompetencia++;
                }

                const competencia = new Date(anoCompetencia, mesCompetencia, 1).toISOString().split('T')[0];

                // Calcular data de fechamento e vencimento
                const dataFechamento = new Date(anoCompetencia, mesCompetencia, cartao.dia_fechamento).toISOString().split('T')[0];
                const dataVencimento = new Date(anoCompetencia, mesCompetencia, cartao.dia_vencimento).toISOString().split('T')[0];

                // Buscar ou criar fatura
                let faturaResult = await client.query(
                    'SELECT id FROM financeiro.fatura WHERE cartao_id = $1 AND competencia = $2',
                    [cartao_id, competencia]
                );

                let faturaId;

                if (faturaResult.rows.length === 0) {
                    // Criar nova fatura
                    const novaFatura = await client.query(
                        `INSERT INTO financeiro.fatura 
                            (cartao_id, competencia, data_fechamento, data_vencimento, status)
                         VALUES ($1, $2, $3, $4, 'aberta')
                         RETURNING id`,
                        [cartao_id, competencia, dataFechamento, dataVencimento]
                    );
                    faturaId = novaFatura.rows[0].id;
                } else {
                    faturaId = faturaResult.rows[0].id;
                }

                // Inserir item
                const itemResult = await client.query(
                    `INSERT INTO financeiro.fatura_item 
                        (fatura_id, descricao, valor, data_compra, categoria_id, parcela_numero, parcela_total, parcela_group_id, observacoes)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                     RETURNING id`,
                    [
                        faturaId,
                        numeroParcelas > 1 ? `${descricao} (${i}/${numeroParcelas})` : descricao,
                        valorParcela,
                        data_compra,
                        categoria_id,
                        i,
                        numeroParcelas,
                        parcelaGroupId,
                        observacoes
                    ]
                );

                itensIds.push(itemResult.rows[0].id);
            }

            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                message: numeroParcelas > 1
                    ? `Compra parcelada em ${numeroParcelas}x criada com sucesso`
                    : 'Item adicionado à fatura com sucesso',
                data: {
                    itens_ids: itensIds,
                    parcela_group_id: parcelaGroupId,
                    total_parcelas: numeroParcelas
                }
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('❌ Erro ao adicionar item:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao adicionar item',
            error: error.message
        });
    }
});

// PUT /api/financeiro/faturas-itens/:id - Atualizar item
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const { id } = req.params;
        const { descricao, valor, categoria_id, observacoes } = req.body;

        // Verificar se item existe e pertence ao usuário
        const checkResult = await pool.query(
            `SELECT fi.*, f.cartao_id, c.tenant_id
             FROM financeiro.fatura_item fi
             JOIN financeiro.fatura f ON f.id = fi.fatura_id
             JOIN financeiro.cartao c ON c.id = f.cartao_id
             WHERE fi.id = $1 AND c.tenant_id = $2 AND fi.is_deleted = false`,
            [id, tenantId]
        );

        if (checkResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Item não encontrado'
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
        if (categoria_id !== undefined) {
            updates.push(`categoria_id = $${paramCounter++}`);
            values.push(categoria_id);
        }
        if (observacoes !== undefined) {
            updates.push(`observacoes = $${paramCounter++}`);
            values.push(observacoes);
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);

        const result = await pool.query(
            `UPDATE financeiro.fatura_item 
             SET ${updates.join(', ')}
             WHERE id = $${paramCounter++}
             RETURNING *`,
            values
        );

        res.json({
            success: true,
            message: 'Item atualizado com sucesso',
            data: result.rows[0]
        });
    } catch (error: any) {
        console.error('❌ Erro ao atualizar item:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar item',
            error: error.message
        });
    }
});

// DELETE /api/financeiro/faturas-itens/:id - Deletar item (soft delete)
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tenantId = req.user!.id;
        const { id } = req.params;

        const checkResult = await pool.query(
            `SELECT fi.*, f.status, c.tenant_id
             FROM financeiro.fatura_item fi
             JOIN financeiro.fatura f ON f.id = fi.fatura_id
             JOIN financeiro.cartao c ON c.id = f.cartao_id
             WHERE fi.id = $1 AND c.tenant_id = $2`,
            [id, tenantId]
        );

        if (checkResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Item não encontrado'
            });
            return;
        }

        if (checkResult.rows[0].status === 'paga') {
            res.status(400).json({
                success: false,
                message: 'Não é possível deletar item de fatura paga'
            });
            return;
        }

        await pool.query(
            'UPDATE financeiro.fatura_item SET is_deleted = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [id]
        );

        res.json({
            success: true,
            message: 'Item excluído com sucesso'
        });
    } catch (error: any) {
        console.error('❌ Erro ao deletar item:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao deletar item',
            error: error.message
        });
    }
});

export default router;
