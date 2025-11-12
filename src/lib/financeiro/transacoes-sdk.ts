import { api } from '@/lib/api';

// Tipo do frontend (mais intuitivo)
export type TipoTransacaoFrontend = 'receita' | 'despesa' | 'transferencia';
// Tipo do backend
export type TipoTransacaoBackend = 'credito' | 'debito' | 'transferencia';
// Status
export type StatusTransacao = 'previsto' | 'liquidado' | 'cancelado';

export interface Transacao {
    id: string;
    descricao: string;
    valor: number;
    tipo: TipoTransacaoBackend;
    data_transacao: string;
    data_compensacao?: string;
    status: StatusTransacao;
    origem: string;
    referencia?: string;
    conta_id: string;
    conta_nome?: string;
    conta_destino_id?: string;
    conta_destino_nome?: string;
    categoria_id?: string;
    categoria_nome?: string;
    categoria_tipo?: string;
    observacoes?: string;
    created_at: string;
}

export interface CriarTransacaoData {
    descricao: string;
    valor: number;
    tipo: TipoTransacaoBackend;
    data_transacao: string;
    data_compensacao?: string;
    status?: 'previsto' | 'liquidado';
    conta_id: string;
    conta_destino_id?: string;
    categoria_id?: string;
    observacoes?: string;
}

export interface TransacaoFiltros {
    conta_id?: string;
    tipo?: TipoTransacaoBackend;
    status?: StatusTransacao;
    data_inicio?: string;
    data_fim?: string;
}

/**
 * Helper: Converte tipo do frontend (receita/despesa) para backend (credito/debito)
 */
export function frontendParaBackend(tipo: TipoTransacaoFrontend): TipoTransacaoBackend {
    if (tipo === 'receita') return 'credito';
    if (tipo === 'despesa') return 'debito';
    return 'transferencia';
}

/**
 * Helper: Converte tipo do backend (credito/debito) para frontend (receita/despesa)
 */
export function backendParaFrontend(tipo: TipoTransacaoBackend): TipoTransacaoFrontend {
    if (tipo === 'credito') return 'receita';
    if (tipo === 'debito') return 'despesa';
    return 'transferencia';
}

export const transacoesAPI = {
    /**
     * Listar transações com filtros
     */
    async listar(filtros?: TransacaoFiltros): Promise<Transacao[]> {
        const params = new URLSearchParams();
        if (filtros?.conta_id) params.append('conta_id', filtros.conta_id);
        if (filtros?.tipo) params.append('tipo', filtros.tipo);
        if (filtros?.status) params.append('status', filtros.status);
        if (filtros?.data_inicio) params.append('data_inicio', filtros.data_inicio);
        if (filtros?.data_fim) params.append('data_fim', filtros.data_fim);

        const queryString = params.toString();
        const url = `/financeiro/transacoes${queryString ? `?${queryString}` : ''}`;

        const response = await api.get<{ success: boolean; data: Transacao[] }>(url);
        return response.data;
    },

    /**
     * Criar nova transação
     */
    async criar(data: CriarTransacaoData): Promise<Transacao> {
        const response = await api.post<{ success: boolean; data: Transacao }>('/financeiro/transacoes', data);
        return response.data;
    },

    /**
     * Atualizar transação (apenas se não liquidada)
     */
    async atualizar(id: string, data: Partial<CriarTransacaoData>): Promise<Transacao> {
        const response = await api.put<{ success: boolean; data: Transacao }>(`/financeiro/transacoes/${id}`, data);
        return response.data;
    },

    /**
     * Liquidar transação (atualiza saldo automaticamente)
     */
    async liquidar(id: string, data_compensacao?: string): Promise<Transacao> {
        const response = await api.post<{ success: boolean; data: Transacao }>(
            `/financeiro/transacoes/${id}/liquidar`,
            { data_compensacao }
        );
        return response.data;
    },

    /**
     * Deletar/Cancelar transação
     */
    async deletar(id: string): Promise<void> {
        await api.delete(`/financeiro/transacoes/${id}`);
    }
};
