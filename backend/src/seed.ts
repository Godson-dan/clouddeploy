import { pool, withTransaction } from './db.js';
import { seedDeployments, seedEnvironments, seedProjects } from './seed-data.js';

const { rows } = await pool.query<{ count: string }>('SELECT count(*) FROM projects');
if (Number(rows[0]!.count) > 0) {
  console.log('Projects already exist; skipping demo seed.');
} else {
  await withTransaction(async client => {
    for (const p of seedProjects) {
      await client.query(
        `INSERT INTO projects (id, name, repository, branch, framework, region, status, description, domain, custom_domain, cpu, memory, replicas, manifest, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [p.id, p.name, p.repository, p.branch, p.framework, p.region, p.status, p.description, p.domain, p.customDomain, p.cpu, p.memory, p.replicas, p.manifest, p.createdAt],
      );
    }
    for (const d of seedDeployments) {
      await client.query(
        `INSERT INTO deployments (id, project_id, number, status, action, branch, commit_sha, message, duration, target_deployment_id, logs, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)`,
        [d.id, d.projectId, d.number, d.status, d.action, d.branch, d.commit, d.message, d.duration, d.targetDeploymentId, JSON.stringify(d.logs), d.createdAt],
      );
    }
    for (const [projectId, entries] of Object.entries(seedEnvironments)) {
      for (const e of entries) {
        await client.query('INSERT INTO environment_variables (project_id, key, value, secret) VALUES ($1,$2,$3,$4)', [projectId, e.key, e.value, e.secret]);
      }
    }
  });
  console.log('Seeded demo projects, deployments and environment variables.');
}
await pool.end();
