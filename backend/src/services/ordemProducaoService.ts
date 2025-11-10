import { pool } from '../database/db';
import { logActivity } from './activityLogger';

/**
 * Interface para Ordem de Produção
 */
export interface OrdemProducao {
    id?: number;
    numero_op: string;
    sku_produto: string;
    quantidade_planejada: number;
    quantidade_produzida?: number;
    quantidade_refugo?: number;
    data_abertura: string;
    data_inicio?: string | null;
    data_conclusao?: string | null;
    prioridade: 'baixa' | 'normal' | 'alta' | 'urgente';
    status: 'aguardando' | 'aguardando_mp' | 'pronto_para_iniciar' | 'em_producao' | 'pausada' | 'concluida' | 'cancelada';
    setor_id?: number | null;
    observacoes?: string | null;
    criado_por?: string;
    criado_em?: string;
    atualizado_em?: string;
}

/**
 * Interface para necessidade de MP
 */
export interface NecessidadeMP {
    sku_mp: string;
    quantidade_necessaria: number;
    estoque_disponivel: number;
    falta: number;
}

/**
 * Serviço para gerenciar Ordens de Produção
 */
class OrdemProducaoService {

    /**
     * Listar todas as OPs com filtros
     */
    async listarOPs(filtros?: {
        status?: string;
        setor_id?: number;
        data_inicio?: string;
        data_fim?: string;
    }) {
        try {
            let query = `
        SELECT * FROM obsidian.v_ordens_producao_detalhadas
        WHERE 1=1
      `;
            const params: any[] = [];
            let paramIndex = 1;

            if (filtros?.status) {
                query += ` AND status = $${paramIndex}`;
                params.push(filtros.status);
                paramIndex++;
            }

            if (filtros?.setor_id) {
                query += ` AND setor_id = $${paramIndex}`;
                params.push(filtros.setor_id);
                paramIndex++;
            }

            if (filtros?.data_inicio) {
                query += ` AND data_abertura >= $${paramIndex}`;
                params.push(filtros.data_inicio);
                paramIndex++;
            }

            if (filtros?.data_fim) {
                query += ` AND data_abertura <= $${paramIndex}`;
                params.push(filtros.data_fim);
                paramIndex++;
            }

            query += ' ORDER BY data_abertura DESC, id DESC';

            const result = await pool.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('Erro ao listar OPs:', error);
            throw error;
        }
    }

    /**
     * Buscar OP por ID
     */
    async buscarPorId(id: number) {
        try {
            const result = await pool.query(
                'SELECT * FROM obsidian.v_ordens_producao_detalhadas WHERE id = $1',
                [id]
            );
            return result.rows[0] || null;
        } catch (error) {
            console.error('Erro ao buscar OP:', error);
            throw error;
        }
    }

    /**
     * Calcular necessidade de matéria-prima para uma OP
     */
    async calcularNecessidadeMP(sku_produto: string, quantidade: number): Promise<NecessidadeMP[]> {
        try {
            const result = await pool.query(
                'SELECT * FROM obsidian.calcular_necessidade_mp($1, $2)',
                [sku_produto, quantidade]
            );
            return result.rows;
        } catch (error) {
            console.error('Erro ao calcular necessidade de MP:', error);
            throw error;
        }
    }

    /**
     * Criar nova OP
     */
    async criarOP(op: Omit<OrdemProducao, 'id' | 'numero_op'>, userEmail?: string, userName?: string) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Gerar número da OP
            const numeroOpResult = await client.query(
                'SELECT obsidian.gerar_numero_op() as numero'
            );
            const numero_op = numeroOpResult.rows[0].numero;

            // Validar se produto tem receita cadastrada
            const receitaResult = await client.query(
                'SELECT COUNT(*) as count FROM obsidian.receita_produto WHERE sku_produto = $1',
                [op.sku_produto]
            );

            if (receitaResult.rows[0].count === '0') {
                throw new Error(`Produto ${op.sku_produto} não possui receita cadastrada. Cadastre a receita antes de criar a OP.`);
            }

            // Calcular necessidade de MP
            const necessidadeMP = await this.calcularNecessidadeMP(op.sku_produto, op.quantidade_planejada);

            // Verificar se há MP suficiente
            const faltaMP = necessidadeMP.some(mp => mp.falta > 0);
            const statusInicial = faltaMP ? 'aguardando_mp' : 'pronto_para_iniciar';

