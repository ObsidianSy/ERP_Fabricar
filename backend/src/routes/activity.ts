import { Router, Request, Response } from 'express';
import { getActivityLogs, getActivitySummary, getActivityStats } from '../services/activityLogger';
import { pool } from '../database/db';
import { requireAdmin, AuthRequest } from '../middleware/authMiddleware';

export const activityRouter = Router();

// GET - Listar logs de atividade com filtros (APENAS ADMIN)
activityRouter.get('/logs', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const {
            user_email,
            action,
            entity_type,
            start_date,
            end_date,
            limit = 100,
            offset = 0
        } = req.query;

        const logs = await getActivityLogs({
            user_email: user_email as string,
            action: action as string,
            entity_type: entity_type as string,
            start_date: start_date as string,
            end_date: end_date as string,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string)
        });

        res.json(logs);
    } catch (error: any) {
        console.error('Erro ao buscar logs:', error);
        res.status(500).json({ error: 'Erro ao buscar logs de atividade', details: error.message });
    }
});

// GET - Resumo de atividades por usuário (APENAS ADMIN)
activityRouter.get('/summary', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const summary = await getActivitySummary();
        res.json(summary);
    } catch (error: any) {
        console.error('Erro ao buscar resumo:', error);
        res.status(500).json({ error: 'Erro ao buscar resumo de atividades', details: error.message });
    }
});

// GET - Estatísticas gerais (APENAS ADMIN)
activityRouter.get('/stats', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { days = 7 } = req.query;
        const stats = await getActivityStats(parseInt(days as string));
        res.json(stats);
    } catch (error: any) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas', details: error.message });
    }
});

// GET - Lista de usuários únicos que têm logs (APENAS ADMIN)
activityRouter.get('/users', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
        // Buscar todos os usuários ativos da tabela usuarios
        const result = await pool.query(`
            SELECT 
                email as user_email,
                nome as user_name
            FROM obsidian.usuarios
            WHERE ativo = true
            ORDER BY nome, email
        `);

        res.json(result.rows);
    } catch (error: any) {
        console.error('Erro ao buscar usuários:', error);
        res.status(500).json({ error: 'Erro ao buscar usuários', details: error.message });
    }
});

// GET - Atividades de um usuário específico (APENAS ADMIN)
activityRouter.get('/user/:email', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { email } = req.params;
        const { limit = 50 } = req.query;

        const logs = await getActivityLogs({
            user_email: email,
            limit: parseInt(limit as string)
        });

        res.json(logs);
    } catch (error: any) {
        console.error('Erro ao buscar logs do usuário:', error);
        res.status(500).json({ error: 'Erro ao buscar logs do usuário', details: error.message });
    }
});
