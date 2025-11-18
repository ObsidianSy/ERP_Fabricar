import { Router, Request, Response } from 'express';
import { pool } from '../database/db';
import { formatErrorResponse } from '../utils/errorTranslator';

export const clientesRouter = Router();

// GET - Listar todos os clientes
clientesRouter.get('/', async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`
      SELECT * FROM obsidian.clientes
      ORDER BY criado_em DESC
    `);

        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        res.status(500).json({ error: 'Erro ao buscar clientes' });
    }
});

// GET - Buscar cliente por ID
clientesRouter.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM obsidian.clientes WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao buscar cliente:', error);
        res.status(500).json({ error: 'Erro ao buscar cliente' });
    }
});

// POST - Criar novo cliente (upsert com ON CONFLICT)
clientesRouter.post('/', async (req: Request, res: Response) => {
    try {
        const { nome, documento, telefone, observacoes } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        const result = await pool.query(
            `INSERT INTO obsidian.clientes (nome, documento, telefone, observacoes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (nome) 
       DO UPDATE SET 
         documento = EXCLUDED.documento,
         telefone = EXCLUDED.telefone,
         observacoes = EXCLUDED.observacoes
       RETURNING *`,
            [nome, documento, telefone, observacoes]
        );

        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        console.error('Erro ao criar/atualizar cliente:', error);
        const errorResponse = formatErrorResponse(error, 'cliente');
        res.status(errorResponse.statusCode).json(errorResponse);
    }
});

// PUT - Atualizar cliente (upsert)
clientesRouter.put('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { nome, documento, telefone, observacoes } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        const result = await pool.query(
            `UPDATE obsidian.clientes 
       SET nome = $2, documento = $3, telefone = $4, observacoes = $5
       WHERE id = $1
       RETURNING *`,
            [id, nome, documento, telefone, observacoes]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar cliente:', error);
        res.status(500).json({ error: 'Erro ao atualizar cliente' });
    }
});

// PATCH - Atualizar flag Cliente Drop
clientesRouter.patch('/:id/drop', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { is_cliente_drop } = req.body;

        if (typeof is_cliente_drop !== 'boolean') {
            return res.status(400).json({ error: 'is_cliente_drop deve ser boolean' });
        }

        const result = await pool.query(
            `UPDATE obsidian.clientes 
       SET is_cliente_drop = $2
       WHERE id = $1
       RETURNING *`,
            [id, is_cliente_drop]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar flag Cliente Drop:', error);
        res.status(500).json({ error: 'Erro ao atualizar flag Cliente Drop' });
    }
});

// DELETE - Excluir cliente
clientesRouter.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM obsidian.clientes WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        res.json({ message: 'Cliente excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir cliente:', error);
        res.status(500).json({ error: 'Erro ao excluir cliente' });
    }
});
