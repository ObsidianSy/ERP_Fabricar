import { pool } from '../database/db';
import { logActivity } from './activityLogger';

/**
 * Interface para Apontamento de Produção
 */
export interface ApontamentoProducao {
    id?: number;
    op_id: number;
    data_apontamento?: string;
    quantidade_produzida: number;
    quantidade_refugo?: number;
    motivo_refugo?: string | null;
    tempo_producao_minutos?: number | null;
    operador_id?: string | null;
    observacoes?: string | null;
    criado_em?: string;
}

/**
 * Serviço para gerenciar Apontamentos de Produção
 */
class ApontamentoService {

    /**
     * Listar apontamentos por OP
     */
    async listarPorOP(op_id: number) {
        try {
            const result = await pool.query(`
        SELECT 
          a.*,
          u.nome as operador_nome
        FROM obsidian.apontamentos_producao a
        LEFT JOIN obsidian.usuarios u ON u.id = a.operador_id
        WHERE a.op_id = $1
        ORDER BY a.data_apontamento DESC
      `, [op_id]);

            return result.rows;
        } catch (error) {
            console.error('Erro ao listar apontamentos:', error);
            throw error;
        }
    }

    /**
     * Listar todos os apontamentos com filtros
     */
    async listar(filtros?: {
        data_inicio?: string;
        data_fim?: string;
        operador_id?: string;
    }) {
        try {
            let query = `
        SELECT 
          a.*,
          u.nome as operador_nome,
          op.numero_op,
          op.sku_produto,
          p.nome as produto_nome
        FROM obsidian.apontamentos_producao a
        LEFT JOIN obsidian.usuarios u ON u.id = a.operador_id
        LEFT JOIN obsidian.ordens_producao op ON op.id = a.op_id
        LEFT JOIN obsidian.produtos p ON p.sku = op.sku_produto
        WHERE 1=1
      `;
            const params: any[] = [];
            let paramIndex = 1;

            if (filtros?.data_inicio) {
                query += ` AND a.data_apontamento >= $${paramIndex}`;
                params.push(filtros.data_inicio);
                paramIndex++;
            }

            if (filtros?.data_fim) {
                query += ` AND a.data_apontamento <= $${paramIndex}`;
                params.push(filtros.data_fim);
                paramIndex++;
            }

            if (filtros?.operador_id) {
                query += ` AND a.operador_id = $${paramIndex}`;
                params.push(filtros.operador_id);
                paramIndex++;
            }

            query += ' ORDER BY a.data_apontamento DESC';

            const result = await pool.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('Erro ao listar apontamentos:', error);
            throw error;
        }
    }

    /**
     * Buscar apontamento por ID
     */
    async buscarPorId(id: number) {
        try {
            const result = await pool.query(`
        SELECT 
          a.*,
          u.nome as operador_nome,
          op.numero_op,
          op.sku_produto,
          p.nome as produto_nome
        FROM obsidian.apontamentos_producao a
        LEFT JOIN obsidian.usuarios u ON u.id = a.operador_id
        LEFT JOIN obsidian.ordens_producao op ON op.id = a.op_id
        LEFT JOIN obsidian.produtos p ON p.sku = op.sku_produto
        WHERE a.id = $1
      `, [id]);

            return result.rows[0] || null;
        } catch (error) {
            console.error('Erro ao buscar apontamento:', error);
            throw error;
        }
    }

    /**
     * Criar apontamento de produção
     * NOTA: Os triggers do banco já atualizam a OP e o estoque automaticamente
     */
    async criarApontamento(apontamento: Omit<ApontamentoProducao, 'id'>, userEmail?: string) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Validar OP
            const opResult = await client.query(
                'SELECT * FROM obsidian.ordens_producao WHERE id = $1',
                [apontamento.op_id]
            );
            const op = opResult.rows[0];

            if (!op) {
                throw new Error('OP não encontrada');
            }

            if (op.status !== 'em_producao' && op.status !== 'pausada') {
                throw new Error(`OP não está em produção. Status atual: ${op.status}`);
            }

            // Validar quantidade
            if (apontamento.quantidade_produzida <= 0) {
                throw new Error('Quantidade produzida deve ser maior que zero');
            }

            const quantidadeTotal = op.quantidade_produzida + apontamento.quantidade_produzida;
            if (quantidadeTotal > op.quantidade_planejada) {
                // Permitir, mas avisar
                console.warn(`Produção excede o planejado. Planejado: ${op.quantidade_planejada}, Total: ${quantidadeTotal}`);
            }

