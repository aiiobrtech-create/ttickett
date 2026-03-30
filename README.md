## TTICKETT (Vite + React + Express + Supabase)

Este projeto foi ajustado para rodar **fora do Google AI Studio**, usando:
- **Frontend**: Vite + React
- **Backend**: Express (serve o Vite em dev e `dist/` em produção)
- **Banco/Auth/Storage**: Supabase

### Pré-requisitos

- **Node.js** (recomendado: versão LTS)
- Um projeto no **Supabase** (cloud) ou Supabase local via CLI (pasta `supabase/`)

### Configuração de ambiente

1. Crie um arquivo `.env` (ou `.env.local`) na raiz e copie de `.env.example`.
2. Preencha:
   - **Frontend (Vite)**:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
   - **Backend (Express)**:
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY` (recomendado para rotas server-side como upload)
     - `PORT` (opcional, padrão 3000)
   - **Deploy com front e API separados** (opcional): `VITE_API_BASE` no build do front; no servidor, `CORS_ORIGINS` (ver `.env.example`).

### Rodar localmente

1. Instale dependências:
   - `npm install` (ou `pnpm install` / `yarn`)
2. Suba:
   - `npm run dev`
3. Abra:
   - `http://localhost:3000`

### Build/produção

- Gerar build do frontend:
  - `npm run build`
- Rodar em modo produção (servindo `dist/`):
  - `npm run start:prod` (define `NODE_ENV=production` via `cross-env`)
- **Deploy em VPS / Docker / systemd / Nginx / PM2:** veja o guia em [`deploy/VPS.md`](deploy/VPS.md).

### Ajustes necessários no Supabase (cloud)

No dashboard do Supabase:

- **Auth → URL Configuration**
  - **Site URL**: `http://localhost:3000` (local) e/ou sua URL de produção
  - **Redirect URLs**: inclua `http://localhost:3000` (e as URLs de produção)

- **Storage**
  - Crie o bucket **`tickets`** (se ainda não existir)
  - Se quiser links públicos, marque o bucket como **public**
  - Políticas sugeridas estão em `supabase/storage.sql` (ajuste conforme sua regra de negócio)
