import { Router, Request, Response } from 'express';
import { pool } from '../database/db';
import { enviarVendaWebhook } from '../utils/webhook';
import { formatErrorResponse } from '../utils/errorTranslator';

export const vendasRouter = Router();

// GET - Listar todas as vendas (com filtro opcional por SKU)
vendasRouter.get('/', async (req: Request, res: Response) => {
    try {
        const { sku_produto } = req.query;

        let query = `
            SELECT v.*
            FROM obsidian.vendas v
        `;
        let params: any[] = [];

        if (sku_produto) {
            query += ' WHERE v.sku_produto = $1';
            params.push(sku_produto);
        }

        query += ' ORDER BY v.data_venda DESC';

        const result = await pool.query(query, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar vendas:', error);
        res.status(500).json({ error: 'Erro ao buscar vendas' });
    }
});

// GET - Buscar venda por ID
vendasRouter.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'SELECT * FROM obsidian.vendas WHERE venda_id = $1', // ✅ Corrigido: usar venda_id
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Venda não encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao buscar venda:', error);
        res.status(500).json({ error: 'Erro ao buscar venda' });
    }
});

// POST - Criar nova venda (inserir itens de venda)
// Usa obsidian.processar_pedido para seguir regras de negócio
vendasRouter.post('/', async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
        const { data_venda, nome_cliente, items, canal, pedido_uid, client_id, import_id } = req.body;

        if (!data_venda || !nome_cliente || !items || items.length === 0) {
            return res.status(400).json({
                error: 'Dados obrigatórios ausentes (data_venda, nome_cliente, items)'
            });
        }

        if (!client_id) {
            return res.status(400).json({
                error: 'client_id é obrigatório (ID do cliente interno)'
            });
        }

        // Validar e filtrar items com quantidade > 0
        const validItems = items.filter((item: any) => {
            const qty = parseFloat(item.quantidade_vendida || item.quantidade || 0);
            return qty > 0;
        });

        if (validItems.length === 0) {
            return res.status(400).json({
                error: 'Nenhum item válido (quantidade deve ser > 0)'
            });
        }

        await client.query('BEGIN');

        // Montar JSON de items para processar_pedido
        const itemsJson = validItems.map((item: any) => ({
            sku: item.sku_produto || item.sku,
            quantidade: parseFloat(item.quantidade_vendida || item.quantidade),
            preco_unitario: parseFloat(item.preco_unitario || 0),
            nome_produto: item.nome_produto || 'Produto'
        }));

        // Chamar função processar_pedido que segue as regras de negócio
        const result = await client.query(
            `SELECT * FROM obsidian.processar_pedido(
                $1::text,  -- pedido_uid
                $2::date,  -- data_venda
                $3::text,  -- nome_cliente
                $4::text,  -- canal
                $5::jsonb, -- items
                $6::bigint, -- client_id
                $7::uuid   -- import_id
            )`,
            [
                pedido_uid || `MANUAL-${Date.now()}`,
                data_venda,
                nome_cliente,
                canal || 'MANUAL',
                JSON.stringify(itemsJson),
                client_id,
                import_id || null
            ]
        );

        await client.query('COMMIT');

        // Montar payload detalhado para o webhook
        const payloadWebhook = {
            pedido_uid: pedido_uid || `MANUAL-${Date.now()}`,
            data_venda,
            nome_cliente,
            canal: canal || 'MANUAL',
            client_id,
            import_id: import_id || null,
            items: itemsJson // já está pronto e validado
        };

        // Enviar webhook SOMENTE se o cliente for "Obsidian Ecom"
        if (nome_cliente.toLowerCase().trim() === 'obsidian ecom') {
            enviarVendaWebhook(payloadWebhook);
            console.log('✅ [Webhook] Venda do cliente "Obsidian Ecom" enviada ao webhook');
        } else {
            console.log(`⏭️  [Webhook] Venda ignorada - Cliente: "${nome_cliente}" (não é "Obsidian Ecom")`);
        }

        res.status(201).json({
            message: 'Venda criada com sucesso via processar_pedido',
            processamento: result.rows
        });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Erro ao criar venda:', error);
        const errorResponse = formatErrorResponse(error, 'venda');
        res.status(errorResponse.statusCode).json(errorResponse);
    } finally {
        client.release();
    }
});

// DELETE - Excluir venda (com reversão de estoque)
vendasRouter.delete('/:id', async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;

        await client.query('BEGIN');

        // 1. Buscar dados da venda antes de excluir
        const vendaResult = await client.query(
            'SELECT venda_id, sku_produto, quantidade_vendida, fulfillment_ext, pedido_uid, canal FROM obsidian.vendas WHERE venda_id = $1',
            [id]
        );

        if (vendaResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Venda não encontrada' });
        }

        const venda = vendaResult.rows[0];

        // 2. Reverter estoque APENAS se não for fulfillment externo
        if (!venda.fulfillment_ext) {
            // Buscar componentes expandidos (kits) ou produto simples
            const componentesResult = await client.query(`
                SELECT sku_baixa, qtd_baixa
                FROM obsidian.v_vendas_expandidas_json
                WHERE venda_id = $1
            `, [id]);

            // 3. Para cada componente, adicionar de volta ao estoque (inverter movimento)
            for (const comp of componentesResult.rows) {
                // Registrar movimento POSITIVO (estorna a saída)
                await client.query(`
                    INSERT INTO obsidian.estoque_movimentos (sku, tipo, quantidade, origem_tabela, origem_id, observacao)
                    VALUES ($1, 'estorno_venda', $2, 'vendas', $3, $4)
                `, [
                    comp.sku_baixa,
                    comp.qtd_baixa, // POSITIVO - devolver ao estoque
                    venda.venda_id.toString(),
                    `Exclusão venda - Pedido ${venda.pedido_uid || '-'} / Canal ${venda.canal || '-'}`
                ]);

                // Atualizar quantidade_atual no produto
                await client.query(`
                    UPDATE obsidian.produtos
                    SET quantidade_atual = quantidade_atual + $1,
                        atualizado_em = now()
                    WHERE sku = $2
                `, [comp.qtd_baixa, comp.sku_baixa]);
            }

            // 4. Deletar movimentos antigos da venda (opcional - manter histórico)
            // Comentado para preservar auditoria:
            // await client.query(
            //     "DELETE FROM obsidian.estoque_movimentos WHERE origem_tabela = 'vendas' AND origem_id = $1",
            //     [id]
            // );
        }

        // 5. Excluir a venda
        await client.query(
            'DELETE FROM obsidian.vendas WHERE venda_id = $1',
            [id]
        );

        await client.query('COMMIT');

        res.json({
            message: 'Venda excluída com sucesso',
            estoque_revertido: !venda.fulfillment_ext
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao excluir venda:', error);
        res.status(500).json({ error: 'Erro ao excluir venda' });
    } finally {
        client.release();
    }
});
