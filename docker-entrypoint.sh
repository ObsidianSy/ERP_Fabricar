#!/bin/sh
# Script para substituir a URL do backend no nginx.conf em runtime

# Valor padrão: usa o IP do host do banco de dados
# No EasyPanel, use o IP público ou nome correto do serviço backend
BACKEND_URL=${BACKEND_URL:-"http://72.60.147.138:3001"}

echo "Configurando backend URL: $BACKEND_URL"

# Substitui no nginx.conf
sed -i "s|BACKEND_URL_PLACEHOLDER|$BACKEND_URL|g" /etc/nginx/conf.d/default.conf

# Inicia o nginx
nginx -g "daemon off;"
