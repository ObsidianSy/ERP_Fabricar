#!/bin/sh
# Script para substituir a URL do backend no nginx.conf em runtime

# Valor padrão: usa o IP do host do banco de dados
# No EasyPanel, use o IP público ou nome correto do serviço backend
BACKEND_URL=${BACKEND_URL:-"http://72.60.147.138:3001"}

echo "=========================================="
echo "🔧 Configurando Nginx para ERP Fábrica"
echo "=========================================="
echo "📍 BACKEND_URL: $BACKEND_URL"
echo ""

# Substitui no nginx.conf
echo "📝 Substituindo BACKEND_URL_PLACEHOLDER..."
sed -i "s|BACKEND_URL_PLACEHOLDER|$BACKEND_URL|g" /etc/nginx/conf.d/default.conf

# Verifica se a substituição funcionou
echo ""
echo "✅ Configuração do proxy /api/:"
grep -A 2 "location /api/" /etc/nginx/conf.d/default.conf | grep proxy_pass

echo ""
echo "🚀 Iniciando Nginx..."
echo "=========================================="

# Inicia o nginx
nginx -g "daemon off;"
