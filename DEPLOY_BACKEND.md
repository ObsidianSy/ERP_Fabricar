# 🚀 Deploy do Backend no EasyPanel

## ⚠️ IMPORTANTE
Você precisa ter **2 serviços** no EasyPanel:
1. ✅ **Frontend** (docker-erp-fabrica) - já existe
2. ❌ **Backend** (precisa criar) - FALTANDO!

---

## 📋 Criar Serviço Backend

### 1. No EasyPanel → Create New Service

**Configurações Básicas:**
- **Name**: `erp-backend`
- **Type**: App
- **Source**: GitHub
- **Repository**: ObsidianSy/ERP_Fabricar
- **Branch**: main

### 2. Build Configuration

- **Build Method**: Dockerfile
- **Dockerfile Path**: `backend/Dockerfile`
- **Context Path**: `backend`

### 3. Port Configuration

- **Port**: `3001`
- **Expose publicly**: ✅ SIM (para testar)

### 4. Environment Variables

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

### 5. Deploy!

Clique em **Create** e aguarde o build.

---

## 🔧 Configurar Frontend para usar o Backend

### OPÇÃO 1: Usar nome interno (recomendado)

Se ambos os serviços estiverem na mesma rede Docker:

**No serviço `docker-erp-fabrica`:**
```env
BACKEND_URL=http://erp-backend:3001
```

### OPÇÃO 2: Usar IP público

Se o backend for exposto publicamente:

```env
BACKEND_URL=http://72.60.147.138:3001
```

⚠️ **Certifique-se que a porta 3001 está exposta no backend!**

---

## ✅ Testar

### 1. Verificar se backend está online:
```bash
curl http://72.60.147.138:3001/api/health
```

### 2. Ver logs do frontend:
- EasyPanel → docker-erp-fabrica → Logs
- Procure por: `📍 BACKEND_URL:`

### 3. Testar login:
- https://docker-erp-fabrica.q4xusi.easypanel.host/login
- Abrir console (F12)
- Tentar fazer login

---

## 🐛 Troubleshooting

### Erro 404 em /api/auth/login
**Causa**: Backend não está rodando ou não está acessível.
**Solução**: Verificar se serviço backend existe e está rodando.

### Erro 502 Bad Gateway
**Causa**: Nginx não consegue conectar ao backend.
**Solução**: 
- Verificar `BACKEND_URL` no frontend
- Verificar se ambos estão na mesma rede
- Ou expor porta do backend publicamente

### Backend não responde
**Causa**: Variáveis de ambiente incorretas ou banco não acessível.
**Solução**: Verificar logs do backend no EasyPanel.

---

## 📝 Checklist Final

- [ ] Serviço backend criado no EasyPanel
- [ ] Backend está rodando (status verde)
- [ ] Porta 3001 exposta (se usar IP público)
- [ ] Variável `BACKEND_URL` configurada no frontend
- [ ] Ambos os serviços na mesma rede (se usar nome interno)
- [ ] Frontend foi rebuilded após configurar `BACKEND_URL`
- [ ] Testou `curl http://72.60.147.138:3001/api/health`
- [ ] Login funciona sem erro 404

---

## 🎯 Próximo Passo

**CRIAR O SERVIÇO BACKEND NO EASYPANEL AGORA!** 🚀
