import type { Action, Deployment, LogLine } from './models.js';

export interface ExecutionResult { status: 'success' | 'failed'; duration: string; logs: LogLine[] }
export interface DeploymentProvider {
  execute(deployment: Deployment, action: Action): Promise<ExecutionResult>;
}
export class MockDeploymentProvider implements DeploymentProvider {
  async execute(deployment: Deployment, action: Action): Promise<ExecutionResult> {
    const timestamp = new Date().toISOString();
    const messages = [
      `Queued ${action} in MockDeploymentProvider`,
      `Checking out ${deployment.branch} at ${deployment.commit}`,
      'Installing dependencies · npm ci',
      'Building application · npm run build',
      'Starting service and running health checks',
      'Health checks passed · deployment is live (demo only)',
    ];
    const logs: LogLine[] = messages.map((message, index) => ({ timestamp, level: index === messages.length - 1 ? 'success' : 'info', message }));
    return { status: 'success', duration: '1m 12s', logs };
  }
}
