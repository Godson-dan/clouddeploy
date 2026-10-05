import { randomUUID } from 'node:crypto';
import { pool, withTransaction } from './db.js';
import { HttpError } from './errors.js';
import type { Action, Deployment, DeploymentStatus, EnvironmentVariable, LogLine, Project, Status } from './models.js';

export interface NewDeployment {
  projectId: string; action: Action; branch: string; commit: string; message: string; targetDeploymentId: string | null;
}
export interface Repository {
  allProjects(): Promise<Project[]>;
  project(id: string): Promise<Project | undefined>;
  insertProject(project: Project): Promise<void>;
  removeProject(id: string): Promise<void>;
  allDeployments(projectId?: string): Promise<Deployment[]>;
  latestDeployment(projectId: string): Promise<Deployment | undefined>;
  deployment(id: string): Promise<Deployment | undefined>;
  createDeployment(input: NewDeployment): Promise<Deployment>;
  finishDeployment(id: string, result: { status: DeploymentStatus; duration: string; logs: LogLine[] }, projectStatus: Status): Promise<Deployment>;
  environment(projectId: string): Promise<EnvironmentVariable[]>;
  upsertEnvironmentVariable(projectId: string, entry: EnvironmentVariable): Promise<void>;
}

interface ProjectRow {
  id: string; name: string; repository: string; branch: string; framework: string; region: string; status: Status;
  description: string; domain: string; custom_domain: string; cpu: string; memory: string; replicas: number;
  manifest: string; created_at: Date;
}
interface DeploymentRow {
  id: string; project_id: string; number: number; status: DeploymentStatus; action: Action; branch: string;
  commit_sha: string; message: string; duration: string; target_deployment_id: string | null; logs: LogLine[]; created_at: Date;
}
const toProject = (r: ProjectRow): Project => ({
  id: r.id, name: r.name, repository: r.repository, branch: r.branch, framework: r.framework, region: r.region,
  status: r.status, description: r.description, domain: r.domain, customDomain: r.custom_domain, cpu: r.cpu,
  memory: r.memory, replicas: r.replicas, createdAt: r.created_at.toISOString(), manifest: r.manifest,
});
const toDeployment = (r: DeploymentRow): Deployment => ({
  id: r.id, projectId: r.project_id, number: r.number, status: r.status, action: r.action, branch: r.branch,
  commit: r.commit_sha, message: r.message, createdAt: r.created_at.toISOString(), duration: r.duration,
  targetDeploymentId: r.target_deployment_id, logs: r.logs,
});

export class PgRepository implements Repository {
  async allProjects() {
    const { rows } = await pool.query<ProjectRow>('SELECT * FROM projects ORDER BY created_at, id');
    return rows.map(toProject);
  }
  async project(id: string) {
    const { rows } = await pool.query<ProjectRow>('SELECT * FROM projects WHERE id = $1', [id]);
    return rows[0] ? toProject(rows[0]) : undefined;
  }
  async insertProject(p: Project) {
    await pool.query(
      `INSERT INTO projects (id, name, repository, branch, framework, region, status, description, domain, custom_domain, cpu, memory, replicas, manifest, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [p.id, p.name, p.repository, p.branch, p.framework, p.region, p.status, p.description, p.domain, p.customDomain, p.cpu, p.memory, p.replicas, p.manifest, p.createdAt],
    );
  }
  async removeProject(id: string) {
    // deployments and environment variables are removed by ON DELETE CASCADE
    await pool.query('DELETE FROM projects WHERE id = $1', [id]);
  }
  async allDeployments(projectId?: string) {
    const { rows } = projectId
      ? await pool.query<DeploymentRow>('SELECT * FROM deployments WHERE project_id = $1 ORDER BY created_at DESC, number DESC', [projectId])
      : await pool.query<DeploymentRow>('SELECT * FROM deployments ORDER BY created_at DESC, number DESC');
    return rows.map(toDeployment);
  }
  async latestDeployment(projectId: string) {
    const { rows } = await pool.query<DeploymentRow>('SELECT * FROM deployments WHERE project_id = $1 ORDER BY created_at DESC, number DESC LIMIT 1', [projectId]);
    return rows[0] ? toDeployment(rows[0]) : undefined;
  }
  async deployment(id: string) {
    const { rows } = await pool.query<DeploymentRow>('SELECT * FROM deployments WHERE id = $1', [id]);
    return rows[0] ? toDeployment(rows[0]) : undefined;
  }
  async createDeployment(input: NewDeployment) {
    return withTransaction(async client => {
      // Lock the project row so two simultaneous deploys cannot receive the same release number.
      const locked = await client.query('SELECT 1 FROM projects WHERE id = $1 FOR UPDATE', [input.projectId]);
      if (locked.rowCount === 0) throw new HttpError(404, 'Project not found');
      const { rows } = await client.query<DeploymentRow>(
        `INSERT INTO deployments (id, project_id, number, status, action, branch, commit_sha, message, duration, target_deployment_id, logs)
         VALUES ($1, $2, (SELECT COALESCE(MAX(number), 0) + 1 FROM deployments WHERE project_id = $2), 'building', $3, $4, $5, $6, '—', $7, '[]'::jsonb)
         RETURNING *`,
        [randomUUID(), input.projectId, input.action, input.branch, input.commit, input.message, input.targetDeploymentId],
      );
      await client.query(`UPDATE projects SET status = 'building' WHERE id = $1`, [input.projectId]);
      return toDeployment(rows[0]!);
    });
  }
  async finishDeployment(id: string, result: { status: DeploymentStatus; duration: string; logs: LogLine[] }, projectStatus: Status) {
    return withTransaction(async client => {
      const { rows } = await client.query<DeploymentRow>(
        'UPDATE deployments SET status = $2, duration = $3, logs = $4::jsonb WHERE id = $1 RETURNING *',
        [id, result.status, result.duration, JSON.stringify(result.logs)],
      );
      const row = rows[0];
      if (!row) throw new HttpError(404, 'Deployment not found');
      await client.query('UPDATE projects SET status = $2 WHERE id = $1', [row.project_id, projectStatus]);
      return toDeployment(row);
    });
  }
  async environment(projectId: string) {
    const { rows } = await pool.query<EnvironmentVariable>('SELECT key, value, secret FROM environment_variables WHERE project_id = $1 ORDER BY seq', [projectId]);
    return rows;
  }
  async upsertEnvironmentVariable(projectId: string, entry: EnvironmentVariable) {
    await pool.query(
      `INSERT INTO environment_variables (project_id, key, value, secret) VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_id, key) DO UPDATE SET value = EXCLUDED.value, secret = EXCLUDED.secret`,
      [projectId, entry.key, entry.value, entry.secret],
    );
  }
}
export const repository: Repository = new PgRepository();
