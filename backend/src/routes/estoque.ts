import { Router, Request, Response } from 'express';
import { pool } from '../database/db';
import { logActivity } from '../services/activityLogger';

export const estoqueRouter = Router();

// GET - Listar todos os produtos
estoqueRouter.get('/', async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`
      SELECT 
        e.id,
        e.sku,
        e.nome,
        e.categoria,
        e.tipo_produto,
        e.quantidade_atual,
        e.unidade_medida,
        e.preco_unitario,
        e.ativo,
        e.criado_em,
        e.atualizado_em,
        e.kit_bom,
        e.is_kit,
        e.kit_bom_hash,
        COALESCE(
          json_agg(
            json_build_object(
              'sku_componente', ck.component_sku,
              'quantidade_por_kit', ck.qty
            )
          ) FILTER (WHERE ck.component_sku IS NOT NULL), '[]'
        ) as componentes
      FROM obsidian.produtos e
      LEFT JOIN obsidian.kit_components ck ON e.sku = ck.kit_sku
      GROUP BY e.id, e.sku, e.nome, e.categoria, e.tipo_produto, e.quantidade_atual, e.unidade_medida, e.preco_unitario, e.ativo, e.criado_em, e.atualizado_em, e.kit_bom, e.is_kit, e.kit_bom_hash
      ORDER BY e.criado_em DESC
    `);

        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar estoque:', error);
        res.status(500).json({ error: 'Erro ao buscar estoque' });
    }
});

