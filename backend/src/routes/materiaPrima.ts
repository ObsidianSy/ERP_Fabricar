import { Router, Request, Response } from 'express';
import { pool } from '../database/db';
import { logActivity } from '../services/activityLogger';

export const materiaPrimaRouter = Router();

// GET - Listar todas as matérias-primas
materiaPrimaRouter.get('/', async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`
      SELECT * FROM obsidian.materia_prima
      ORDER BY criado_em DESC
    `);

        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar matérias-primas:', error);
        res.status(500).json({ error: 'Erro ao buscar matérias-primas' });
    }
});

// POST - Registrar entrada de matéria-prima
materiaPrimaRouter.post('/entrada', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        const { sku_mp, quantidade, observacao, origem_id } = req.body;

        if (!sku_mp || quantidade === undefined) {
            return res.status(400).json({ error: 'SKU (sku_mp) e quantidade são obrigatórios' });
        }

        const q = Number(quantidade);
        if (isNaN(q) || q <= 0) {
            return res.status(400).json({ error: 'Quantidade deve ser número maior que zero' });
        }

        await client.query('BEGIN');

        // Verificar se matéria-prima existe
        const mpCheck = await client.query(
            'SELECT sku_mp, nome, quantidade_atual FROM obsidian.materia_prima WHERE sku_mp = $1',
            [sku_mp]
        );

        if (mpCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Matéria-prima não encontrada' });
        }

        const saldoAnterior = Number(mpCheck.rows[0].quantidade_atual || 0);

        // Atualizar quantidade
        const updateResult = await client.query(
            `UPDATE obsidian.materia_prima
             SET quantidade_atual = quantidade_atual + $1,
                 atualizado_em = NOW()
             WHERE sku_mp = $2
             RETURNING sku_mp, nome, quantidade_atual`,
            [q, sku_mp]
        );

        // Registrar movimento de estoque (usar sku_mp como sku)
        await client.query(
            `INSERT INTO obsidian.estoque_movimentos (sku, tipo, quantidade, origem_tabela, origem_id, observacao)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [sku_mp, 'entrada_mp', q, 'materia_prima', origem_id || null, observacao || null]
        );

        await client.query('COMMIT');

        // Log de atividade
        await logActivity({
            user_email: (req as any).user?.email || req.body.user_email || 'sistema',
            user_name: (req as any).user?.nome || req.body.user_name || 'Sistema',
            action: 'entrada_materia_prima',
            entity_type: 'materia_prima',
            entity_id: sku_mp,
            details: {
                quantidade_adicionada: q,
                saldo_anterior: saldoAnterior,
                saldo_atual: Number(updateResult.rows[0].quantidade_atual)
            }
        });

        res.json({
            success: true,
            message: 'Entrada de matéria-prima registrada com sucesso',
            sku_mp,
            quantidade: q,
            saldo_anterior: saldoAnterior,
            saldo_atual: Number(updateResult.rows[0].quantidade_atual)
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao registrar entrada de matéria-prima:', error);
        res.status(500).json({ error: 'Erro ao registrar entrada de matéria-prima' });
    } finally {
        client.release();
    }
});

// GET - Buscar matéria-prima por SKU
materiaPrimaRouter.get('/:sku', async (req: Request, res: Response) => {
    try {
        const { sku } = req.params;
        const result = await pool.query(
            'SELECT * FROM obsidian.materia_prima WHERE sku_mp = $1',
            [sku]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Matéria-prima não encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao buscar matéria-prima:', error);
        res.status(500).json({ error: 'Erro ao buscar matéria-prima' });
    }
});

// POST - Criar nova matéria-prima
materiaPrimaRouter.post('/', async (req: Request, res: Response) => {
    try {
        const { sku_mp, nome, categoria, quantidade_atual, unidade_medida, custo_unitario } = req.body;

        if (!sku_mp || !nome) {
            return res.status(400).json({ error: 'SKU e nome são obrigatórios' });
        }

        const result = await pool.query(
            `INSERT INTO obsidian.materia_prima (sku_mp, nome, categoria, quantidade_atual, unidade_medida, custo_unitario)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
            [sku_mp, nome, categoria, quantidade_atual || 0, unidade_medida || 'UN', custo_unitario || 0]
        );

        // Registrar log de atividade
        await logActivity({
            user_email: (req as any).user?.email || req.body.user_email || 'sistema',
            user_name: (req as any).user?.nome || req.body.user_name || 'Sistema',
            action: 'materia_prima_criada',
            entity_type: 'materia_prima',
            entity_id: sku_mp,
            details: {
                nome,
                categoria,
                quantidade_inicial: quantidade_atual || 0,
                custo_unitario: custo_unitario || 0
            }
        });

        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        console.error('Erro ao criar matéria-prima:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Matéria-prima já existe' });
        }
        res.status(500).json({ error: 'Erro ao criar matéria-prima' });
    }
});

