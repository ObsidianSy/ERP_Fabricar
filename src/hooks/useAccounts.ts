import { useState, useEffect, useCallback } from 'react';
import { contasAPI, Conta } from '@/lib/financeiro';

export type Account = Conta;

interface UseAccountsReturn {
    accounts: Account[];
    activeAccounts: Account[];
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
}

/**
 * Hook para gerenciar contas bancárias
 * Busca automaticamente ao montar e fornece método de refresh
 */
export function useAccounts(): UseAccountsReturn {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const loadAccounts = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await contasAPI.listar();
            setAccounts(data);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Erro ao carregar contas');
            setError(error);
            console.error('Erro ao carregar contas:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAccounts();
    }, [loadAccounts]);

    // Filtrar apenas contas ativas
    const activeAccounts = accounts.filter(account => account.ativo);

    return {
        accounts,
        activeAccounts,
        loading,
        error,
        refresh: loadAccounts
    };
}