// GET - Buscar produto por SKU
estoqueRouter.get('/:sku', async (req: Request, res: Response) => {
    try {
        const { sku } = req.params;

        const produtoResult = await pool.query(
            'SELECT * FROM obsidian.produtos WHERE sku = $1',
            [sku]
        );

        if (produtoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        const componentesResult = await pool.query(
            `SELECT 
                component_sku as sku_componente,
                qty as quantidade_por_kit
             FROM obsidian.kit_components 
             WHERE kit_sku = $1`,
            [sku]
        );

        const produto = {
            ...produtoResult.rows[0],
            componentes: componentesResult.rows
        };

        res.json(produto);
    } catch (error) {
        console.error('Erro ao buscar produto:', error);
        res.status(500).json({ error: 'Erro ao buscar produto' });
    }
});

// POST - Criar novo produto
estoqueRouter.post('/', async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
        const { sku, nome_produto, categoria, tipo_produto, quantidade_atual, unidade_medida, preco_unitario, componentes } = req.body;

        if (!sku || !nome_produto) {
            return res.status(400).json({ error: 'SKU e Nome são obrigatórios' });
        }

        await client.query('BEGIN');

        // Determinar se é kit baseado em componentes OU tipo_produto
        const isKit = (componentes && componentes.length > 0) || tipo_produto === 'KIT';

        // Insere produto (com is_kit)
        const produtoResult = await client.query(
            `INSERT INTO obsidian.produtos (sku, nome, categoria, tipo_produto, quantidade_atual, unidade_medida, preco_unitario)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
            [sku, nome_produto, categoria, tipo_produto, quantidade_atual || 0, unidade_medida, preco_unitario || 0, isKit]
        );

        // Insere componentes se for kit
        if (componentes && componentes.length > 0) {
            for (const comp of componentes) {
                // Verificar se componente existe
                const componenteExists = await client.query(
                    'SELECT sku FROM obsidian.produtos WHERE sku = $1',
                    [comp.sku_componente]
                );

                if (componenteExists.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        error: `Componente ${comp.sku_componente} não existe no estoque. Cadastre-o primeiro.`
                    });
                }

                await client.query(
                    `INSERT INTO obsidian.kit_components (kit_sku, component_sku, qty)
           VALUES ($1, $2, $3)`,
                    [sku, comp.sku_componente, comp.quantidade_por_kit]
                );
            }
        }

        await client.query('COMMIT');

        // Registrar log de atividade
        await logActivity({
            user_email: (req as any).user?.email || req.body.user_email || 'sistema',
            user_name: (req as any).user?.nome || req.body.user_name || 'Sistema',
            action: 'produto_criado',
            entity_type: 'produto',
            entity_id: sku,
            details: {
                nome: nome_produto,
                categoria,
                tipo_produto,
                quantidade_inicial: quantidade_atual || 0,
                preco_unitario: preco_unitario || 0,
                is_kit: isKit,
                componentes: componentes?.length || 0
            }
        });

        res.status(201).json(produtoResult.rows[0]);
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Erro ao criar produto:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Produto já existe' });
        }
        res.status(500).json({ error: 'Erro ao criar produto', details: error.message });
    } finally {
        client.release();
    }
});

// PUT - Atualizar produto (upsert)
estoqueRouter.put('/:sku', async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
        const { sku } = req.params;
        const { nome_produto, categoria, tipo_produto, quantidade_atual, unidade_medida, preco_unitario, componentes } = req.body;

        await client.query('BEGIN');

        // Determinar se é kit baseado em componentes OU tipo_produto
        const isKit = (componentes && componentes.length > 0) || tipo_produto === 'KIT';

        // Upsert produto (com is_kit)
        const produtoResult = await client.query(
            `INSERT INTO obsidian.produtos (sku, nome, categoria, tipo_produto, quantidade_atual, unidade_medida, preco_unitario)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (sku) 
       DO UPDATE SET 
         nome = EXCLUDED.nome,
         categoria = EXCLUDED.categoria,
         tipo_produto = EXCLUDED.tipo_produto,
         quantidade_atual = EXCLUDED.quantidade_atual,
         unidade_medida = EXCLUDED.unidade_medida,
         preco_unitario = EXCLUDED.preco_unitario,
         atualizado_em = NOW()
       RETURNING *`,
            [sku, nome_produto, categoria, tipo_produto, quantidade_atual, unidade_medida, preco_unitario]
        );

        // Atualiza componentes
        if (componentes !== undefined) {
            // Remove componentes antigos
            await client.query('DELETE FROM obsidian.kit_components WHERE kit_sku = $1', [sku]);

            // Insere novos componentes
            if (componentes.length > 0) {
                for (const comp of componentes) {
                    // Verificar se componente existe
                    const componenteExists = await client.query(
                        'SELECT sku FROM obsidian.produtos WHERE sku = $1',
                        [comp.sku_componente]
                    );

                    if (componenteExists.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({
                            error: `Componente ${comp.sku_componente} não existe no estoque. Cadastre-o primeiro.`
                        });
                    }

                    await client.query(
                        `INSERT INTO obsidian.kit_components (kit_sku, component_sku, qty)
           VALUES ($1, $2, $3)`,
                        [sku, comp.sku_componente, comp.quantidade_por_kit]
                    );
                }
            }
        }

        await client.query('COMMIT');

        res.json(produtoResult.rows[0]);
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Erro ao atualizar produto:', error);
        res.status(500).json({ error: 'Erro ao atualizar produto', details: error.message });
    } finally {
        client.release();
    }
});

// DELETE - Excluir produto (apaga receitas/dependências primeiro)
estoqueRouter.delete('/:sku', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        const { sku } = req.params;

        await client.query('BEGIN');

        // 1. Apagar dependências em receita_produto
        await client.query('DELETE FROM obsidian.receita_produto WHERE sku_produto = $1', [sku]);

        // 2. Apagar componentes de kit (se for kit)
        await client.query('DELETE FROM obsidian.kit_components WHERE kit_sku = $1', [sku]);

        // 3. Apagar o produto
        const result = await client.query(
            'DELETE FROM obsidian.produtos WHERE sku = $1 RETURNING *',
            [sku]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        const produtoExcluido = result.rows[0];

        // Registrar log de atividade
        try {
            await logActivity({
                user_email: (req as any).user?.email || 'sistema',
                user_name: (req as any).user?.nome || 'Sistema',
                action: 'produto_excluido',
                entity_type: 'produto',
                entity_id: sku,
                details: {
                    nome: produtoExcluido.nome,
                    categoria: produtoExcluido.categoria,
                    tipo_produto: produtoExcluido.tipo_produto,
                    quantidade_final: produtoExcluido.quantidade_atual
                }
            });
        } catch (logError) {
            console.warn('Erro ao registrar log (não bloqueia exclusão):', logError);
        }

        await client.query('COMMIT');
        console.log(`✅ Produto ${sku} excluído com sucesso`);
        res.json({ message: 'Produto excluído com sucesso', success: true });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('❌ Erro ao excluir produto:', error);
        res.status(500).json({ 
            error: 'Erro ao excluir produto',
            detail: error.message 
        });
    } finally {
        client.release();
    }
});

// POST - Registrar entrada de produto no estoque
estoqueRouter.post('/entrada', async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
        const { sku, quantidade, origem_tabela, origem_id, observacao, tipo_entrada } = req.body;

        if (!sku || !quantidade) {
            return res.status(400).json({ error: 'SKU e quantidade são obrigatórios' });
        }

        if (quantidade <= 0) {
            return res.status(400).json({ error: 'Quantidade deve ser maior que zero' });
        }

        await client.query('BEGIN');

        // Verificar se produto existe
        const produtoCheck = await client.query(
            'SELECT sku, nome, quantidade_atual FROM obsidian.produtos WHERE sku = $1',
            [sku]
        );

        if (produtoCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        const produto = produtoCheck.rows[0];
        const materiasAbatidas = [];

        // Apenas abate matérias-primas se for entrada por fabricação
        if (tipo_entrada === 'fabricacao' || !tipo_entrada) {
            // Buscar receita do produto
            const receitaResult = await client.query(
                'SELECT sku_mp, quantidade_por_produto, unidade_medida FROM obsidian.receita_produto WHERE sku_produto = $1',
                [sku]
            );

            if (receitaResult.rows.length > 0) {
                // Abater matérias-primas do estoque (permitindo saldo negativo)
                const alertasEstoqueNegativo = [];
                for (const item of receitaResult.rows) {
                    const quantidadeAbater = parseFloat(item.quantidade_por_produto) * quantidade;

                    const updateMp = await client.query(
                        `UPDATE obsidian.materia_prima 
                         SET quantidade_atual = quantidade_atual - $1,
                             atualizado_em = NOW()
                         WHERE sku_mp = $2
                         RETURNING sku_mp, nome, quantidade_atual`,
                        [quantidadeAbater, item.sku_mp]
                    );

                    if (updateMp.rows.length > 0) {
                        const saldoAtual = parseFloat(updateMp.rows[0].quantidade_atual);
                        materiasAbatidas.push({
                            sku_mp: item.sku_mp,
                            nome: updateMp.rows[0].nome,
                            quantidade_abatida: quantidadeAbater,
                            saldo_atual: saldoAtual
                        });

                        // Verificar se ficou negativo
                        if (saldoAtual < 0) {
                            alertasEstoqueNegativo.push({
                                sku_mp: item.sku_mp,
                                nome: updateMp.rows[0].nome,
                                saldo_negativo: saldoAtual
                            });
                        }
                    }
                }

            }
        }

        // Registrar movimento de estoque
        await client.query(
            `INSERT INTO obsidian.estoque_movimentos (sku, tipo, quantidade, origem_tabela, origem_id, observacao)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [sku, tipo_entrada || origem_tabela || 'manual', quantidade, origem_tabela || 'manual', origem_id, observacao]
        );

        // Atualizar quantidade atual do produto
        const updateResult = await client.query(
            `UPDATE obsidian.produtos 
             SET quantidade_atual = quantidade_atual + $1,
                 atualizado_em = NOW()
             WHERE sku = $2
             RETURNING quantidade_atual`,
            [quantidade, sku]
        );

        await client.query('COMMIT');

        const saldoAtual = updateResult.rows[0].quantidade_atual;

        const response: any = {
            success: true,
            message: 'Entrada registrada com sucesso',
            sku,
            nome_produto: produto.nome,
            quantidade_adicionada: quantidade,
            saldo_anterior: parseFloat(produto.quantidade_atual),
            saldo_atual: parseFloat(saldoAtual),
            tipo_entrada: tipo_entrada || 'fabricacao'
        };

        if (materiasAbatidas.length > 0) {
            response.materias_primas_abatidas = materiasAbatidas;

            // Adicionar alertas de estoque negativo se houver
            const materiasNegativas = materiasAbatidas.filter(mp => mp.saldo_atual < 0);
            if (materiasNegativas.length > 0) {
                response.alertas_estoque_negativo = materiasNegativas;
            }
        }

        // Registrar log de atividade
        await logActivity({
            user_email: (req as any).user?.email || req.body.user_email || 'sistema',
            user_name: (req as any).user?.nome || req.body.user_name || 'Sistema',
            action: 'entrada_produto',
            entity_type: 'produto',
            entity_id: sku,
            details: {
                nome: produto.nome,
                quantidade_entrada: quantidade,
                saldo_anterior: parseFloat(produto.quantidade_atual),
                saldo_atual: parseFloat(saldoAtual),
                tipo_entrada: tipo_entrada || 'fabricacao',
                materias_abatidas: materiasAbatidas.length,
                observacao
            }
        });

        res.json(response);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao registrar entrada:', error);
        res.status(500).json({ error: 'Erro ao registrar entrada de produto' });
    } finally {
        client.release();
    }
});