            // Inserir OP
            const insertResult = await client.query(`
        INSERT INTO obsidian.ordens_producao (
          numero_op, sku_produto, quantidade_planejada, prioridade,
          status, setor_id, observacoes, criado_por
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
                numero_op,
                op.sku_produto,
                op.quantidade_planejada,
                op.prioridade || 'normal',
                statusInicial,
                op.setor_id || null,
                op.observacoes || null,
                op.criado_por || null
            ]);

            const opCriada = insertResult.rows[0];

            // Registrar consumo planejado de MP
            for (const mp of necessidadeMP) {
                await client.query(`
          INSERT INTO obsidian.consumo_mp_op (op_id, sku_mp, quantidade_planejada)
          VALUES ($1, $2, $3)
        `, [opCriada.id, mp.sku_mp, mp.quantidade_necessaria]);
            }

            await client.query('COMMIT');

            // Log de auditoria
            if (userEmail) {
                await logActivity({
                    user_email: userEmail,
                    user_name: userName,
                    action: 'op_created',
                    entity_type: 'ordem_producao',
                    entity_id: opCriada.id.toString(),
                    details: { numero_op, sku_produto: op.sku_produto, quantidade: op.quantidade_planejada }
                });
            }

            return { ...opCriada, necessidade_mp: necessidadeMP };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao criar OP:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Iniciar OP (baixa MP do estoque)
     */
    async iniciarOP(id: number, userEmail?: string, userName?: string) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Buscar OP
            const opResult = await client.query(
                'SELECT * FROM obsidian.ordens_producao WHERE id = $1',
                [id]
            );
            const op = opResult.rows[0];

            if (!op) {
                throw new Error('OP não encontrada');
            }

            if (op.status !== 'pronto_para_iniciar' && op.status !== 'aguardando') {
                throw new Error(`OP não pode ser iniciada. Status atual: ${op.status}`);
            }

            // Buscar consumo planejado de MP
            const mpResult = await client.query(`
        SELECT sku_mp, quantidade_planejada 
        FROM obsidian.consumo_mp_op 
        WHERE op_id = $1
      `, [id]);

            // Baixar cada MP do estoque
            for (const mp of mpResult.rows) {
                // Registrar movimento de estoque
                await client.query(`
          INSERT INTO obsidian.estoque_movimentos (
            sku, tipo, quantidade, origem_tabela, origem_id, observacao
          ) VALUES ($1, 'consumo_mp', $2, 'ordens_producao', $3, $4)
        `, [
                    mp.sku_mp,
                    -mp.quantidade_planejada,
                    id.toString(),
                    `Consumo OP ${op.numero_op}`
                ]);

                // Atualizar quantidade em materia_prima
                await client.query(`
          UPDATE obsidian.materia_prima
          SET quantidade_atual = quantidade_atual - $1,
              atualizado_em = now()
          WHERE sku_mp = $2
        `, [mp.quantidade_planejada, mp.sku_mp]);

                // Atualizar quantidade consumida
                await client.query(`
          UPDATE obsidian.consumo_mp_op
          SET quantidade_consumida = quantidade_planejada
          WHERE op_id = $1 AND sku_mp = $2
        `, [id, mp.sku_mp]);
            }

            // Atualizar status da OP
            await client.query(`
        UPDATE obsidian.ordens_producao
        SET status = 'em_producao',
            data_inicio = now(),
            atualizado_em = now()
        WHERE id = $1
      `, [id]);

            await client.query('COMMIT');

            // Log de auditoria
            if (userEmail) {
                await logActivity({
                    user_email: userEmail,
                    user_name: userName,
                    action: 'op_started',
                    entity_type: 'ordem_producao',
                    entity_id: id.toString(),
                    details: { numero_op: op.numero_op, mp_consumida: mpResult.rows }
                });
            }

            return await this.buscarPorId(id);
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao iniciar OP:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Pausar OP
     */
    async pausarOP(id: number, userEmail?: string, userName?: string) {
        try {
            await pool.query(`
        UPDATE obsidian.ordens_producao
        SET status = 'pausada',
            atualizado_em = now()
        WHERE id = $1 AND status = 'em_producao'
      `, [id]);

            if (userEmail) {
                await logActivity({
                    user_email: userEmail,
                    user_name: userName,
                    action: 'op_paused',
                    entity_type: 'ordem_producao',
                    entity_id: id.toString()
                });
            }

            return await this.buscarPorId(id);
        } catch (error) {
            console.error('Erro ao pausar OP:', error);
            throw error;
        }
    }

    /**
     * Retomar OP
     */
    async retomarOP(id: number, userEmail?: string, userName?: string) {
        try {
            await pool.query(`
        UPDATE obsidian.ordens_producao
        SET status = 'em_producao',
            atualizado_em = now()
        WHERE id = $1 AND status = 'pausada'
      `, [id]);

            if (userEmail) {
                await logActivity({
                    user_email: userEmail,
                    user_name: userName,
                    action: 'op_resumed',
                    entity_type: 'ordem_producao',
                    entity_id: id.toString()
                });
            }

            return await this.buscarPorId(id);
        } catch (error) {
            console.error('Erro ao retomar OP:', error);
            throw error;
        }
    }

    /**
     * Cancelar OP (estorna MP se já iniciada)
     */
    async cancelarOP(id: number, motivo?: string, userEmail?: string) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Buscar OP
            const opResult = await client.query(
                'SELECT * FROM obsidian.ordens_producao WHERE id = $1',
                [id]
            );
            const op = opResult.rows[0];

            if (!op) {
                throw new Error('OP não encontrada');
            }

            if (op.status === 'concluida') {
                throw new Error('OP já concluída não pode ser cancelada');
            }

            // Se já foi iniciada, estornar MP
            if (op.status === 'em_producao' || op.status === 'pausada') {
                const mpResult = await client.query(`
          SELECT sku_mp, quantidade_consumida 
          FROM obsidian.consumo_mp_op 
          WHERE op_id = $1 AND quantidade_consumida > 0
        `, [id]);

                for (const mp of mpResult.rows) {
                    // Registrar movimento de estorno
                    await client.query(`
            INSERT INTO obsidian.estoque_movimentos (
              sku, tipo, quantidade, origem_tabela, origem_id, observacao
            ) VALUES ($1, 'ajuste', $2, 'ordens_producao', $3, $4)
          `, [
                        mp.sku_mp,
                        mp.quantidade_consumida,
                        id.toString(),
                        `Estorno cancelamento OP ${op.numero_op}`
                    ]);

                    // Devolver MP ao estoque
                    await client.query(`
            UPDATE obsidian.materia_prima
            SET quantidade_atual = quantidade_atual + $1,
                atualizado_em = now()
            WHERE sku_mp = $2
          `, [mp.quantidade_consumida, mp.sku_mp]);
                }
            }

            // Atualizar status da OP
            const observacoesCancelamento = motivo
                ? `${op.observacoes || ''}\n\nCANCELADA: ${motivo}`.trim()
                : op.observacoes;

            await client.query(`
        UPDATE obsidian.ordens_producao
        SET status = 'cancelada',
            observacoes = $1,
            atualizado_em = now()
        WHERE id = $2
      `, [observacoesCancelamento, id]);

            await client.query('COMMIT');

            // Log de auditoria
            if (userEmail) {
                await logActivity({
                    user_email: userEmail,
                    user_name: userName,
                    action: 'op_cancelled',
                    entity_type: 'ordem_producao',
                    entity_id: id.toString(),
                    details: { numero_op: op.numero_op, motivo }
                });
            }

            return await this.buscarPorId(id);
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao cancelar OP:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Atualizar OP (apenas campos editáveis)
     */
    async atualizarOP(id: number, dados: Partial<OrdemProducao>, userEmail?: string) {
        try {
            const campos: string[] = [];
            const valores: any[] = [];
            let paramIndex = 1;

            if (dados.prioridade) {
                campos.push(`prioridade = $${paramIndex}`);
                valores.push(dados.prioridade);
                paramIndex++;
            }

            if (dados.setor_id !== undefined) {
                campos.push(`setor_id = $${paramIndex}`);
                valores.push(dados.setor_id);
                paramIndex++;
            }

            if (dados.observacoes !== undefined) {
                campos.push(`observacoes = $${paramIndex}`);
                valores.push(dados.observacoes);
                paramIndex++;
            }

            if (campos.length === 0) {
                throw new Error('Nenhum campo para atualizar');
            }

            campos.push('atualizado_em = now()');
            valores.push(id);

            const query = `
        UPDATE obsidian.ordens_producao
        SET ${campos.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

            const result = await pool.query(query, valores);

            if (userEmail) {
                await logActivity({
                    user_email: userEmail,
                    user_name: userName,
                    action: 'op_updated',
                    entity_type: 'ordem_producao',
                    entity_id: id.toString(),
                    details: dados
                });
            }

            return result.rows[0];
        } catch (error) {
            console.error('Erro ao atualizar OP:', error);
            throw error;
        }
    }
}

export const ordemProducaoService = new OrdemProducaoService();
export default ordemProducaoService;


