import { randomUUID } from 'node:crypto';
import type { Action, CreateProjectInput, Deployment, Metrics, Project, PublicEnvironmentVariable } from './models.js';
import { HttpError, optionalText, text } from './errors.js';
import { repository as defaultRepository, type Repository } from './repository.js';
import { demoManifest } from './manifest.js';
import { MockDeploymentProvider, type DeploymentProvider, type ExecutionResult } from './provider.js';

export class CloudService {
  constructor(
    private repo: Repository = defaultRepository,
    private provider: DeploymentProvider = new MockDeploymentProvider(),
  ) {}
  projects() { return this.repo.allProjects(); }
  async project(id: string): Promise<Project> {
    const project = await this.repo.project(id);
    if (!project) throw new HttpError(404, 'Project not found');
    return project;
  }
  async createProject(body: Record<string, unknown>): Promise<Project> {
    const input: CreateProjectInput = {
      name: text(body.name, 'Name', 60), repository: text(body.repository, 'Repository', 120),
      branch: text(body.branch, 'Branch', 80), framework: text(body.framework, 'Framework', 50),
      region: text(body.region, 'Region', 80), description: optionalText(body.description, 'Description'),
    };
    if (!/^[\w.-]+\/[\w.-]+$/.test(input.repository)) throw new HttpError(400, 'Repository must be owner/repository');
    if (!/^[\w./-]+$/.test(input.branch)) throw new HttpError(400, 'Invalid branch');
    const id = randomUUID();
    const project: Project = { ...input, id, status: 'idle', domain: `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${id.slice(0, 6)}.clouddeploy.app`, customDomain: '', cpu: '1 vCPU', memory: '2 GB', replicas: 1, createdAt: new Date().toISOString(), manifest: demoManifest };
    await this.repo.insertProject(project);
    return project;
  }
  async deleteProject(id: string) { await this.project(id); await this.repo.removeProject(id); }
  async deployments(projectId?: string) { if (projectId) await this.project(projectId); return this.repo.allDeployments(projectId); }
  async deployment(projectId: string, deploymentId: string): Promise<Deployment> {
    await this.project(projectId);
    const deployment = await this.repo.deployment(deploymentId);
    if (!deployment || deployment.projectId !== projectId) throw new HttpError(404, 'Deployment not found in this project');
    return deployment;
  }
  async deploy(projectId: string, action: Action, body: Record<string, unknown>): Promise<Deployment> {
    const project = await this.project(projectId);
    let source = await this.repo.latestDeployment(projectId);
    if (action !== 'deploy') {
      const targetId = text(body.targetDeploymentId, 'Target deployment ID', 100);
      source = await this.deployment(projectId, targetId);
      if (action === 'rollback' && source.status !== 'success') throw new HttpError(400, 'Rollback target must be a successful deployment');
    }
    // Creates the release as "building" and flips the project to "building" in one transaction.
    const deployment = await this.repo.createDeployment({
      projectId, action, branch: source?.branch ?? project.branch, commit: source?.commit ?? 'demo-head',
      message: action === 'rollback' ? `Rollback to deployment #${source!.number}` : action === 'redeploy' ? `Redeploy #${source!.number}` : 'Manual deployment',
      targetDeploymentId: action === 'deploy' ? null : source!.id,
    });
    let outcome: ExecutionResult;
    try {
      outcome = await this.provider.execute(deployment, action);
    } catch (error) {
      console.error('Deployment provider error', error);
      outcome = { status: 'failed', duration: '—', logs: [{ timestamp: new Date().toISOString(), level: 'error', message: 'Demo provider execution failed' }] };
    }
    // Persists the final deployment state and project status together.
    return this.repo.finishDeployment(deployment.id, outcome, outcome.status === 'success' ? 'healthy' : 'failed');
  }
  async environment(projectId: string): Promise<PublicEnvironmentVariable[]> {
    await this.project(projectId);
    return (await this.repo.environment(projectId)).map(({ key, value, secret }) => ({ key, value: secret ? '••••••••' : value, secret }));
  }
  async saveEnvironment(projectId: string, body: Record<string, unknown>): Promise<PublicEnvironmentVariable[]> {
    await this.project(projectId);
    const key = text(body.key, 'Key', 100);
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) throw new HttpError(400, 'Key must use uppercase letters, digits and underscores, and start with a letter or underscore');
    const value = text(body.value, 'Value', 1000);
    if (typeof body.secret !== 'boolean') throw new HttpError(400, 'Secret must be a boolean');
    await this.repo.upsertEnvironmentVariable(projectId, { key, value, secret: body.secret });
    return this.environment(projectId);
  }
  async metrics(projectId: string): Promise<Metrics> {
    const project = await this.project(projectId);
    const base = projectId === 'meridian-api' ? 150 : 80;
    const ready = project.status === 'healthy';
    const pods = Array.from({ length: project.replicas }, (_, index) => ({ name: `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index + 1}`, status: ready ? 'Ready' as const : 'Unavailable' as const, ready }));
    return { labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'Now'], requests: [42, 34, 58, 76, 64, 89, 72].map(v => v + base), latency: [83, 79, 94, 86, 101, 91, 88], cpu: [24, 20, 38, 33, 47, 41, 35], memory: [52, 54, 57, 58, 60, 62, 61], uptime: '99.98%', totalRequests: '1.24M', p95: '88ms', errorRate: '0.02%', pods };
  }
  async domain(projectId: string) { const { domain, customDomain } = await this.project(projectId); return { domain, customDomain, note: 'Demo domains are illustrative only. No DNS is configured.' }; }
  async resources(projectId: string) { const { cpu, memory, replicas, region } = await this.project(projectId); return { cpu, memory, replicas, region, note: 'Demo allocations are illustrative only.' }; }
  async configuration(projectId: string) { const { repository, branch, framework, region, manifest } = await this.project(projectId); return { repository, branch, framework, region, manifest, note: 'DEMO preview only. deploy.yaml is NOT fetched from the repository.' }; }
}
export const service = new CloudService();
