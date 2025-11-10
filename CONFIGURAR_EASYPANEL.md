# 🚀 Configurar docker-erp-fabrica para Unified (Frontend + Backend juntos)

## 📋 Passos no EasyPanel

### 1️⃣ Ir no serviço `docker-erp-fabrica`

No EasyPanel:
- Services → **docker-erp-fabrica** → **Settings**

---

### 2️⃣ Mudar Build Configuration

**Em "Build":**
- **Dockerfile Path**: Mudar de `Dockerfile` para **`Dockerfile.unified`**
- **Context Path**: Deixar vazio ou `.` (raiz do projeto)

---

### 3️⃣ Configurar Environment Variables

**REMOVER** (se existir):
```
BACKEND_URL=http://72.60.147.138:3001
```

**ADICIONAR/MANTER** estas variáveis:

```env
NODE_ENV=production
PORT=3001

JWT_SECRET=0fed993aaa75f43e72ca34ce5dc1d7b2e6792dd4cc2f2a6cd6f4f3994785492d9f1a1b0b552c81a50fb7f93d71877c37c486bdcca3648231a7e0b9210a873f11

DB_HOST=72.60.147.138
DB_PORT=5432
DB_NAME=erp_fabrica
DB_USER=postgres
DB_PASSWORD=bb6cc576ca06d83f4b3d

ALLOWED_ORIGINS=https://docker-erp-fabrica.q4xusi.easypanel.host
```

**OPCIONAL** (para desenvolvimento local):
```env
VITE_API_URL=https://docker-erp-fabrica.q4xusi.easypanel.host
```

---

### 4️⃣ Configurar Porta

**Em "Networking":**
- **Port**: `3001` (o backend roda na 3001)
- **Expose publicly**: ✅ Sim

---

### 5️⃣ Rebuild

Clique em **Deploy** ou **Rebuild** para aplicar as mudanças.

---

## ✅ O que vai acontecer:

1. ✅ Build do **Frontend** (React/Vite)
2. ✅ Build do **Backend** (Node.js/TypeScript)
3. ✅ Backend vai servir o frontend na pasta `/public`
4. ✅ Tudo roda no **mesmo container**, porta 3001
5. ✅ Frontend acessa API no mesmo domínio (sem CORS)

---

## 🧪 Testar

### 1. Aguardar o build terminar
- Acompanhe os logs no EasyPanel
- Deve demorar 2-5 minutos

### 2. Acessar a aplicação
```
https://docker-erp-fabrica.q4xusi.easypanel.host
```

### 3. Verificar logs
- Deve aparecer: `🚀 Servidor iniciado na porta 3001`
- Não deve ter erros 404 em `/api/auth/login`

### 4. Fazer login
- Usuário: `admin@sistema.com`
- Senha: `admin123`
- Deve funcionar sem erro 404! ✅

---

## 🐛 Se der erro no build

### Erro: "Cannot find module 'typescript'"
**Solução**: O Dockerfile.unified já instala todas as dependências necessárias.

### Erro: "Port 3001 already in use"
**Solução**: Pare outros serviços usando porta 3001 ou mude a porta.

### Erro no frontend build
**Solução**: Verifique se o `package.json` na raiz tem o script `build`:
```json
"scripts": {
  "build": "vite build"
}
```

---

## 📊 Comparação: Antes vs Depois

| Aspecto | ❌ Antes (Separado) | ✅ Depois (Unified) |
|---------|-------------------|-------------------|
| Containers | 2 (Frontend + Backend) | 1 (Tudo junto) |
| Portas | 80 (Nginx) + 3001 (Backend) | 3001 (Backend serve tudo) |
| CORS | Precisa configurar | Não precisa (mesmo domínio) |
| Proxy | Nginx faz proxy | Backend serve direto |
| Complexidade | Alta | Baixa |
| Deploy | 2 serviços | 1 serviço |

---

## 🎯 Resumo do que fazer AGORA:

1. ✅ **EasyPanel** → docker-erp-fabrica → Settings
2. ✅ **Build** → Dockerfile Path: `Dockerfile.unified`
3. ✅ **Environment** → Configurar variáveis (copiar acima)
4. ✅ **Port** → 3001
5. ✅ **Deploy** → Rebuild
6. ✅ **Aguardar** → 2-5 minutos
7. ✅ **Testar** → Acessar e fazer login

---

## 🚀 Pronto!

Depois do rebuild, vai funcionar igual ao `docker-opus-unified`! 🎉
