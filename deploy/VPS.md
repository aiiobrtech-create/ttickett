# Deploy TTICKETT em VPS

Requisitos: **Node.js 20+**, acesso SSH, domínio (opcional, recomendado para HTTPS e webhook de e-mail).

## 1. Variáveis de ambiente

Na VPS, crie `/opt/ttickett/.env` (ou o caminho que usar) a partir de `.env.example`:

- **Obrigatórias:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (e demais chaves que você já usa).
- **Produção na VPS:** `LISTEN_HOST=0.0.0.0` (o Node escuta em todas as interfaces; Nginx faz proxy na 443).
- **Porta:** `PORT=3000` (ou outra; alinhe com o Nginx `upstream`).
- **E-mail (se usar):** `EMAIL_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`.

O build do Vite embute `VITE_*` no front-end no momento do `npm run build`. Gere o build **com o `.env` de produção** já preenchido (ou exporte as variáveis antes do build no CI).

## 2. Opção A — Node direto (systemd)

```bash
sudo mkdir -p /opt/ttickett && sudo chown "$USER:$USER" /opt/ttickett
cd /opt/ttickett
git clone <seu-repositório> .
# ou envie os arquivos com rsync/scp

npm ci
npm run build
```

Copie o serviço e ajuste `User`/`Group`/`WorkingDirectory` se não for `www-data` nem `/opt/ttickett`:

```bash
sudo cp deploy/systemd/ttickett.service /etc/systemd/system/
sudo nano /etc/systemd/system/ttickett.service
sudo systemctl daemon-reload
sudo systemctl enable --now ttickett
sudo systemctl status ttickett
```

Teste: `curl -s http://127.0.0.1:3000/__health`

## 3. Opção B — PM2

```bash
cd /opt/ttickett
npm ci
npm run build
sudo npm i -g pm2
pm2 start deploy/pm2.ecosystem.cjs
pm2 save
pm2 startup   # siga a linha que o comando imprimir (sudo ...)
```

## 4. Opção C — Docker

Na pasta do projeto (com `.env` ao lado do `docker-compose.yml`):

```bash
docker compose up -d --build
```

Porta no host: `HOST_PORT=8080 docker compose up -d` (mapeia 8080 → 3000 no container).

## 5. Nginx (HTTPS na frente do Node)

Use `deploy/nginx/ttickett.conf.example`: ajuste `server_name`, certificados SSL e, se mudar a porta interna, o `upstream`.

Certificado (exemplo com Certbot):

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d seu-dominio.com.br
```

## 6. Supabase

Execute as migrações SQL do diretório `supabase/migrations` no projeto Supabase de **produção**.

No painel Supabase, em **Authentication → URL configuration**, inclua a URL pública do app (redirects / site URL conforme seu fluxo).

## 7. Pós-deploy

- Abrir o site, login, criar ticket, anexo.
- Webhook de e-mail: URL `https://seu-dominio/api/email/inbound` com o header de segredo configurado.

## Checklist rápido

| Item                         | OK |
|-----------------------------|----|
| `npm run build` com VITE_* de produção | ☐ |
| `LISTEN_HOST=0.0.0.0` na VPS          | ☐ |
| Nginx + SSL                          | ☐ |
| Migrações Supabase                   | ☐ |
| `.env` não commitado                 | ☐ |
