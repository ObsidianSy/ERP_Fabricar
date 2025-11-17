/**
 * Helper para traduzir erros do PostgreSQL em mensagens amigáveis para o usuário
 */

interface ErrorTranslation {
  message: string;
  code: number;
}

interface DatabaseError {
  code?: string;
  message?: string;
  constraint?: string;
  detail?: string;
  column?: string;
  stack?: string;
}

export function translateDatabaseError(error: DatabaseError, context?: string): ErrorTranslation {
  const errorCode = error.code;
  const errorMessage = error.message || '';
  const constraint = error.constraint || '';
  const detail = error.detail || '';

  // Erros de constraint/unique violation
  if (errorCode === '23505') { // unique_violation
    if (constraint === 'uq_receita') {
      return {
        message: 'Não é possível adicionar a mesma matéria-prima duas vezes na mesma receita',
        code: 409
      };
    }
    if (constraint === 'usuarios_email_key' || errorMessage.includes('email')) {
      return {
        message: 'Este email já está cadastrado no sistema',
        code: 409
      };
    }
    if (constraint.includes('sku') || errorMessage.includes('sku')) {
      return {
        message: 'Este SKU já existe no sistema. Use um código único',
        code: 409
      };
    }
    if (constraint.includes('pedido_uid')) {
      return {
        message: 'Este pedido já foi importado anteriormente',
        code: 409
      };
    }
    return {
      message: `Este ${context || 'registro'} já existe no sistema`,
      code: 409
    };
  }

  // Erros de foreign key
  if (errorCode === '23503') { // foreign_key_violation
    if (errorMessage.includes('clientes')) {
      return {
        message: 'Cliente não encontrado. Certifique-se de que o cliente existe',
        code: 404
      };
    }
    if (errorMessage.includes('produtos') || errorMessage.includes('sku_produto')) {
      return {
        message: 'Produto não encontrado. Cadastre o produto antes de continuar',
        code: 404
      };
    }
    if (errorMessage.includes('materia_prima') || errorMessage.includes('sku_mp')) {
      return {
        message: 'Matéria-prima não encontrada. Cadastre a matéria-prima antes de continuar',
        code: 404
      };
    }
    if (detail.includes('still referenced')) {
      return {
        message: 'Não é possível excluir este registro pois ele está sendo usado em outros locais do sistema',
        code: 409
      };
    }
    return {
      message: `Registro relacionado não encontrado. Verifique se todos os dados necessários existem`,
      code: 404
    };
  }

  // Erro de not null
  if (errorCode === '23502') { // not_null_violation
    const column = error.column || '';
    const fieldNames: Record<string, string> = {
      nome: 'Nome',
      email: 'Email',
      sku: 'SKU',
      sku_produto: 'SKU do Produto',
      sku_mp: 'SKU da Matéria-Prima',
      quantidade: 'Quantidade',
      preco: 'Preço',
      client_id: 'Cliente'
    };
    const fieldName = fieldNames[column] || column || 'campo obrigatório';
    return {
      message: `O campo "${fieldName}" é obrigatório e não pode estar vazio`,
      code: 400
    };
  }

  // Erro de check constraint
  if (errorCode === '23514') { // check_violation
    return {
      message: 'Valor inválido. Verifique se os dados estão no formato correto',
      code: 400
    };
  }

  // Erro de tipo de dado
  if (errorCode === '22P02' || errorCode === '22003') {
    return {
      message: 'Formato de dado inválido. Verifique números, datas e valores',
      code: 400
    };
  }

  // Erro de conexão/timeout
  if (errorCode === 'ECONNREFUSED' || errorCode === 'ETIMEDOUT') {
    return {
      message: 'Não foi possível conectar ao banco de dados. Tente novamente em alguns instantes',
      code: 503
    };
  }

  // Erro genérico (fallback)
  return {
    message: context 
      ? `Erro ao processar ${context}: ${errorMessage}`
      : `Erro ao processar requisição: ${errorMessage}`,
    code: 500
  };
}

/**
 * Formata resposta de erro para o cliente
 */
export function formatErrorResponse(error: DatabaseError, context?: string) {
  const translation = translateDatabaseError(error, context);
  
  return {
    error: translation.message,
    code: error.code || 'UNKNOWN',
    statusCode: translation.code,
    // Incluir detalhes técnicos apenas em dev
    ...(process.env.NODE_ENV === 'development' && {
      details: error.message,
      stack: error.stack
    })
  };
}
