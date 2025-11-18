import { Router, Request, Response } from 'express';
import { pool } from '../database/db';
import { logActivity } from '../services/activityLogger';
import { formatErrorResponse } from '../utils/errorTranslator';

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

// GET - Buscar custos de todos os produtos com receitas
receitaProdutoRouter.get('/custos/calcular', async (req: Request, res: Response) => {
    try {
        console.log('🔍 Buscando custos dos produtos...');
        
        // DEBUG: Ver dados brutos da receita
        const debugReceita = await pool.query(`
            SELECT rp.sku_produto, rp.sku_mp, rp.quantidade_por_produto, rp.unidade_medida as receita_um,
                   mp.nome as mp_nome, mp.unidade_medida as mp_um, mp.custo_unitario
            FROM obsidian.receita_produto rp
            LEFT JOIN obsidian.materia_prima mp ON rp.sku_mp = mp.sku_mp
            WHERE rp.sku_produto = 'H427'
        `);
        console.log('🔍 DEBUG RECEITA (H427):', JSON.stringify(debugReceita.rows, null, 2));
        
        const result = await pool.query(`
            WITH base AS (
                SELECT 
                    rp.sku_produto,
                    rp.sku_mp,
                    rp.quantidade_por_produto,
                    rp.unidade_medida AS rp_um_raw,
                    -- normaliza RP UM
                    CASE 
                        WHEN rp.unidade_medida ILIKE 'm%' THEN 'M'
                        WHEN rp.unidade_medida ILIKE 'cm%' THEN 'CM'
                        ELSE UPPER(TRIM(COALESCE(rp.unidade_medida,'')))
                    END AS rp_um,
                    p.nome AS nome_produto,
                    p.categoria,
                    p.unidade_medida,
                    p.preco_unitario,
                    mp.nome AS mp_nome,
                    mp.unidade_medida AS mp_um_raw,
                    -- normaliza MP UM
                    CASE 
                        WHEN mp.unidade_medida ILIKE 'm%' THEN 'M'
                        WHEN mp.unidade_medida ILIKE 'cm%' THEN 'CM'
                        ELSE UPPER(TRIM(COALESCE(mp.unidade_medida,'')))
                    END AS mp_um,
                    COALESCE(mp.custo_unitario,0) AS mp_custo
                FROM obsidian.receita_produto rp
                LEFT JOIN obsidian.produtos p ON rp.sku_produto = p.sku
                LEFT JOIN obsidian.materia_prima mp ON rp.sku_mp = mp.sku_mp
            ), calc AS (
                SELECT 
                    sku_produto,
                    nome_produto,
                    categoria,
                    unidade_medida,
                    preco_unitario,
                    SUM(
                        CASE 
                            WHEN mp_um = 'M' AND rp_um = 'CM' THEN (quantidade_por_produto / 100.0) * mp_custo
                            WHEN mp_um = 'CM' AND rp_um = 'M' THEN (quantidade_por_produto * 100.0) * mp_custo
                            ELSE quantidade_por_produto * mp_custo
                        END
                    ) AS custo_total_producao,
                    json_agg(
                        json_build_object(
                            'sku_mp', sku_mp,
                            'nome_mp', COALESCE(mp_nome, sku_mp),
                            'quantidade', quantidade_por_produto,
                            'unidade_medida', rp_um,
                            'um_mp', mp_um,
                            'custo_unitario_mp', mp_custo,
                            'unit_price_effective', mp_custo,
                            'preco_por_100', (
                                CASE 
                                    WHEN mp_um = 'M' AND rp_um = 'CM' THEN mp_custo
                                    WHEN mp_um = 'CM' AND rp_um = 'M' THEN mp_custo * 100.0
                                    ELSE mp_custo
                                END
                            ),
                            'custo_total_item', (
                                CASE 
                                    WHEN mp_um = 'M' AND rp_um = 'CM' THEN (quantidade_por_produto / 100.0) * mp_custo
                                    WHEN mp_um = 'CM' AND rp_um = 'M' THEN (quantidade_por_produto * 100.0) * mp_custo
                                    ELSE quantidade_por_produto * mp_custo
                                END
                            )
                        ) ORDER BY COALESCE(mp_nome, sku_mp)
                    ) AS materias_primas
                FROM base
                GROUP BY sku_produto, nome_produto, categoria, unidade_medida, preco_unitario
            )
            SELECT * FROM calc
            ORDER BY nome_produto NULLS LAST, sku_produto;
        `);

        console.log(`✅ Encontrados ${result.rows.length} produtos com receitas`);
        console.log('📦 Amostra:', JSON.stringify(result.rows[0], null, 2));
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Erro ao buscar custos dos produtos:', error);
        res.status(500).json({ error: 'Erro ao calcular custos dos produtos' });
    }
});

// PUT - Atualizar preço de venda do produto
receitaProdutoRouter.put('/produto/:sku/preco', async (req: Request, res: Response) => {
    try {
        const { sku } = req.params;
        const { preco_unitario } = req.body;

        // Validações
        if (preco_unitario === undefined || preco_unitario === null) {
            return res.status(400).json({ error: 'preco_unitario é obrigatório' });
        }

        const preco = parseFloat(preco_unitario);
        if (isNaN(preco) || preco < 0) {
            return res.status(400).json({ error: 'preco_unitario deve ser um número positivo' });
        }

        // Verificar se o produto existe
        const checkResult = await pool.query(
            'SELECT sku, nome FROM obsidian.produtos WHERE sku = $1',
            [sku]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        const produto = checkResult.rows[0];

        // Atualizar o preço
        const updateResult = await pool.query(
            `UPDATE obsidian.produtos 
             SET preco_unitario = $1, atualizado_em = NOW()
             WHERE sku = $2
             RETURNING sku, nome, preco_unitario, atualizado_em`,
            [preco, sku]
        );

        // Log da atividade
        await logActivity({
            user_email: (req as any).user?.email || 'sistema',
            user_name: (req as any).user?.nome || 'Sistema',
            action: 'UPDATE',
            entity_type: 'produto',
            entity_id: sku,
            details: {
                campo: 'preco_unitario',
                valor_anterior: produto.preco_unitario,
                valor_novo: preco,
                nome_produto: produto.nome
            },
            ip_address: req.ip,
            user_agent: req.get('user-agent')
        });

        console.log(`✅ Preço do produto ${sku} atualizado: R$ ${preco}`);
        res.json({
            success: true,
            message: 'Preço atualizado com sucesso',
            produto: updateResult.rows[0]
        });
    } catch (error) {
        console.error('❌ Erro ao atualizar preço do produto:', error);
        res.status(500).json({ error: 'Erro ao atualizar preço do produto' });
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
            user_email: (req as any).user?.email || 'sistema@erp.local',
            user_name: (req as any).user?.nome || 'Sistema Automático',
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
        const errorResponse = formatErrorResponse(error, 'receita do produto');
        res.status(errorResponse.statusCode).json(errorResponse);
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
            user_email: (req as any).user?.email || 'sistema@erp.local',
            user_name: (req as any).user?.nome || 'Sistema Automático',
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

