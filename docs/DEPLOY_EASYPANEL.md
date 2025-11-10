# Deploy no EasyPanel - ERP Fábrica

## 🚀 Estrutura de Deploy

O projeto possui 2 serviços separados:
- **Frontend (Nginx)**: docker-erp-fabrica
- **Backend (Node.js)**: opus_backend (ou criar novo)

---

## 📋 Passo a Passo

### 1️⃣ Backend (Node.js)

**No EasyPanel:**
1. Criar novo serviço (se não existir): "opus-backend" ou "erp-backend"
2. Tipo: `App`
3. Source: `GitHub` → Repositório do ERP
4. Build: `Dockerfile`
5. Dockerfile path: `backend/Dockerfile`
6. Port: `3001`

**Variáveis de Ambiente (Backend):**
```env
JWT_SECRET=0fed993aaa75f43e72ca34ce5dc1d7b2e6792dd4cc2f2a6cd6f4f3994785492d9f1a1b0b552c81a50fb7f93d71877c37c486bdcca3648231a7e0b9210a873f11
DB_HOST=72.60.147.138
DB_PORT=5432
DB_NAME=erp_fabrica
DB_USER=postgres
DB_PASSWORD=bb6cc576ca06d83f4b3d
PORT=3001
NODE_ENV=production
ALLOWED_ORIGINS=https://docker-erp-fabrica.q4xusi.easypanel.host,http://72.60.147.138
```

**Domínio Backend (opcional):**
- Criar subdomínio: `api-erp-fabrica.q4xusi.easypanel.host`
- Ou usar IP: `http://72.60.147.138:3001`

---

### 2️⃣ Frontend (Nginx)

**No EasyPanel:**
1. Serviço: "docker-erp-fabrica" (já existente)
2. Source: `GitHub` → Repositório do ERP
3. Build: `Dockerfile` (raiz do projeto)
4. Port: `80`

**Variáveis de Ambiente (Frontend):**

**OPÇÃO A - Usar IP direto do backend:**
```env
BACKEND_URL=http://72.60.147.138:3001
```

**OPÇÃO B - Usar nome do serviço interno EasyPanel:**
```env
BACKEND_URL=http://opus-backend:3001
```
*Substitua `opus-backend` pelo nome exato do serviço backend no EasyPanel*

**OPÇÃO C - Usar domínio do backend:**
```env
BACKEND_URL=https://api-erp-fabrica.q4xusi.easypanel.host
```

---

## 🔧 Configuração de Rede no EasyPanel

### Se os serviços estão na MESMA NETWORK:
1. Vá em `Settings` → `Advanced` → `Networks`
2. Adicione ambos os serviços na mesma rede customizada
3. Use o nome do serviço: `http://opus-backend:3001`

### Se os serviços estão em NETWORKS DIFERENTES:
- Use o IP público: `http://72.60.147.138:3001`
- Ou crie um domínio para o backend

---

## 🐛 Troubleshooting

### Erro: "opus_backend could not be resolved"
**Causa:** O nome do serviço está errado ou não está na mesma rede.

**Soluções:**
1. Verificar o nome EXATO do serviço backend no EasyPanel
2. Atualizar variável `BACKEND_URL` no frontend
3. Ou usar IP direto: `BACKEND_URL=http://72.60.147.138:3001`

### Erro: "502 Bad Gateway"
**Causa:** Backend não está rodando ou não está acessível.

**Verificações:**
1. Backend está rodando? Verifique logs do serviço backend
2. Porta 3001 está exposta?
3. Firewall permite conexão?

### Erro: "CORS"
**Causa:** Domínio do frontend não está em `ALLOWED_ORIGINS`.

**Solução:** Adicionar no backend:
```env
ALLOWED_ORIGINS=https://docker-erp-fabrica.q4xusi.easypanel.host,http://72.60.147.138
```

---

## ✅ Verificação

**1. Testar Backend:**
```bash
curl http://72.60.147.138:3001/api/health
```

**2. Testar Frontend:**
- Abrir: https://docker-erp-fabrica.q4xusi.easypanel.host
- Tentar fazer login
- Verificar console do navegador (F12)

**3. Verificar Logs:**
- EasyPanel → Serviço → Logs
- Procurar por erros de conexão

---

## 📝 Comandos Úteis

### Rebuild Frontend (após mudar BACKEND_URL):
```bash
git add .
git commit -m "fix: atualizar BACKEND_URL"
git push
```
- EasyPanel fará rebuild automático

### Ver logs em tempo real:
- EasyPanel → Serviço → Logs → Enable "Auto Scroll"

---

## 🔑 Resumo da Configuração Atual

| Componente | Valor |
|------------|-------|
| Frontend URL | https://docker-erp-fabrica.q4xusi.easypanel.host |
| Backend IP | 72.60.147.138:3001 |
| Banco de Dados | 72.60.147.138:5432 (erp_fabrica) |
| BACKEND_URL (recomendado) | http://72.60.147.138:3001 |

---

## 🎯 Próximos Passos

1. ✅ Atualizar `BACKEND_URL` no serviço frontend
2. ✅ Fazer commit e push das mudanças
3. ✅ Aguardar rebuild no EasyPanel
4. ✅ Testar login novamente
