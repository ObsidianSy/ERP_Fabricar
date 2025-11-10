import { Router, Request, Response } from 'express';
import { pool } from '../database/db';
import { logActivity } from '../services/activityLogger';

export const receitaProdutoRouter = Router();

// GET - Listar todas as receitas
receitaProdutoRouter.get('/', async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`
      SELECT 
        e.sku as sku_produto,
        e.nome as nome_produto,
        json_agg(
          json_build_object(
            'sku_mp', rp.sku_mp,
            'quantidade_por_produto', rp.quantidade_por_produto,
            'unidade_medida', rp.unidade_medida,
            'valor_unitario', rp.valor_unitario,
            'nome_materia_prima', COALESCE(mp.nome, rp.sku_mp)
          ) ORDER BY rp.id
        ) as items
      FROM obsidian.receita_produto rp
      JOIN obsidian.produtos e ON rp.sku_produto = e.sku
      LEFT JOIN obsidian.materia_prima mp ON rp.sku_mp = mp.sku_mp
      GROUP BY e.sku, e.nome
      ORDER BY e.nome
    `);

        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar receitas:', error);
        res.status(500).json({ error: 'Erro ao buscar receitas' });
    }
});

// GET - Buscar receita por SKU do produto
receitaProdutoRouter.get('/:sku', async (req: Request, res: Response) => {
    try {
        const { sku } = req.params;

        const result = await pool.query(`
      SELECT 
        rp.*,
        COALESCE(mp.nome, rp.sku_mp) as nome_materia_prima
      FROM obsidian.receita_produto rp
      LEFT JOIN obsidian.materia_prima mp ON rp.sku_mp = mp.sku_mp
      WHERE rp.sku_produto = $1
      ORDER BY rp.id
    `, [sku]);

        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar receita:', error);
        res.status(500).json({ error: 'Erro ao buscar receita' });
    }
});

// POST - Criar/atualizar receita de produto
receitaProdutoRouter.post('/', async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
        const { sku_produto, items } = req.body;

        if (!sku_produto || !items || items.length === 0) {
            console.error(`❌ Dados inválidos: sku_produto="${sku_produto}", items=${items?.length || 0}`);
            return res.status(400).json({ error: 'SKU do produto e itens são obrigatórios' });
        }

        await client.query('BEGIN');

        // Verificar se o produto existe, se não, criar um produto básico
        const produtoExiste = await client.query(
            'SELECT sku FROM obsidian.produtos WHERE sku = $1',
            [sku_produto]
        );

        if (produtoExiste.rows.length === 0) {
            console.log(`⚠️ Produto ${sku_produto} não existe. Criando produto básico...`);

            try {
                // Criar produto básico
                await client.query(
                    `INSERT INTO obsidian.produtos (sku, nome, categoria, tipo_produto, quantidade_atual, unidade_medida, preco_unitario)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        sku_produto,
                        `Produto ${sku_produto}`, // Nome temporário
                        'Geral', // Categoria padrão
                        'Fabricado', // Tipo padrão
                        0, // Quantidade inicial
                        'UN', // Unidade padrão
                        0 // Preço inicial
                    ]
                );

                console.log(`✅ Produto ${sku_produto} criado automaticamente`);
            } catch (insertError: any) {
                console.error(`❌ Erro ao criar produto ${sku_produto}:`, insertError.message);
                await client.query('ROLLBACK');
                return res.status(500).json({
                    error: 'Erro ao criar produto automaticamente',
                    details: insertError.message,
                    sku: sku_produto
                });
            }
        }

        // Remove receita anterior
        await client.query('DELETE FROM obsidian.receita_produto WHERE sku_produto = $1', [sku_produto]);

        // Insere nova receita
        for (const item of items) {
            // Validar se a matéria-prima existe
            const mpExiste = await client.query(
                'SELECT sku_mp FROM obsidian.materia_prima WHERE sku_mp = $1',
                [item.sku_mp]
            );

            if (mpExiste.rows.length === 0) {
                console.warn(`⚠️ Matéria-prima ${item.sku_mp} não encontrada para o produto ${sku_produto}`);
            }

            await client.query(
                `INSERT INTO obsidian.receita_produto (sku_produto, sku_mp, quantidade_por_produto, unidade_medida, valor_unitario)
         VALUES ($1, $2, $3, $4, $5)`,
                [sku_produto, item.sku_mp, item.quantidade_por_produto, item.unidade_medida, item.valor_unitario || 0]
            );
        }

        await client.query('COMMIT');

        // Registrar log de atividade
        await logActivity({
            user_email: req.body.user_email || 'sistema',
            user_name: req.body.user_name || 'Sistema',
            action: 'receita_produto_criada_atualizada',
            entity_type: 'receita_produto',
            entity_id: sku_produto,
            details: {
                quantidade_itens: items.length,
                materias_primas: items.map((i: any) => i.sku_mp)
            }
        });

        res.status(201).json({ message: 'Receita salva com sucesso', sku_produto });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error(`❌ Erro ao salvar receita do produto ${req.body.sku_produto}:`, error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({
            error: 'Erro ao salvar receita',
            details: error.message,
            sku: req.body.sku_produto
        });
    } finally {
        client.release();
    }
});

// DELETE - Excluir receita de produto
receitaProdutoRouter.delete('/:sku', async (req: Request, res: Response) => {
    try {
        const { sku } = req.params;

        const result = await pool.query(
            'DELETE FROM obsidian.receita_produto WHERE sku_produto = $1 RETURNING *',
            [sku]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Receita não encontrada' });
        }

        // Registrar log de atividade
        await logActivity({
            user_email: req.body.user_email || 'sistema',
            user_name: req.body.user_name || 'Sistema',
            action: 'receita_produto_excluida',
            entity_type: 'receita_produto',
            entity_id: sku,
            details: {
                quantidade_itens_excluidos: result.rows.length
            }
        });

        res.json({ message: 'Receita excluída com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir receita:', error);
        res.status(500).json({ error: 'Erro ao excluir receita' });
    }
});
