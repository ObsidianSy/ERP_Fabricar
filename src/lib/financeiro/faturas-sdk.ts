import { api } from '@/lib/api';

export interface FaturaItem {
    id: string;
    descricao: string;
    valor: number;
    data_compra: string;
    parcela_numero?: number;
    parcela_total?: number;
    parcela_group_id?: string;
    categoria_id?: string;
    categoria_nome?: string;
    categoria_tipo?: string;
    observacoes?: string;
}

export interface Fatura {
    id: string;
    cartao_id: string;
    cartao_apelido: string;
    competencia: string;
    data_fechamento: string;
    data_vencimento: string;
    valor_total: number;
    valor_pago: number;
    status: 'aberta' | 'fechada' | 'paga' | 'vencida';
    created_at: string;
    total_itens?: number;
    itens?: FaturaItem[];
}

export interface FaturaFiltros {
    cartao_id?: string;
    competencia?: string;
    status?: 'aberta' | 'fechada' | 'paga' | 'vencida';
}

export interface AdicionarItemData {
    cartao_id: string;
    descricao: string;
    valor_total: number;
    data_compra: string;
    categoria_id?: string;
    parcelas?: number;
    observacoes?: string;
}

export interface PagarFaturaData {
    valor_pago?: number;
    data_pagamento?: string;
}

export const faturasAPI = {
    /**
     * Listar faturas com filtros
     */
    async listar(filtros?: FaturaFiltros): Promise<Fatura[]> {
        const params = new URLSearchParams();
        if (filtros?.cartao_id) params.append('cartao_id', filtros.cartao_id);
        if (filtros?.competencia) params.append('competencia', filtros.competencia);
        if (filtros?.status) params.append('status', filtros.status);

        const queryString = params.toString();
        const url = `/financeiro/faturas${queryString ? `?${queryString}` : ''}`;

        const response = await api.get<{ success: boolean; data: Fatura[] }>(url);
        return response.data;
    },

    /**
     * Buscar fatura específica com itens
     */
    async buscar(id: string): Promise<Fatura> {
        const response = await api.get<{ success: boolean; data: Fatura }>(`/financeiro/faturas/${id}`);
        return response.data;
    },

    /**
     * Fechar fatura
     */
    async fechar(id: string): Promise<Fatura> {
        const response = await api.post<{ success: boolean; data: Fatura }>(`/financeiro/faturas/${id}/fechar`);
        return response.data;
    },

    /**
     * Pagar fatura (cria transação automaticamente)
     */
    async pagar(id: string, data?: PagarFaturaData): Promise<any> {
        const response = await api.post<{ success: boolean; data: any }>(
            `/financeiro/faturas/${id}/pagar`,
            data || {}
        );
        return response.data;
    },

    /**
     * Adicionar item à fatura (suporta parcelamento!)
     */
    async adicionarItem(data: AdicionarItemData): Promise<any> {
        const response = await api.post<{ success: boolean; data: any }>(
            '/financeiro/faturas-itens',
            data
        );
        return response.data;
    },

    /**
     * Atualizar item da fatura
     */
    async atualizarItem(id: string, data: Partial<AdicionarItemData>): Promise<FaturaItem> {
        const response = await api.put<{ success: boolean; data: FaturaItem }>(
            `/financeiro/faturas-itens/${id}`,
            data
        );
        return response.data;
    },

    /**
     * Deletar item da fatura (soft delete)
     */
    async deletarItem(id: string): Promise<void> {
        await api.delete(`/financeiro/faturas-itens/${id}`);
    }
};
