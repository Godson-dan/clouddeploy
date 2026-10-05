import type { Request, Response } from 'express';
import { service } from './service.js';
import { HttpError } from './errors.js';

const body = (req: Request): Record<string, unknown> => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new HttpError(400, 'Expected a JSON object');
  return req.body as Record<string, unknown>;
};
export const controller = {
  listProjects: async (_: Request, res: Response) => { res.json(await service.projects()); },
  createProject: async (req: Request, res: Response) => { res.status(201).json(await service.createProject(body(req))); },
  getProject: async (req: Request, res: Response) => { res.json(await service.project(req.params.projectId!)); },
  deleteProject: async (req: Request, res: Response) => { await service.deleteProject(req.params.projectId!); res.status(204).end(); },
  listDeployments: async (req: Request, res: Response) => { res.json(await service.deployments(req.params.projectId)); },
  getDeployment: async (req: Request, res: Response) => { res.json(await service.deployment(req.params.projectId!, req.params.deploymentId!)); },
  getLogs: async (req: Request, res: Response) => { res.json((await service.deployment(req.params.projectId!, req.params.deploymentId!)).logs); },
  deploy: async (req: Request, res: Response) => { res.status(201).json(await service.deploy(req.params.projectId!, 'deploy', body(req))); },
  redeploy: async (req: Request, res: Response) => { res.status(201).json(await service.deploy(req.params.projectId!, 'redeploy', body(req))); },
  rollback: async (req: Request, res: Response) => { res.status(201).json(await service.deploy(req.params.projectId!, 'rollback', body(req))); },
  getEnvironment: async (req: Request, res: Response) => { res.json(await service.environment(req.params.projectId!)); },
  saveEnvironment: async (req: Request, res: Response) => { res.status(201).json(await service.saveEnvironment(req.params.projectId!, body(req))); },
  metrics: async (req: Request, res: Response) => { res.json(await service.metrics(req.params.projectId!)); },
  domain: async (req: Request, res: Response) => { res.json(await service.domain(req.params.projectId!)); },
  resources: async (req: Request, res: Response) => { res.json(await service.resources(req.params.projectId!)); },
  configuration: async (req: Request, res: Response) => { res.json(await service.configuration(req.params.projectId!)); },
};
