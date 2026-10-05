export type Status = 'healthy' | 'building' | 'failed' | 'idle';
export type Action = 'deploy' | 'redeploy' | 'rollback';
export type DeploymentStatus = 'success' | 'failed' | 'building';
export interface Project { id: string; name: string; repository: string; branch: string; framework: string; region: string; status: Status; description: string; domain: string; customDomain: string; cpu: string; memory: string; replicas: number; createdAt: string; manifest: string }
export interface LogLine { timestamp: string; level: 'info' | 'success' | 'error'; message: string }
export interface Deployment { id: string; projectId: string; number: number; status: DeploymentStatus; action: Action; branch: string; commit: string; message: string; createdAt: string; duration: string; targetDeploymentId: string | null; logs: LogLine[] }
export interface EnvironmentVariable { key: string; value: string; secret: boolean }
export interface PodStatus { name: string; status: 'Ready' | 'Unavailable'; ready: boolean }
export interface Metrics { requests: number[]; latency: number[]; cpu: number[]; memory: number[]; labels: string[]; uptime: string; totalRequests: string; p95: string; errorRate: string; pods: PodStatus[] }
export interface Domain { domain: string; customDomain: string; note: string }
export interface Resources { cpu: string; memory: string; replicas: number; region: string; note: string }
export interface Configuration { repository: string; branch: string; framework: string; region: string; manifest: string; note: string }
export interface ProjectInput { name: string; repository: string; branch: string; framework: string; region: string; description: string }

const base = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(`${base}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } }); }
  catch { throw new Error('Cannot reach the CloudDeploy API. Start the backend with npm run dev.'); }
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string' ? payload.error : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}
const id = (value: string) => encodeURIComponent(value);
const json = (value: unknown) => ({ method: 'POST', body: JSON.stringify(value) });
export const api = {
  projects: () => request<Project[]>('/projects'),
  project: (projectId: string) => request<Project>(`/projects/${id(projectId)}`),
  createProject: (input: ProjectInput) => request<Project>('/projects', json(input)),
  deleteProject: (projectId: string) => request<void>(`/projects/${id(projectId)}`, { method: 'DELETE' }),
  deployments: (projectId?: string) => request<Deployment[]>(projectId ? `/projects/${id(projectId)}/deployments` : '/deployments'),
  deployment: (projectId: string, deploymentId: string) => request<Deployment>(`/projects/${id(projectId)}/deployments/${id(deploymentId)}`),
  logs: (projectId: string, deploymentId: string) => request<LogLine[]>(`/projects/${id(projectId)}/deployments/${id(deploymentId)}/logs`),
  action: (projectId: string, action: Action, targetDeploymentId?: string) => request<Deployment>(`/projects/${id(projectId)}/${action}`, json(targetDeploymentId ? { targetDeploymentId } : {})),
  environment: (projectId: string) => request<EnvironmentVariable[]>(`/projects/${id(projectId)}/environment`),
  saveEnvironment: (projectId: string, entry: EnvironmentVariable) => request<EnvironmentVariable[]>(`/projects/${id(projectId)}/environment`, json(entry)),
  metrics: (projectId: string) => request<Metrics>(`/projects/${id(projectId)}/metrics`),
  domain: (projectId: string) => request<Domain>(`/projects/${id(projectId)}/domain`),
  resources: (projectId: string) => request<Resources>(`/projects/${id(projectId)}/resources`),
  configuration: (projectId: string) => request<Configuration>(`/projects/${id(projectId)}/configuration`),
};
