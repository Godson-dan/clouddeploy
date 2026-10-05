import type { Deployment, EnvironmentVariable, Project } from './models.js';
import { demoManifest as manifest } from './manifest.js';

const ago = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString();
const seed: Project[] = [
  { id: 'atlas-web', name: 'Atlas Web', repository: 'acme/atlas-web', branch: 'main', framework: 'Next.js', region: 'US East · Virginia', status: 'healthy', description: 'Customer-facing workspace and collaboration experience.', domain: 'atlas-web.clouddeploy.app', customDomain: 'app.atlas.so', cpu: '1 vCPU', memory: '2 GB', replicas: 2, createdAt: ago(42000), manifest },
  { id: 'meridian-api', name: 'Meridian API', repository: 'acme/meridian-api', branch: 'main', framework: 'Node.js', region: 'EU West · Dublin', status: 'healthy', description: 'Core API powering the Meridian platform.', domain: 'meridian-api.clouddeploy.app', customDomain: 'api.meridian.dev', cpu: '2 vCPU', memory: '4 GB', replicas: 3, createdAt: ago(28000), manifest },
  { id: 'northstar-docs', name: 'Northstar Docs', repository: 'acme/northstar-docs', branch: 'production', framework: 'Astro', region: 'US West · Oregon', status: 'failed', description: 'Developer documentation and guides.', domain: 'northstar-docs.clouddeploy.app', customDomain: '', cpu: '0.5 vCPU', memory: '1 GB', replicas: 1, createdAt: ago(19000), manifest },
];
function demoLog(minutes: number, failed = false) {
  return [
    { timestamp: ago(minutes), level: 'info' as const, message: 'Queued deployment in demo provider' },
    { timestamp: ago(minutes - 0.2), level: 'info' as const, message: 'Installing dependencies · npm ci' },
    { timestamp: ago(minutes - 0.5), level: 'info' as const, message: 'Building application · npm run build' },
    { timestamp: ago(minutes - 1), level: failed ? 'error' as const : 'success' as const, message: failed ? 'Build failed: missing environment configuration' : 'Health checks passed · deployment is live' },
  ];
}
const deployments: Deployment[] = [
  { id: 'd-atlas-31', projectId: 'atlas-web', number: 31, status: 'success', action: 'deploy', branch: 'main', commit: 'a3f91c2', message: 'Improve workspace navigation', createdAt: ago(18), duration: '1m 24s', targetDeploymentId: null, logs: demoLog(18) },
  { id: 'd-atlas-30', projectId: 'atlas-web', number: 30, status: 'success', action: 'deploy', branch: 'main', commit: '73bc9e1', message: 'Update billing experience', createdAt: ago(450), duration: '1m 18s', targetDeploymentId: null, logs: demoLog(450) },
  { id: 'd-atlas-29', projectId: 'atlas-web', number: 29, status: 'failed', action: 'deploy', branch: 'main', commit: '0de582a', message: 'Adjust API request handling', createdAt: ago(1900), duration: '1m 02s', targetDeploymentId: null, logs: demoLog(1900, true) },
  { id: 'd-meridian-14', projectId: 'meridian-api', number: 14, status: 'success', action: 'deploy', branch: 'main', commit: '9b712df', message: 'Add request tracing', createdAt: ago(72), duration: '2m 03s', targetDeploymentId: null, logs: demoLog(72) },
  { id: 'd-meridian-13', projectId: 'meridian-api', number: 13, status: 'success', action: 'deploy', branch: 'main', commit: '2c91f40', message: 'Tune rate limits', createdAt: ago(5800), duration: '1m 52s', targetDeploymentId: null, logs: demoLog(5800) },
  { id: 'd-northstar-8', projectId: 'northstar-docs', number: 8, status: 'failed', action: 'deploy', branch: 'production', commit: 'c51a09f', message: 'Refresh getting started guide', createdAt: ago(210), duration: '0m 48s', targetDeploymentId: null, logs: demoLog(210, true) },
  { id: 'd-northstar-7', projectId: 'northstar-docs', number: 7, status: 'success', action: 'deploy', branch: 'production', commit: 'e40bc31', message: 'Add SDK reference', createdAt: ago(10200), duration: '1m 12s', targetDeploymentId: null, logs: demoLog(10200) },
];


export const seedProjects = seed;
export const seedDeployments = deployments;
export const seedEnvironments: Record<string, EnvironmentVariable[]> = {
  'atlas-web': [{ key: 'NODE_ENV', value: 'production', secret: false }, { key: 'DATABASE_URL', value: 'demo-private-value', secret: true }, { key: 'SESSION_SECRET', value: 'demo-secret-value', secret: true }],
  'meridian-api': [{ key: 'NODE_ENV', value: 'production', secret: false }, { key: 'API_TOKEN', value: 'demo-private-value', secret: true }],
  'northstar-docs': [{ key: 'PUBLIC_SITE_URL', value: 'https://northstar-docs.clouddeploy.app', secret: false }],
};
