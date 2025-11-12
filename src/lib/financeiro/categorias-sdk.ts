import { api } from '@/lib/api';

export interface Categoria {
    id: string;
    tenant_id?: string;
    nome: string;
    tipo: 'despesa' | 'receita' | 'transferencia';
    parent_id?: string;
    parent_nome?: string;
    icone?: string;
    cor?: string;
    is_global: boolean;
    created_at: string;
}

export interface CriarCategoriaData {
    nome: string;
    tipo: 'despesa' | 'receita' | 'transferencia';
    parent_id?: string;
    icone?: string;
    cor?: string;
}

export const categoriasAPI = {
    /**
     * Listar categorias (globais + customizadas do usuário)
     */
    async listar(tipo?: 'despesa' | 'receita' | 'transferencia'): Promise<Categoria[]> {
        const url = tipo ? `/financeiro/categorias?tipo=${tipo}` : '/financeiro/categorias';
        const response = await api.get<{ success: boolean; data: Categoria[] }>(url);
        return response.data;
    },

    /**
     * Criar categoria customizada
     */
    async criar(data: CriarCategoriaData): Promise<Categoria> {
        const response = await api.post<{ success: boolean; data: Categoria }>('/financeiro/categorias', data);
        return response.data;
    },

    /**
     * Atualizar categoria customizada
     */
    async atualizar(id: string, data: Partial<CriarCategoriaData>): Promise<Categoria> {
        const response = await api.put<{ success: boolean; data: Categoria }>(`/financeiro/categorias/${id}`, data);
        return response.data;
    },

    /**
     * Deletar categoria customizada
     */
    async deletar(id: string): Promise<void> {
        await api.delete(`/financeiro/categorias/${id}`);
    }
};
