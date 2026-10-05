import 'dotenv/config';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set. Copy .env.example to .env and point it at your PostgreSQL database.');

export const pool = new pg.Pool({
  connectionString,
  max: Number(process.env.DATABASE_POOL_MAX || 10),
  // Set DATABASE_SSL=true for hosted databases (e.g. AWS RDS) that require TLS.
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});
pool.on('error', error => console.error('Unexpected PostgreSQL pool error', error));

export async function withTransaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
