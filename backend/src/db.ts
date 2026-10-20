import 'dotenv/config';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set. Copy .env.example to .env and point it at your PostgreSQL database.');

const sslEnabled = process.env.DATABASE_SSL === 'true';
const sslCaFile = process.env.DATABASE_SSL_CA_FILE;

if (sslEnabled && !sslCaFile) {
  throw new Error('DATABASE_SSL_CA_FILE is required when DATABASE_SSL=true.');
}

// pg-connection-string SSL query options can replace the explicit `ssl` object.
// Remove those URL options so the verified CA configuration below is used.
const databaseUrl = new URL(connectionString);
if (sslEnabled) {
  for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) {
    databaseUrl.searchParams.delete(key);
  }
}

export const pool = new pg.Pool({
  connectionString: databaseUrl.toString(),
  max: Number(process.env.DATABASE_POOL_MAX || 10),
  ssl: sslEnabled
    ? { ca: readFileSync(sslCaFile!, 'utf8'), rejectUnauthorized: true }
    : undefined,
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
