/**
 * Helper para exibir mensagens de erro amigáveis no frontend
 */

interface ApiError {
  error?: string;
  message?: string;
  details?: string;
  code?: string;
}

/**
 * Extrai a mensagem de erro mais útil de uma resposta de API
 */
export function getErrorMessage(error: unknown): string {
  // Se for uma string direta
  if (typeof error === 'string') {
    return error;
  }

  // Se for um Error nativo
  if (error instanceof Error) {
    return error.message;
  }

  // Se for um objeto com campos de erro da API
  if (error && typeof error === 'object') {
    const apiError = error as ApiError;
    
    // Priorizar a mensagem traduzida do backend
    if (apiError.error) {
      return apiError.error;
    }
    
    if (apiError.message) {
      return apiError.message;
    }
    
    if (apiError.details) {
      return apiError.details;
    }
  }

  // Fallback genérico
  return 'Erro inesperado. Tente novamente';
}

/**
 * Extrai mensagem de erro de uma resposta fetch
 */
export async function extractErrorFromResponse(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return getErrorMessage(data);
  } catch {
    // Se não conseguir parsear JSON, usar status text
    return response.statusText || `Erro ${response.status}`;
  }
}

/**
 * Mensagens user-friendly para erros comuns
 */
export const ERROR_MESSAGES = {
  NETWORK: 'Sem conexão com o servidor. Verifique sua internet',
  UNAUTHORIZED: 'Sessão expirada. Faça login novamente',
  FORBIDDEN: 'Você não tem permissão para esta ação',
  NOT_FOUND: 'Registro não encontrado',
  CONFLICT: 'Este registro já existe no sistema',
  SERVER_ERROR: 'Erro no servidor. Tente novamente em alguns instantes',
  TIMEOUT: 'A requisição demorou muito. Tente novamente',
  VALIDATION: 'Verifique os dados e tente novamente'
} as const;

/**
 * Mapeia status HTTP para mensagens amigáveis
 */
export function getErrorMessageByStatus(status: number, defaultMessage?: string): string {
  switch (status) {
    case 400:
      return defaultMessage || ERROR_MESSAGES.VALIDATION;
    case 401:
      return ERROR_MESSAGES.UNAUTHORIZED;
    case 403:
      return ERROR_MESSAGES.FORBIDDEN;
    case 404:
      return ERROR_MESSAGES.NOT_FOUND;
    case 409:
      return defaultMessage || ERROR_MESSAGES.CONFLICT;
    case 500:
    case 502:
    case 503:
      return ERROR_MESSAGES.SERVER_ERROR;
    case 504:
      return ERROR_MESSAGES.TIMEOUT;
    default:
      return defaultMessage || ERROR_MESSAGES.SERVER_ERROR;
  }
}
