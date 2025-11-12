import { useState, useEffect, useCallback } from 'react';
import { cartoesAPI, Cartao } from '@/lib/financeiro';

export type Card = Cartao;

interface UseCardsReturn {
    cards: Card[];
    activeCards: Card[];
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
}

/**
 * Hook para gerenciar cartões de crédito
 * Busca automaticamente ao montar e fornece método de refresh
 */
export function useCards(): UseCardsReturn {
    const [cards, setCards] = useState<Card[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const loadCards = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await cartoesAPI.listar();
            setCards(data);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Erro ao carregar cartões');
            setError(error);
            console.error('Erro ao carregar cartões:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCards();
    }, [loadCards]);

    // Filtrar apenas cartões ativos
    const activeCards = cards.filter(card => card.ativo);

    return {
        cards,
        activeCards,
        loading,
        error,
        refresh: loadCards
    };
}
