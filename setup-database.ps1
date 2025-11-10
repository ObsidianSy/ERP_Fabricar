# ============================================================================
# Script para configurar o banco de dados ERP Fábrica no EasyPanel
# ============================================================================

Write-Host "🚀 Configurando banco de dados ERP Fábrica..." -ForegroundColor Cyan

# Credenciais do opus_one
$DB_HOST = "72.60.147.138"
$DB_PORT = "5432"
$DB_USER = "postgres"
$DB_PASSWORD = "bb6cc576ca06d83f4b3d"
$DB_NAME = "erp_fabrica"

# Definir variável de ambiente para senha (evita prompt)
$env:PGPASSWORD = $DB_PASSWORD

Write-Host ""
Write-Host "📦 Passo 1: Criando database 'erp_fabrica'..." -ForegroundColor Yellow

# Criar database (conectando ao postgres padrão)
$createDb = @"
SELECT 'Database erp_fabrica já existe!' as status
FROM pg_database WHERE datname = 'erp_fabrica'
UNION ALL
SELECT 'Database erp_fabrica criado!' as status
FROM (SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'erp_fabrica') x
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'erp_fabrica');
CREATE DATABASE erp_fabrica;
"@

try {
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE erp_fabrica;" 2>$null
    Write-Host "✅ Database criado/verificado com sucesso!" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Database pode já existir (isso é ok)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📋 Passo 2: Executando migration inicial..." -ForegroundColor Yellow

# Executar migration
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "backend/migrations/000_initial_complete.sql"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "🎉 SUCESSO! Banco configurado!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Informações da conexão:" -ForegroundColor Cyan
    Write-Host "   Host: $DB_HOST"
    Write-Host "   Port: $DB_PORT"
    Write-Host "   Database: $DB_NAME"
    Write-Host "   User: $DB_USER"
    Write-Host ""
    Write-Host "🔥 Próximos passos:" -ForegroundColor Yellow
    Write-Host "   1. cd backend"
    Write-Host "   2. npm run dev"
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Erro ao executar migration!" -ForegroundColor Red
    Write-Host "   Verifique se o PostgreSQL está acessível em $DB_HOST" -ForegroundColor Red
}

# Limpar senha da memória
$env:PGPASSWORD = ""
