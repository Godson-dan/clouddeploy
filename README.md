# CloudDeploy

React (Vite) frontend + Node/Express backend (TypeScript) + PostgreSQL.

## Run locally

```bash
# 1. database
docker compose up -d                  # or use any PostgreSQL and set DATABASE_URL

# 2. backend  (http://localhost:4000/api)
cd backend
cp .env.example .env
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

Set `TEST_DATABASE_URL` to a throwaway database, then `npm test` in `backend/`.

## Production build

```bash
cd backend && npm run build && node dist/migrate.js && npm start
cd frontend && npm run build          # static files in dist/
```
Set `DATABASE_SSL=true` for hosted databases that require TLS (e.g. AWS RDS), and `FRONTEND_URL` / `VITE_API_URL` to your real origins.
