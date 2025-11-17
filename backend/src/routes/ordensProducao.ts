import { Router, Response } from 'express';
import { ordemProducaoService } from '../services/ordemProducaoService';
import { apontamentoService } from '../services/apontamentoService';
import { AuthRequest } from '../middleware/authMiddleware';

export const ordensProducaoRouter = Router();

/**
 * GET /api/ordens-producao
 * Listar OPs com filtros opcionais
 */
ordensProducaoRouter.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { status, setor_id, data_inicio, data_fim } = req.query;

        const filtros: any = {};
        if (status) filtros.status = status as string;
        if (setor_id) filtros.setor_id = parseInt(setor_id as string);
        if (data_inicio) filtros.data_inicio = data_inicio as string;
        if (data_fim) filtros.data_fim = data_fim as string;

        const ops = await ordemProducaoService.listarOPs(filtros);
        res.json(ops);
    } catch (error) {
        console.error('Erro ao listar OPs:', error);
        res.status(500).json({ error: 'Erro ao listar ordens de produção' });
    }
});

/**
 * GET /api/ordens-producao/:id
 * Buscar OP por ID
 */
ordensProducaoRouter.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const op = await ordemProducaoService.buscarPorId(parseInt(id));

        if (!op) {
            return res.status(404).json({ error: 'Ordem de produção não encontrada' });
        }

        // Buscar apontamentos da OP
        const apontamentos = await apontamentoService.listarPorOP(parseInt(id));

        res.json({ ...op, apontamentos });
    } catch (error) {
        console.error('Erro ao buscar OP:', error);
        res.status(500).json({ error: 'Erro ao buscar ordem de produção' });
    }
});

/**
 * POST /api/ordens-producao
 * Criar nova OP
 */
ordensProducaoRouter.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const { sku_produto, quantidade_planejada, prioridade, setor_id, observacoes, criado_por } = req.body;

        // Validações
        if (!sku_produto || !quantidade_planejada) {
            return res.status(400).json({
                error: 'SKU do produto e quantidade planejada são obrigatórios'
            });
        }

        if (quantidade_planejada <= 0) {
            return res.status(400).json({
                error: 'Quantidade planejada deve ser maior que zero'
            });
        }

        // Obter email e nome do usuário do token JWT
        const userEmail = req.user?.email || 'sistema@erp.local';
        const userName = req.user?.nome || 'Sistema Automático';

        const op = await ordemProducaoService.criarOP({
            sku_produto,
            quantidade_planejada,
            prioridade: prioridade || 'normal',
            status: 'aguardando',
            data_abertura: new Date().toISOString(),
            setor_id: setor_id || null,
            observacoes: observacoes || null,
            criado_por: criado_por || null
        }, userEmail, userName);

        res.status(201).json(op);
    } catch (error: any) {
        console.error('Erro ao criar OP:', error);
        res.status(400).json({ error: error.message || 'Erro ao criar ordem de produção' });
    }
});

/**
 * POST /api/ordens-producao/:id/calcular-mp
 * Calcular necessidade de matéria-prima
 */
ordensProducaoRouter.post('/:id/calcular-mp', async (req: AuthRequest, res: Response) => {
    try {
        const { sku_produto, quantidade } = req.body;

        if (!sku_produto || !quantidade) {
            return res.status(400).json({ error: 'SKU e quantidade são obrigatórios' });
        }

        const necessidadeMP = await ordemProducaoService.calcularNecessidadeMP(sku_produto, quantidade);
        res.json(necessidadeMP);
    } catch (error) {
        console.error('Erro ao calcular MP:', error);
        res.status(500).json({ error: 'Erro ao calcular necessidade de matéria-prima' });
    }
});

/**
 * PATCH /api/ordens-producao/:id/iniciar
 * Iniciar OP (baixa MP do estoque)
 */
ordensProducaoRouter.patch('/:id/iniciar', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userEmail = req.user?.email || 'sistema@erp.local';
        const userName = req.user?.nome || 'Sistema Automático';

        const op = await ordemProducaoService.iniciarOP(parseInt(id), userEmail);
        res.json(op);
    } catch (error: any) {
        console.error('Erro ao iniciar OP:', error);
        res.status(400).json({ error: error.message || 'Erro ao iniciar ordem de produção' });
    }
});

/**
 * PATCH /api/ordens-producao/:id/pausar
 * Pausar OP
 */
