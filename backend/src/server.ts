import 'dotenv/config';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import router from './routes.js';
import { HttpError } from './errors.js';
import { pool } from './db.js';

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '128kb' }));
app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'up' }); }
  catch { res.status(503).json({ status: 'degraded', database: 'down' }); }
});
app.use('/api', router);
app.use((_req, _res, next) => next(new HttpError(404, 'Endpoint not found')));
const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof HttpError) { res.status(error.status).json({ error: error.message }); return; }
  if (error instanceof SyntaxError && 'body' in error) { res.status(400).json({ error: 'Invalid JSON' }); return; }
  console.error('Unexpected API error', error);
  res.status(500).json({ error: 'Internal server error' });
};
app.use(errors);

try { await pool.query('SELECT 1'); }
catch (error) {
  console.error('Cannot connect to PostgreSQL. Check DATABASE_URL and that the database is running.', error);
  process.exit(1);
}
const port = Number(process.env.PORT || 4000);
const server = app.listen(port, () => console.log(`CloudDeploy API listening on http://localhost:${port}/api`));
const shutdown = () => server.close(() => { void pool.end().finally(() => process.exit(0)); });
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
