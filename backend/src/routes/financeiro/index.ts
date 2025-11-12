import { Router } from 'express';
import contasRouter from './contas';
import cartoesRouter from './cartoes';
import categoriasRouter from './categorias';
import transacoesRouter from './transacoes';
import faturasRouter from './faturas';
import faturasItensRouter from './faturas-itens';

const router = Router();

// Registrar todas as rotas do módulo financeiro
router.use('/contas', contasRouter);
router.use('/cartoes', cartoesRouter);
router.use('/categorias', categoriasRouter);
router.use('/transacoes', transacoesRouter);
router.use('/faturas', faturasRouter);
router.use('/faturas-itens', faturasItensRouter);

export default router;
