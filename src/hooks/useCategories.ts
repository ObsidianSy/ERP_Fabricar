import { useState, useEffect, useCallback } from 'react';
import { categoriasAPI, Categoria } from '@/lib/financeiro';

export type Category = Categoria;

interface UseCategoriesReturn {
    categories: Category[];
    despesas: Category[];
    receitas: Category[];
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
}

/**
 * Hook para gerenciar categorias
 * Busca automaticamente ao montar e fornece método de refresh
 */
export function useCategories(): UseCategoriesReturn {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const loadCategories = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await categoriasAPI.listar();
            setCategories(data);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Erro ao carregar categorias');
            setError(error);
            console.error('Erro ao carregar categorias:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    // Filtrar por tipo
    const despesas = categories.filter(cat => cat.tipo === 'despesa');
    const receitas = categories.filter(cat => cat.tipo === 'receita');

    return {
        categories,
        despesas,
        receitas,
        loading,
        error,
        refresh: loadCategories
    };
}