            // Inserir apontamento
            const insertResult = await client.query(`
        INSERT INTO obsidian.apontamentos_producao (
          op_id, quantidade_produzida, quantidade_refugo, motivo_refugo,
          tempo_producao_minutos, operador_id, observacoes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
                apontamento.op_id,
                apontamento.quantidade_produzida,
                apontamento.quantidade_refugo || 0,
                apontamento.motivo_refugo || null,
                apontamento.tempo_producao_minutos || null,
                apontamento.operador_id || null,
                apontamento.observacoes || null
            ]);

            const apontamentoCriado = insertResult.rows[0];

            // Registrar refugo se houver
            if (apontamento.quantidade_refugo && apontamento.quantidade_refugo > 0) {
                await client.query(`
          INSERT INTO obsidian.refugos (
            op_id, apontamento_id, sku_produto, quantidade,
            tipo_problema, motivo, registrado_por
          ) VALUES ($1, $2, $3, $4, 'refugo', $5, $6)
        `, [
                    apontamento.op_id,
                    apontamentoCriado.id,
                    op.sku_produto,
                    apontamento.quantidade_refugo,
                    apontamento.motivo_refugo || 'Não especificado',
                    apontamento.operador_id
                ]);

                // Registrar movimento de refugo
                await client.query(`
          INSERT INTO obsidian.estoque_movimentos (
            sku, tipo, quantidade, origem_tabela, origem_id, observacao
          ) VALUES ($1, 'refugo', $2, 'apontamentos_producao', $3, $4)
        `, [
                    op.sku_produto,
                    -apontamento.quantidade_refugo,
                    apontamentoCriado.id.toString(),
                    `Refugo OP ${op.numero_op}: ${apontamento.motivo_refugo || 'Não especificado'}`
                ]);
            }

            await client.query('COMMIT');

            // Log de auditoria
            if (userEmail) {
                await logActivity({
                    user_email: userEmail,
                    action: 'apontamento_created',
                    entity_type: 'apontamento_producao',
                    entity_id: apontamentoCriado.id.toString(),
                    details: {
                        op_id: apontamento.op_id,
                        numero_op: op.numero_op,
                        quantidade_produzida: apontamento.quantidade_produzida,
                        quantidade_refugo: apontamento.quantidade_refugo
                    }
                });

                if (apontamento.quantidade_refugo && apontamento.quantidade_refugo > 0) {
                    await logActivity({
                        user_email: userEmail,
                        action: 'refugo_registered',
                        entity_type: 'refugo',
                        entity_id: op.numero_op,
                        details: {
                            quantidade: apontamento.quantidade_refugo,
                            motivo: apontamento.motivo_refugo
                        }
                    });
                }
            }

            return await this.buscarPorId(apontamentoCriado.id);
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao criar apontamento:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Atualizar apontamento (apenas observações)
     */
    async atualizarApontamento(id: number, observacoes: string, userEmail?: string) {
        try {
            const result = await pool.query(`
        UPDATE obsidian.apontamentos_producao
        SET observacoes = $1
        WHERE id = $2
        RETURNING *
      `, [observacoes, id]);

            if (userEmail) {
                await logActivity({
                    user_email: userEmail,
                    action: 'apontamento_updated',
                    entity_type: 'apontamento_producao',
                    entity_id: id.toString(),
                    details: { observacoes }
                });
            }

            return result.rows[0];
        } catch (error) {
            console.error('Erro ao atualizar apontamento:', error);
            throw error;
        }
    }

    /**
     * Deletar apontamento (cuidado: pode impactar OP e estoque)
     */
    async deletarApontamento(id: number, userEmail?: string) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Buscar apontamento
            const apontResult = await client.query(
                'SELECT * FROM obsidian.apontamentos_producao WHERE id = $1',
                [id]
            );
            const apontamento = apontResult.rows[0];

            if (!apontamento) {
                throw new Error('Apontamento não encontrado');
            }

            // Reverter quantidade produzida na OP
            await client.query(`
        UPDATE obsidian.ordens_producao
        SET quantidade_produzida = quantidade_produzida - $1,
            quantidade_refugo = quantidade_refugo - $2,
            status = CASE 
              WHEN status = 'concluida' THEN 'em_producao'
              ELSE status
            END,
            atualizado_em = now()
        WHERE id = $3
      `, [
                apontamento.quantidade_produzida,
                apontamento.quantidade_refugo || 0,
                apontamento.op_id
            ]);

            // Buscar OP para pegar SKU
            const opResult = await client.query(
                'SELECT sku_produto FROM obsidian.ordens_producao WHERE id = $1',
                [apontamento.op_id]
            );
            const sku_produto = opResult.rows[0].sku_produto;

            // Reverter estoque de produto acabado
            await client.query(`
        INSERT INTO obsidian.estoque_movimentos (
          sku, tipo, quantidade, origem_tabela, origem_id, observacao
        ) VALUES ($1, 'ajuste', $2, 'apontamentos_producao', $3, $4)
      `, [
                sku_produto,
                -apontamento.quantidade_produzida,
                id.toString(),
                `Reversão apontamento deletado #${id}`
            ]);

            await client.query(`
        UPDATE obsidian.produtos
        SET quantidade_atual = quantidade_atual - $1,
            atualizado_em = now()
        WHERE sku = $2
      `, [apontamento.quantidade_produzida, sku_produto]);

            // Deletar apontamento
            await client.query('DELETE FROM obsidian.apontamentos_producao WHERE id = $1', [id]);

            await client.query('COMMIT');

            // Log de auditoria
            if (userEmail) {
                await logActivity({
                    user_email: userEmail,
                    action: 'apontamento_deleted',
                    entity_type: 'apontamento_producao',
                    entity_id: id.toString(),
                    details: apontamento
                });
            }

            return { success: true, message: 'Apontamento deletado com sucesso' };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao deletar apontamento:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Obter estatísticas de produção por período
     */
    async estatisticasPorPeriodo(data_inicio: string, data_fim: string) {
        try {
            const result = await pool.query(`
        SELECT 
          COUNT(DISTINCT a.op_id) as total_ops,
          COUNT(a.id) as total_apontamentos,
          SUM(a.quantidade_produzida) as total_produzido,
          SUM(a.quantidade_refugo) as total_refugo,
          ROUND(AVG(a.quantidade_produzida)::numeric, 2) as media_producao,
          ROUND((SUM(a.quantidade_refugo)::numeric / NULLIF(SUM(a.quantidade_produzida + a.quantidade_refugo), 0) * 100), 2) as taxa_refugo_percentual
        FROM obsidian.apontamentos_producao a
        WHERE a.data_apontamento >= $1::timestamp
          AND a.data_apontamento <= $2::timestamp
      `, [data_inicio, data_fim]);

            return result.rows[0];
        } catch (error) {
            console.error('Erro ao buscar estatísticas:', error);
            throw error;
        }
    }
}

export const apontamentoService = new ApontamentoService();
export default apontamentoService;

