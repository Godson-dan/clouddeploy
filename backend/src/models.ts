export type Status = 'healthy' | 'building' | 'failed' | 'idle';
export type DeploymentStatus = 'success' | 'failed' | 'building';
export type Action = 'deploy' | 'redeploy' | 'rollback';
export interface LogLine { timestamp: string; level: 'info' | 'success' | 'error'; message: string }
export interface Deployment {
  id: string; projectId: string; number: number; status: DeploymentStatus; action: Action;
  branch: string; commit: string; message: string; createdAt: string; duration: string;
  targetDeploymentId: string | null; logs: LogLine[];
}
export interface EnvironmentVariable { key: string; value: string; secret: boolean }
export interface PublicEnvironmentVariable { key: string; value: string; secret: boolean }
export interface Project {
  id: string; name: string; repository: string; branch: string; framework: string;
  region: string; status: Status; description: string; domain: string; customDomain: string;
  cpu: string; memory: string; replicas: number; createdAt: string; manifest: string;
}
export interface Metrics {
  requests: number[]; latency: number[]; cpu: number[]; memory: number[];
  labels: string[]; uptime: string; totalRequests: string; p95: string; errorRate: string;
  pods: { name: string; status: 'Ready' | 'Unavailable'; ready: boolean }[];
}
export interface Overview { project: Project; deployments: Deployment[] }
export interface CreateProjectInput { name: string; repository: string; branch: string; framework: string; region: string; description: string }