ordensProducaoRouter.patch('/:id/pausar', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userEmail = req.user?.email || 'sistema@erp.local';
        const userName = req.user?.nome || 'Sistema Automático';

        const op = await ordemProducaoService.pausarOP(parseInt(id), userEmail);
        res.json(op);
    } catch (error: any) {
        console.error('Erro ao pausar OP:', error);
        res.status(400).json({ error: error.message || 'Erro ao pausar ordem de produção' });
    }
});

/**
 * PATCH /api/ordens-producao/:id/retomar
 * Retomar OP pausada
 */
ordensProducaoRouter.patch('/:id/retomar', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userEmail = req.user?.email || 'sistema@erp.local';
        const userName = req.user?.nome || 'Sistema Automático';

        const op = await ordemProducaoService.retomarOP(parseInt(id), userEmail);
        res.json(op);
    } catch (error: any) {
        console.error('Erro ao retomar OP:', error);
        res.status(400).json({ error: error.message || 'Erro ao retomar ordem de produção' });
    }
});

/**
 * PATCH /api/ordens-producao/:id/cancelar
 * Cancelar OP (estorna MP se já iniciada)
 */
ordensProducaoRouter.patch('/:id/cancelar', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body;
        const userEmail = req.user?.email || 'sistema@erp.local';
        const userName = req.user?.nome || 'Sistema Automático';

        const op = await ordemProducaoService.cancelarOP(parseInt(id), motivo, userEmail);
        res.json(op);
    } catch (error: any) {
        console.error('Erro ao cancelar OP:', error);
        res.status(400).json({ error: error.message || 'Erro ao cancelar ordem de produção' });
    }
});

/**
 * PATCH /api/ordens-producao/:id
 * Atualizar OP (campos editáveis)
 */
ordensProducaoRouter.patch('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userEmail = req.user?.email || 'sistema';
        const userName = req.user?.nome || 'Sistema';

        const op = await ordemProducaoService.atualizarOP(parseInt(id), req.body, userEmail);
        res.json(op);
    } catch (error: any) {
        console.error('Erro ao atualizar OP:', error);
        res.status(400).json({ error: error.message || 'Erro ao atualizar ordem de produção' });
    }
});

/**
 * GET /api/ordens-producao/:id/apontamentos
 * Listar apontamentos de uma OP
 */
ordensProducaoRouter.get('/:id/apontamentos', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const apontamentos = await apontamentoService.listarPorOP(parseInt(id));
        res.json(apontamentos);
    } catch (error) {
        console.error('Erro ao listar apontamentos:', error);
        res.status(500).json({ error: 'Erro ao listar apontamentos' });
    }
});

/**
 * POST /api/ordens-producao/:id/apontamentos
 * Criar apontamento de produção
 */
ordensProducaoRouter.post('/:id/apontamentos', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const {
            quantidade_produzida,
            quantidade_refugo,
            motivo_refugo,
            tempo_producao_minutos,
            observacoes,
            operador_id
        } = req.body;

        // Validações
        if (!quantidade_produzida || quantidade_produzida <= 0) {
            return res.status(400).json({
                error: 'Quantidade produzida deve ser maior que zero'
            });
        }

        if (quantidade_refugo && quantidade_refugo < 0) {
            return res.status(400).json({
                error: 'Quantidade de refugo não pode ser negativa'
            });
        }

        if (quantidade_refugo && quantidade_refugo > 0 && !motivo_refugo) {
            return res.status(400).json({
                error: 'Motivo do refugo é obrigatório quando há refugo'
            });
        }

        const userEmail = req.user?.email || 'sistema';
        const userName = req.user?.nome || 'Sistema';

        const apontamento = await apontamentoService.criarApontamento({
            op_id: parseInt(id),
            quantidade_produzida,
            quantidade_refugo: quantidade_refugo || 0,
            motivo_refugo: motivo_refugo || null,
            tempo_producao_minutos: tempo_producao_minutos || null,
            operador_id: operador_id || null,
            observacoes: observacoes || null
        }, userEmail);

        res.status(201).json(apontamento);
    } catch (error: any) {
        console.error('Erro ao criar apontamento:', error);
        res.status(400).json({ error: error.message || 'Erro ao criar apontamento' });
    }
});

/**
 * GET /api/ordens-producao/estatisticas/producao
 * Estatísticas de produção por período
 */
ordensProducaoRouter.get('/estatisticas/producao', async (req: AuthRequest, res: Response) => {
    try {
        const { data_inicio, data_fim } = req.query;

        if (!data_inicio || !data_fim) {
            return res.status(400).json({
                error: 'Data de início e fim são obrigatórias'
            });
        }

        const stats = await apontamentoService.estatisticasPorPeriodo(
            data_inicio as string,
            data_fim as string
        );

        res.json(stats);
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas de produção' });
    }
});



