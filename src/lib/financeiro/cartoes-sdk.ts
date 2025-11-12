import { api } from '@/lib/api';

export interface Cartao {
    id: string;
    apelido: string;
    bandeira?: string;
    ultimos_digitos?: string;
    limite: number;
    dia_fechamento: number;
    dia_vencimento: number;
    conta_pagamento_id?: string;
    conta_pagamento_nome?: string;
    ativo: boolean;
    created_at: string;
    updated_at: string;
    // Campos calculados (retornados pela view)
    limite_utilizado?: number;
    faturas_abertas?: number;
}

export interface CriarCartaoData {
    apelido: string;
    bandeira?: string;
    ultimos_digitos?: string;
    limite: number;
    dia_fechamento: number;
    dia_vencimento: number;
    conta_pagamento_id?: string;
}

export interface AtualizarCartaoData {
    apelido?: string;
    bandeira?: string;
    ultimos_digitos?: string;
    limite?: number;
    dia_fechamento?: number;
    dia_vencimento?: number;
    conta_pagamento_id?: string;
    ativo?: boolean;
}

export const cartoesAPI = {
    /**
     * Listar todos os cartões do usuário
     */
    async listar(): Promise<Cartao[]> {
        const response = await api.get<{ success: boolean; data: Cartao[] }>('/financeiro/cartoes');
        return response.data;
    },

    /**
     * Buscar cartão específico por ID
     */
    async buscar(id: string): Promise<Cartao> {
        const response = await api.get<{ success: boolean; data: Cartao }>(`/financeiro/cartoes/${id}`);
        return response.data;
    },

    /**
     * Criar novo cartão
     */
    async criar(data: CriarCartaoData): Promise<Cartao> {
        const response = await api.post<{ success: boolean; data: Cartao }>('/financeiro/cartoes', data);
        return response.data;
    },

    /**
     * Atualizar cartão existente
     */
    async atualizar(id: string, data: AtualizarCartaoData): Promise<Cartao> {
        const response = await api.put<{ success: boolean; data: Cartao }>(`/financeiro/cartoes/${id}`, data);
        return response.data;
    },

    /**
     * Deletar cartão (soft delete)
     */
    async deletar(id: string): Promise<void> {
        await api.delete(`/financeiro/cartoes/${id}`);
    }
};
