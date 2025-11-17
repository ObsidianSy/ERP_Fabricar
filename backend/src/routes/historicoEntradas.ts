import { Router, Request, Response } from 'express';
import { pool } from '../database/db';

export const historicoEntradasRouter = Router();

// GET - Listar histórico de entradas (produtos + matéria-prima)
historicoEntradasRouter.get('/', async (req: Request, res: Response) => {
    try {
        const { 
            tipo, // 'produto' ou 'materia_prima'
            sku, 
            data_inicio, 
            data_fim,
            page = '1',
            limit = '50'
        } = req.query;

        const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
        
        let whereClauses: string[] = [];
        let params: any[] = [];
        let paramIndex = 1;

        // Filtrar apenas entradas (tipos que representam entrada no estoque)
        whereClauses.push(`(em.tipo IN ('entrada_mp', 'producao', 'fabricacao', 'manual'))`);

        // Filtro por tipo (produto ou materia_prima)
        if (tipo === 'produto') {
            whereClauses.push(`em.tipo IN ('producao', 'fabricacao', 'manual')`);
        } else if (tipo === 'materia_prima') {
            whereClauses.push(`em.tipo = 'entrada_mp'`);
        }

        // Filtro por SKU
        if (sku) {
            whereClauses.push(`em.sku ILIKE $${paramIndex}`);
            params.push(`%${sku}%`);
            paramIndex++;
        }

        // Filtro por data início
        if (data_inicio) {
            whereClauses.push(`em.ts >= $${paramIndex}::timestamp`);
            params.push(data_inicio);
            paramIndex++;
        }

        // Filtro por data fim
        if (data_fim) {
            whereClauses.push(`em.ts <= $${paramIndex}::timestamp`);
            params.push(data_fim);
            paramIndex++;
        }

        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Query principal com JOIN para pegar nome do produto ou matéria-prima
        const query = `
            SELECT 
                em.id,
                em.ts as data_hora,
                em.sku,
                em.tipo,
                em.quantidade,
                em.origem_tabela,
                em.origem_id,
                em.observacao,
                COALESCE(p.nome, mp.nome) as nome,
                CASE 
                    WHEN em.tipo = 'entrada_mp' THEN 'Matéria-Prima'
                    WHEN em.tipo IN ('producao', 'fabricacao', 'manual') THEN 'Produto'
                    ELSE em.tipo
                END as tipo_formatado
            FROM obsidian.estoque_movimentos em
            LEFT JOIN obsidian.produtos p ON em.sku = p.sku AND em.tipo IN ('producao', 'fabricacao', 'manual')
            LEFT JOIN obsidian.materia_prima mp ON em.sku = mp.sku_mp AND em.tipo = 'entrada_mp'
            ${whereClause}
            ORDER BY em.ts DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        params.push(parseInt(limit as string), offset);

        // Query para contar total
        const countQuery = `
            SELECT COUNT(*) as total
            FROM obsidian.estoque_movimentos em
            ${whereClause}
        `;

        const [result, countResult] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, params.slice(0, -2)) // Remove limit e offset do count
        ]);

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / parseInt(limit as string));

        res.json({
            data: result.rows,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total,
                totalPages
            }
        });
    } catch (error: any) {
        console.error('Erro ao buscar histórico de entradas:', error);
        res.status(500).json({ error: 'Erro ao buscar histórico de entradas' });
    }
});

// GET - Estatísticas de entradas
historicoEntradasRouter.get('/stats', async (req: Request, res: Response) => {
    try {
        const { data_inicio, data_fim } = req.query;

        let whereClauses: string[] = [`tipo IN ('entrada_mp', 'producao', 'fabricacao', 'manual')`];
        let params: any[] = [];
        let paramIndex = 1;

        if (data_inicio) {
            whereClauses.push(`ts >= $${paramIndex}::timestamp`);
            params.push(data_inicio);
            paramIndex++;
        }

        if (data_fim) {
            whereClauses.push(`ts <= $${paramIndex}::timestamp`);
            params.push(data_fim);
            paramIndex++;
        }

        const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

        const statsQuery = `
            SELECT 
                COUNT(*) FILTER (WHERE tipo = 'entrada_mp') as total_entradas_mp,
                COUNT(*) FILTER (WHERE tipo IN ('producao', 'fabricacao', 'manual')) as total_entradas_produtos,
                SUM(quantidade) FILTER (WHERE tipo = 'entrada_mp') as quantidade_total_mp,
                SUM(quantidade) FILTER (WHERE tipo IN ('producao', 'fabricacao', 'manual')) as quantidade_total_produtos
                SUM(quantidade) FILTER (WHERE tipo = 'entrada_mp') as quantidade_total_mp,
                SUM(quantidade) FILTER (WHERE tipo = 'producao') as quantidade_total_produtos
            FROM obsidian.estoque_movimentos
            ${whereClause}
        `;

        const result = await pool.query(statsQuery, params);

        res.json({
            entradas_materia_prima: {
                total: parseInt(result.rows[0].total_entradas_mp || 0),
                quantidade_total: parseFloat(result.rows[0].quantidade_total_mp || 0)
            },
            entradas_produtos: {
                total: parseInt(result.rows[0].total_entradas_produtos || 0),
                quantidade_total: parseFloat(result.rows[0].quantidade_total_produtos || 0)
            }
        });
    } catch (error: any) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

export default historicoEntradasRouter;
