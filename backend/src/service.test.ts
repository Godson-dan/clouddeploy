import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Tests run against TEST_DATABASE_URL (falls back to DATABASE_URL). Use a throwaway database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const { pool } = await import('./db.js');
const { CloudService } = await import('./service.js');
const { HttpError } = await import('./errors.js');
type Provider = import('./provider.js').DeploymentProvider;

const service = new CloudService();
const failing = new CloudService(undefined, { execute: async () => { throw new Error('boom'); } } satisfies Provider);
const created: string[] = [];
const newProject = async (name = 'Test Site') => {
  const project = await service.createProject({ name, repository: 'demo/test-site', branch: 'main', framework: 'React', region: 'US East · Virginia' });
  created.push(project.id);
  return project;
};

before(async () => { await pool.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')); });
after(async () => {
  for (const id of created) await pool.query('DELETE FROM projects WHERE id = $1', [id]);
  await pool.end();
});

test('new projects are stored with a demo manifest and no deployments', async () => {
  const project = await newProject();
  assert.match(project.manifest, /NOT fetched/);
  assert.equal((await service.deployments(project.id)).length, 0);
  assert.ok((await service.projects()).some(p => p.id === project.id));
  assert.equal((await service.project(project.id)).status, 'idle');
});

test('secrets are masked in writes and reads, and saving an existing key replaces it in place', async () => {
  const { id } = await newProject();
  await service.saveEnvironment(id, { key: 'FIRST', value: 'plain', secret: false });
  const result = await service.saveEnvironment(id, { key: 'TEST_SECRET', value: 'never-return-this', secret: true });
  assert.equal(result.find(e => e.key === 'TEST_SECRET')?.value, '••••••••');
  assert.equal((await service.environment(id)).find(e => e.key === 'TEST_SECRET')?.value, '••••••••');
  const replaced = await service.saveEnvironment(id, { key: 'FIRST', value: 'changed', secret: false });
  assert.deepEqual(replaced.map(e => e.key), ['FIRST', 'TEST_SECRET']);
  assert.equal(replaced[0]?.value, 'changed');
  await assert.rejects(service.saveEnvironment(id, { key: 'lowercase', value: 'x', secret: false }), HttpError);
});

test('deploy creates numbered releases and updates project status', async () => {
  const project = await newProject();
  const first = await service.deploy(project.id, 'deploy', {});
  const second = await service.deploy(project.id, 'redeploy', { targetDeploymentId: first.id });
  assert.deepEqual([first.number, second.number], [1, 2]);
  assert.equal(second.targetDeploymentId, first.id);
  assert.equal((await service.project(project.id)).status, 'healthy');
  assert.equal((await service.deployments(project.id))[0]?.id, second.id);
  assert.ok((await service.deployment(project.id, first.id)).logs.length > 0);
});

test('rollback requires a successful deployment from the same project and creates a new release', async () => {
  const a = await newProject('Project A');
  const b = await newProject('Project B');
  const good = await service.deploy(a.id, 'deploy', {});
  const bad = await failing.deploy(a.id, 'deploy', {});
  assert.equal(bad.status, 'failed');
  assert.equal((await service.project(a.id)).status, 'failed');
  const other = await service.deploy(b.id, 'deploy', {});
  await assert.rejects(service.deploy(a.id, 'rollback', { targetDeploymentId: other.id }), HttpError);
  await assert.rejects(service.deploy(a.id, 'rollback', { targetDeploymentId: bad.id }), HttpError);
  const rolledBack = await service.deploy(a.id, 'rollback', { targetDeploymentId: good.id });
  assert.equal(rolledBack.targetDeploymentId, good.id);
  assert.equal(rolledBack.action, 'rollback');
  assert.equal(rolledBack.status, 'success');
  assert.equal(rolledBack.number, 3);
  assert.equal((await service.project(a.id)).status, 'healthy');
});

test('simultaneous deploys receive distinct release numbers', async () => {
  const { id } = await newProject();
  const results = await Promise.all([1, 2, 3, 4, 5].map(() => service.deploy(id, 'deploy', {})));
  assert.deepEqual(results.map(r => r.number).sort(), [1, 2, 3, 4, 5]);
});

test('deleting a project removes its deployments and environment variables', async () => {
  const { id } = await newProject();
  await service.deploy(id, 'deploy', {});
  await service.saveEnvironment(id, { key: 'GONE', value: 'x', secret: false });
  await service.deleteProject(id);
  const count = async (table: string, column: string) => Number((await pool.query(`SELECT count(*) FROM ${table} WHERE ${column} = $1`, [id])).rows[0].count);
  assert.equal(await count('deployments', 'project_id'), 0);
  assert.equal(await count('environment_variables', 'project_id'), 0);
  await assert.rejects(service.project(id), HttpError);
});
