/**
 * Helper para fazer requisições à API com autenticação automática
 */

import { getApiUrl } from '@/config/api';

export interface ApiRequestOptions extends RequestInit {
    skipAuth?: boolean; // Para endpoints públicos (ex: login)
}

export async function apiRequest<T = any>(
    endpoint: string,
    options: ApiRequestOptions = {}
): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;

    // Montar URL
    const url = getApiUrl(endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`);
    
    // Debug: mostrar URL completa
    console.log('🔗 API Request:', {
        endpoint,
        url,
        hostname: window.location.hostname,
        fullUrl: window.location.origin + url
    });

    // Preparar headers
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
    };

    // Adicionar autenticação se não for endpoint público
    if (!skipAuth) {
        const token = localStorage.getItem('token');
        const usuarioStr = localStorage.getItem('usuario');

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Adicionar cargo do usuário para verificação de permissões
        if (usuarioStr) {
            try {
                const usuario = JSON.parse(usuarioStr);
                if (usuario.cargo) {
                    headers['x-user-cargo'] = usuario.cargo;
                }
            } catch (e) {
                console.error('Erro ao parsear usuário:', e);
            }
        }
    }

    // Fazer requisição
    const response = await fetch(url, {
        ...fetchOptions,
        headers,
    });

    // Tratar erros HTTP
    if (!response.ok) {
        let errorMessage = `Erro ${response.status}`;

        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
            errorMessage = await response.text() || errorMessage;
        }

        throw new Error(errorMessage);
    }

    // Retornar resposta
    try {
        return await response.json();
    } catch {
        return null as T;
    }
}

/**
 * Helpers específicos para métodos HTTP
 */
export const api = {
    get: <T = any>(endpoint: string, options?: ApiRequestOptions) =>
        apiRequest<T>(endpoint, { ...options, method: 'GET' }),

    post: <T = any>(endpoint: string, data?: any, options?: ApiRequestOptions) =>
        apiRequest<T>(endpoint, {
            ...options,
            method: 'POST',
            body: data ? JSON.stringify(data) : undefined,
        }),

    put: <T = any>(endpoint: string, data?: any, options?: ApiRequestOptions) =>
        apiRequest<T>(endpoint, {
            ...options,
            method: 'PUT',
            body: data ? JSON.stringify(data) : undefined,
        }),

    delete: <T = any>(endpoint: string, options?: ApiRequestOptions) =>
        apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),

    patch: <T = any>(endpoint: string, data?: any, options?: ApiRequestOptions) =>
        apiRequest<T>(endpoint, {
            ...options,
            method: 'PATCH',
            body: data ? JSON.stringify(data) : undefined,
        }),
};