// PATCH - Atualizar quantidade do produto (entrada/saída manual)
estoqueRouter.patch('/:sku/quantidade', async (req: Request, res: Response) => {
    try {
        const { sku } = req.params;
        const { quantidade } = req.body;

        if (quantidade === undefined) {
            return res.status(400).json({ error: 'Quantidade é obrigatória' });
        }

        // Buscar quantidade anterior
        const produtoAnterior = await pool.query(
            'SELECT nome, quantidade_atual FROM obsidian.produtos WHERE sku = $1',
            [sku]
        );

        if (produtoAnterior.rows.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        const saldoAnterior = parseFloat(produtoAnterior.rows[0].quantidade_atual);

        const result = await pool.query(
            `UPDATE obsidian.produtos 
       SET quantidade_atual = $1
       WHERE sku = $2
       RETURNING *`,
            [quantidade, sku]
        );

        // Registrar log de atividade
        await logActivity({
            user_email: (req as any).user?.email || req.body.user_email || 'sistema',
            user_name: (req as any).user?.nome || req.body.user_name || 'Sistema',
            action: 'ajuste_quantidade_produto',
            entity_type: 'produto',
            entity_id: sku,
            details: {
                nome: produtoAnterior.rows[0].nome,
                quantidade_anterior: saldoAnterior,
                quantidade_nova: parseFloat(quantidade),
                diferenca: parseFloat(quantidade) - saldoAnterior
            }
        });

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar quantidade:', error);
        res.status(500).json({ error: 'Erro ao atualizar quantidade' });
    }
});

// POST - Buscar kit por composição (substitui webhook N8N)
estoqueRouter.post('/kits/find-by-composition', async (req: Request, res: Response) => {
    try {
        // Aceita tanto 'componentes' quanto 'components' (compatibilidade)
        const componentes = req.body.componentes || req.body.components;

        if (!componentes || !Array.isArray(componentes) || componentes.length === 0) {
            return res.status(400).json({ error: 'Componentes são obrigatórios' });
        }

        const componentSkus = componentes.map((c: any) => c.sku || c.sku_componente).filter(Boolean);

        if (componentSkus.length === 0) {
            return res.status(400).json({ error: 'SKUs de componentes inválidos' });
        }

        // Query para encontrar kits que contenham os componentes
        // Buscar no kit_bom (JSONB) ao invés de kit_components (que não existe)
        const result = await pool.query(
            `SELECT 
                p.sku as kit_sku,
                p.nome as kit_nome,
                p.preco_unitario as kit_preco,
                p.kit_bom as componentes_do_kit
            FROM obsidian.produtos p
            WHERE p.kit_bom IS NOT NULL
              AND jsonb_array_length(p.kit_bom) = $1
            ORDER BY p.sku
            LIMIT 50`,
            [componentSkus.length]
        );

        // Filtrar manualmente os kits que têm EXATAMENTE os componentes solicitados
        const kitsMatch = result.rows.filter(kit => {
            const kitComponents = kit.componentes_do_kit as any[];

            // Verificar se tem a mesma quantidade de componentes
            if (kitComponents.length !== componentSkus.length) return false;

            // Verificar se todos os SKUs solicitados estão no kit
            const kitSkus = kitComponents.map((c: any) => c.sku?.toUpperCase()).sort();
            const requestedSkus = componentSkus.map((s: string) => s.toUpperCase()).sort();

            return JSON.stringify(kitSkus) === JSON.stringify(requestedSkus);
        });

        if (kitsMatch.length === 0) {
            return res.json({
                sku_kit: null,
                found: false,
                message: 'Nenhum kit encontrado com essa composição exata',
                kits: []
            });
        }

        // Retorna o primeiro kit encontrado no formato esperado pelo frontend
        const firstKit = kitsMatch[0];

        res.json({
            sku_kit: firstKit.kit_sku,
            found: true,
            kits: kitsMatch.map(row => ({
                sku: row.kit_sku,
                nome: row.kit_nome,
                preco_unitario: parseFloat(row.kit_preco),
                componentes: row.componentes_do_kit
            }))
        });

    } catch (error) {
        console.error('Erro ao buscar kit por composição:', error);
        res.status(500).json({ error: 'Erro ao buscar kit por composição' });
    }
});

// POST - Criar kit e relacionar (substitui webhook N8N)
estoqueRouter.post('/kits/create-and-relate', async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
        // Aceita 2 formatos:
        // 1) { sku, nome, componentes, preco_unitario } (direto)
        // 2) { raw_id, kit: { nome, categoria, preco_unitario }, components: [...] } (do frontend)

        let sku = req.body.sku;
        let nome = req.body.nome;
        let componentes = req.body.componentes || req.body.components;
        let preco_unitario = req.body.preco_unitario;
        let raw_id = req.body.raw_id;

        // Se formato frontend (com kit e components)
        if (req.body.kit) {
            nome = req.body.kit.nome;
            preco_unitario = req.body.kit.preco_unitario;
        }

        // Se não tem SKU, gera automaticamente baseado nos componentes
        if (!sku && componentes && componentes.length > 0) {
            const componentSkus = componentes
                .map((c: any) => c.sku || c.sku_componente)
                .filter(Boolean)
                .sort()
                .join('-');

            sku = `KIT-${componentSkus.substring(0, 50)}`;
        }

        if (!nome || !componentes || !Array.isArray(componentes) || componentes.length === 0) {
            return res.status(400).json({ error: 'Nome e componentes são obrigatórios' });
        }

        await client.query('BEGIN');

        // Criar o kit
        const kitResult = await client.query(
            `INSERT INTO obsidian.produtos (sku, nome, tipo_produto, quantidade_atual, unidade_medida, preco_unitario, ativo, kit_bom)
     VALUES ($1, $2, 'KIT', 0, 'UN', $3, true, '[]'::jsonb)
     ON CONFLICT (sku) DO UPDATE SET
       nome = EXCLUDED.nome,
       preco_unitario = EXCLUDED.preco_unitario,
       atualizado_em = NOW()
     RETURNING *`,
            [sku, nome, preco_unitario || 0]
        );

        // Montar o array de componentes no formato { sku, qty }
        const kitBomArray = [];
        for (const comp of componentes) {
            const compSku = comp.sku || comp.sku_componente;
            const compQty = comp.q || comp.qty || comp.quantidade_por_kit || 1;

            if (!compSku) continue;

            // Verificar se componente existe
            const componenteExists = await client.query(
                'SELECT sku FROM obsidian.produtos WHERE sku = $1',
                [compSku]
            );

            if (componenteExists.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    error: `Componente ${compSku} não existe no estoque. Cadastre-o primeiro.`
                });
            }

            // Adicionar ao array kit_bom
            kitBomArray.push({ sku: compSku, qty: compQty });
        }

        // Atualizar a coluna kit_bom com os componentes
        const kitBomJson = JSON.stringify(kitBomArray);
        await client.query(
            `UPDATE obsidian.produtos
     SET kit_bom = $1::jsonb
     WHERE sku = $2`,
            [kitBomJson, sku]
        );

        // Auto-relacionamento em lote
        const bulkUpdateResult = await client.query(
            `UPDATE logistica.full_envio_raw 
             SET matched_sku = $1, 
                 status = 'matched',
                 processed_at = NOW()
             WHERE UPPER(sku_texto) = UPPER($2) 
               AND (status = 'pending' OR matched_sku IS NULL)
             RETURNING id, sku_texto, matched_sku`,
            [sku, nome]
        );

        if (bulkUpdateResult.rows.length > 0) {
            // Registros relacionados com sucesso
        }

        // Criar alias para auto-relacionamento futuro
        try {
            // Verificar se alias já existe
            const aliasExists = await client.query(
                `SELECT id FROM obsidian.sku_aliases 
                 WHERE UPPER(REGEXP_REPLACE(alias_text, '[^A-Z0-9]', '', 'g')) = 
                       UPPER(REGEXP_REPLACE($1, '[^A-Z0-9]', '', 'g'))
                   AND stock_sku = $2`,
                [nome, sku]
            );

            if (aliasExists.rows.length === 0) {
                // Precisamos de client_id - vamos buscar do raw_id se disponível, senão usar 1 (default)
                let clientId = 1;
                if (raw_id) {
                    const clientCheck = await client.query(
                        `SELECT client_id FROM public.raw_export_orders WHERE id = $1`,
                        [raw_id]
                    );
                    if (clientCheck.rows.length > 0 && clientCheck.rows[0].client_id) {
                        clientId = clientCheck.rows[0].client_id;
                    }
                }

                await client.query(
                    `INSERT INTO obsidian.sku_aliases (client_id, alias_text, stock_sku, confidence_default, times_used, created_at)
                     VALUES ($1, $2, $3, 1.0, 0, CURRENT_TIMESTAMP)
                     ON CONFLICT DO NOTHING`,
                    [clientId, nome, sku]
                );
            }
        } catch (aliasError: any) {
            // Erro ao criar alias (não crítico)
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            sku_kit: sku,
            matched: !!raw_id,
            kit: kitResult.rows[0],
            componentes_count: componentes.length
        });

    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('❌ [create-and-relate] Erro ao criar kit:', error);
        console.error('   Stack:', error.stack);
        res.status(500).json({
            error: 'Erro ao criar kit',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        client.release();
    }
});

// GET - Buscar movimentações de estoque por SKU
estoqueRouter.get('/movimentacoes/:sku', async (req: Request, res: Response) => {
    try {
        const { sku } = req.params;

        const result = await pool.query(`
            SELECT 
                id,
                sku,
                tipo,
                quantidade,
                data_movimentacao as data,
                origem_tabela,
                origem_id,
                observacao as motivo,
                usuario_id,
                criado_em
            FROM obsidian.estoque_movimentos
            WHERE sku = $1
            ORDER BY data_movimentacao DESC, criado_em DESC
            LIMIT 100
        `, [sku]);

        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar movimentações:', error);
        res.status(500).json({ error: 'Erro ao buscar movimentações' });
    }
});

