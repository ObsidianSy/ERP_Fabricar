import { api } from '@/lib/api';

export interface Conta {
    id: string;
    nome: string;
    tipo: 'corrente' | 'poupanca' | 'investimento' | 'dinheiro' | 'carteira';
    saldo_inicial: number;
    saldo_atual: number;
    banco?: string;
    agencia?: string;
    conta_numero?: string;
    ativo: boolean;
    created_at: string;
    updated_at: string;
    total_transacoes?: number;
    total_creditos?: number;
    total_debitos?: number;
}

export interface CriarContaData {
    nome: string;
    tipo: string;
    saldo_inicial: number;
    banco?: string;
    agencia?: string;
    conta_numero?: string;
}

export interface AtualizarContaData {
    nome?: string;
    tipo?: string;
    saldo_inicial?: number;
    banco?: string;
    agencia?: string;
    conta_numero?: string;
    ativo?: boolean;
}

export interface ExtratoFiltros {
    data_inicio?: string;
    data_fim?: string;
    status?: 'previsto' | 'liquidado' | 'cancelado';
}

export const contasAPI = {
    /**
     * Listar todas as contas do usuário
     */
    async listar(): Promise<Conta[]> {
        const response = await api.get<{ success: boolean; data: Conta[] }>('/financeiro/contas');
        return response.data;
    },

    /**
     * Buscar conta específica por ID
     */
    async buscar(id: string): Promise<Conta> {
        const response = await api.get<{ success: boolean; data: Conta }>(`/financeiro/contas/${id}`);
        return response.data;
    },

    /**
     * Criar nova conta
     */
    async criar(data: CriarContaData): Promise<Conta> {
        const response = await api.post<{ success: boolean; data: Conta }>('/financeiro/contas', data);
        return response.data;
    },

    /**
     * Atualizar conta existente
     */
    async atualizar(id: string, data: AtualizarContaData): Promise<Conta> {
        const response = await api.put<{ success: boolean; data: Conta }>(`/financeiro/contas/${id}`, data);
        return response.data;
    },

    /**
     * Deletar conta (soft delete)
     */
    async deletar(id: string): Promise<void> {
        await api.delete(`/financeiro/contas/${id}`);
    },

    /**
     * Buscar extrato da conta
     */
    async extrato(id: string, filtros?: ExtratoFiltros): Promise<any> {
        const params = new URLSearchParams();
        if (filtros?.data_inicio) params.append('data_inicio', filtros.data_inicio);
        if (filtros?.data_fim) params.append('data_fim', filtros.data_fim);
        if (filtros?.status) params.append('status', filtros.status);

        const queryString = params.toString();
        const url = `/financeiro/contas/${id}/extrato${queryString ? `?${queryString}` : ''}`;

        const response = await api.get<{ success: boolean; data: any }>(url);
        return response.data;
    }
};
