import { readFile } from 'node:fs/promises';
import { pool, withTransaction } from './db.js';
import { encryptEnvironmentValue, isEncryptedEnvironmentValue } from './environment-crypto.js';

const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
await pool.query(schema);
await withTransaction(async client => {
  const { rows } = await client.query<{ project_id: string; key: string; value: string }>(
    'SELECT project_id, key, value FROM environment_variables FOR UPDATE',
  );
  for (const row of rows) {
    if (!isEncryptedEnvironmentValue(row.value)) {
      await client.query(
        'UPDATE environment_variables SET value = $3 WHERE project_id = $1 AND key = $2',
        [row.project_id, row.key, encryptEnvironmentValue(row.value)],
      );
    }
  }
});
console.log('Database schema is up to date.');
await pool.end();
