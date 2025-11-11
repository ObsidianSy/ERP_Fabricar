import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../database/db';

const JWT_SECRET = process.env.JWT_SECRET || 'seu-segredo-super-secreto-aqui';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        nome: string;
        email: string;
        cargo?: string;
    };
}

/**
 * Middleware para autenticação JWT
 * Extrai o usuário do token e adiciona ao req.user
 */
export async function authMiddleware(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            // Se não tem token, continua sem user (para rotas opcionais)
            return next();
        }

        // Verificar e decodificar token
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        // Buscar usuário no banco
        const result = await pool.query(
            `SELECT id, nome, email, ativo, cargo 
             FROM obsidian.usuarios 
             WHERE id = $1 AND ativo = true`,
            [decoded.id]
        );

        if (result.rows.length > 0) {
            // Adicionar usuário ao request
            req.user = {
                id: result.rows[0].id,
                nome: result.rows[0].nome,
                email: result.rows[0].email,
                cargo: result.rows[0].cargo
            };
            console.log('✅ Usuário autenticado:', req.user.email, 'Cargo:', req.user.cargo);
        } else {
            console.warn('⚠️ Usuário não encontrado no banco para o token fornecido');
        }

        next();
    } catch (error: any) {
        // Se token inválido, continua sem user
        console.warn('❌ Token inválido ou expirado:', error.message);
        next();
    }
}

/**
 * Middleware para rotas que EXIGEM autenticação
 */
export function requireAuth(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    if (!req.user) {
        return res.status(401).json({ error: 'Autenticação necessária' });
    }
    next();
}

/**
 * Middleware para rotas que EXIGEM permissão de administrador
 */
export function requireAdmin(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    console.log('🔐 requireAdmin - Verificando permissões...');
    console.log('   req.user:', req.user);
    
    if (!req.user) {
        console.log('❌ Acesso negado: Usuário não autenticado');
        return res.status(401).json({ error: 'Autenticação necessária' });
    }

    console.log('   Usuário:', req.user.email, 'Cargo:', req.user.cargo);
    
    if (req.user.cargo !== 'adm') {
        console.log('❌ Acesso negado: Usuário não é administrador');
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Apenas administradores podem acessar este recurso'
        });
    }

    console.log('✅ Acesso permitido para admin:', req.user.email);
    next();
}