// PUT - Atualizar matéria-prima (upsert)
materiaPrimaRouter.put('/:sku', async (req: Request, res: Response) => {
    try {
        const { sku } = req.params;
        const { nome, categoria, quantidade_atual, unidade_medida, custo_unitario } = req.body;

        // Buscar dados anteriores para comparação
        const mpAnterior = await pool.query(
            'SELECT * FROM obsidian.materia_prima WHERE sku_mp = $1',
            [sku]
        );

        const isUpdate = mpAnterior.rows.length > 0;

        const result = await pool.query(
            `INSERT INTO obsidian.materia_prima (sku_mp, nome, categoria, quantidade_atual, unidade_medida, custo_unitario)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (sku_mp) 
       DO UPDATE SET 
         nome = EXCLUDED.nome,
         categoria = EXCLUDED.categoria,
         quantidade_atual = EXCLUDED.quantidade_atual,
         unidade_medida = EXCLUDED.unidade_medida,
         custo_unitario = EXCLUDED.custo_unitario,
         atualizado_em = now()
       RETURNING *`,
            [sku, nome, categoria, quantidade_atual, unidade_medida, custo_unitario]
        );

        // Registrar log de atividade
        const logDetails: any = {
            nome,
            categoria,
            quantidade_atual,
            custo_unitario
        };

        if (isUpdate) {
            logDetails.quantidade_anterior = mpAnterior.rows[0].quantidade_atual;
            logDetails.diferenca_quantidade = parseFloat(quantidade_atual) - parseFloat(mpAnterior.rows[0].quantidade_atual);
        }

        await logActivity({
            user_email: (req as any).user?.email || req.body.user_email || 'sistema',
            user_name: (req as any).user?.nome || req.body.user_name || 'Sistema',
            action: isUpdate ? 'materia_prima_atualizada' : 'materia_prima_criada',
            entity_type: 'materia_prima',
            entity_id: sku,
            details: logDetails
        });

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar matéria-prima:', error);
        res.status(500).json({ error: 'Erro ao atualizar matéria-prima' });
    }
});

// DELETE - Excluir matéria-prima
materiaPrimaRouter.delete('/:sku', async (req: Request, res: Response) => {
    try {
        const { sku } = req.params;

        const result = await pool.query(
            'DELETE FROM obsidian.materia_prima WHERE sku_mp = $1 RETURNING *',
            [sku]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Matéria-prima não encontrada' });
        }

        const mpExcluida = result.rows[0];

        // Registrar log de atividade
        await logActivity({
            user_email: (req as any).user?.email || req.body.user_email || 'sistema',
            user_name: (req as any).user?.nome || req.body.user_name || 'Sistema',
            action: 'materia_prima_excluida',
            entity_type: 'materia_prima',
            entity_id: sku,
            details: {
                nome: mpExcluida.nome,
                categoria: mpExcluida.categoria,
                quantidade_final: mpExcluida.quantidade_atual,
                custo_unitario: mpExcluida.custo_unitario
            }
        });

        res.json({ message: 'Matéria-prima excluída com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir matéria-prima:', error);
        res.status(500).json({ error: 'Erro ao excluir matéria-prima' });
    }
});

// POST - Registrar entrada de matéria-prima no estoque
materiaPrimaRouter.post('/entrada', async (req: Request, res: Response) => {
    try {
        const { sku_mp, quantidade, observacao } = req.body;

        if (!sku_mp || !quantidade) {
            return res.status(400).json({ error: 'SKU e quantidade são obrigatórios' });
        }

        if (quantidade <= 0) {
            return res.status(400).json({ error: 'Quantidade deve ser maior que zero' });
        }

        // Verificar se matéria-prima existe e buscar dados anteriores
        const mpCheck = await pool.query(
            'SELECT sku_mp, nome, quantidade_atual FROM obsidian.materia_prima WHERE sku_mp = $1',
            [sku_mp]
        );

        if (mpCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Matéria-prima não encontrada' });
        }

        const mp = mpCheck.rows[0];
        const saldoAnterior = parseFloat(mp.quantidade_atual);

        // Atualizar quantidade atual da matéria-prima
        const updateResult = await pool.query(
            `UPDATE obsidian.materia_prima 
             SET quantidade_atual = quantidade_atual + $1,
                 atualizado_em = NOW()
             WHERE sku_mp = $2
             RETURNING quantidade_atual`,
            [quantidade, sku_mp]
        );

        const saldoAtual = parseFloat(updateResult.rows[0].quantidade_atual);

        // Registrar log de atividade
        await logActivity({
            user_email: (req as any).user?.email || req.body.user_email || 'sistema',
            user_name: (req as any).user?.nome || req.body.user_name || 'Sistema',
            action: 'entrada_materia_prima',
            entity_type: 'materia_prima',
            entity_id: sku_mp,
            details: {
                nome: mp.nome,
                quantidade_entrada: parseFloat(quantidade),
                saldo_anterior: saldoAnterior,
                saldo_atual: saldoAtual,
                observacao
            }
        });

        res.json({
            success: true,
            message: 'Entrada registrada com sucesso',
            sku_mp,
            nome: mp.nome,
            quantidade_adicionada: parseFloat(quantidade),
            saldo_anterior: saldoAnterior,
            saldo_atual: saldoAtual
        });

    } catch (error) {
        console.error('Erro ao registrar entrada de matéria-prima:', error);
        res.status(500).json({ error: 'Erro ao registrar entrada de matéria-prima' });
    }
});

