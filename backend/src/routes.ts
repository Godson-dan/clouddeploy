import { Router, type Request, type RequestHandler, type Response } from 'express';
import { controller } from './controller.js';

const router = Router();
const handle = (fn: (req: Request, res: Response) => unknown | Promise<unknown>): RequestHandler =>
  (req, res, next) => { Promise.resolve().then(() => fn(req, res)).catch(next); };
router.get('/projects', handle(controller.listProjects));
router.post('/projects', handle(controller.createProject));
router.get('/projects/:projectId', handle(controller.getProject));
router.delete('/projects/:projectId', handle(controller.deleteProject));
router.get('/deployments', handle(controller.listDeployments));
router.get('/projects/:projectId/deployments', handle(controller.listDeployments));
router.get('/projects/:projectId/deployments/:deploymentId', handle(controller.getDeployment));
router.get('/projects/:projectId/deployments/:deploymentId/logs', handle(controller.getLogs));
router.post('/projects/:projectId/deploy', handle(controller.deploy));
router.post('/projects/:projectId/redeploy', handle(controller.redeploy));
router.post('/projects/:projectId/rollback', handle(controller.rollback));
router.get('/projects/:projectId/environment', handle(controller.getEnvironment));
router.post('/projects/:projectId/environment', handle(controller.saveEnvironment));
router.get('/projects/:projectId/metrics', handle(controller.metrics));
router.get('/projects/:projectId/domain', handle(controller.domain));
router.get('/projects/:projectId/resources', handle(controller.resources));
router.get('/projects/:projectId/configuration', handle(controller.configuration));
export default router;
