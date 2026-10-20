# CloudDeploy

React (Vite) frontend + Node/Express backend (TypeScript) + PostgreSQL.

## Run locally

```bash
# 1. database
docker compose up -d                  # or use any PostgreSQL and set DATABASE_URL

# 2. backend  (http://localhost:4000/api)
cd backend
cp .env.example .env
# Generate a stable local encryption key and add it to backend/.env:
openssl rand -hex 32
npm install
npm run db:migrate
npm run db:seed                       # optional demo data
npm run dev

# 3. frontend  (http://localhost:5173)
cd ../frontend
npm install
npm run dev
```

## Tests (backend)

Set `TEST_DATABASE_URL` to a throwaway database, then `npm test` in `backend/`. Docker Compose creates `clouddeploy_test` when it initializes a new PostgreSQL volume; for an existing volume, create that test database manually before running tests.

## Production build

```bash
cd backend && npm run build && node dist/migrate.js && npm start
cd frontend && npm run build          # static files in dist/
```
Set `ENVIRONMENT_ENCRYPTION_KEY` in `backend/.env` to a stable 64-character hex key. Back it up securely; changing or losing it makes encrypted environment values unreadable. Set `DATABASE_SSL=true` for hosted databases that require TLS (e.g. AWS RDS), and `FRONTEND_URL` / `VITE_API_URL` to your real origins.

## Secrets management and CI/CD

- Self-hosted HashiCorp Vault is deferred to accelerate the initial delivery.
- GitHub Actions Secrets are for CI/CD credentials, including Docker Hub tokens and other workflow secrets. For future AWS access from GitHub Actions, prefer GitHub OIDC with a least-privilege IAM role over long-lived AWS access keys.
- GitHub Actions Secrets are not the runtime secrets manager for CloudDeploy or its customers. Until a complete runtime secrets design is implemented, Kubernetes and backend database credentials must use a carefully restricted mechanism and must never be committed to the repository.
