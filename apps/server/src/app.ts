import Fastify, { FastifyInstance } from 'fastify';
import {
  CommitRequest,
  CommitResponse,
  ConnectRequest,
  ConnectResponse,
  LoadTreeRequest,
  LoadTreeResponse,
  PageNode,
  PlanRequest,
  PlanResponse,
  ValidateRequest,
  ValidateResponse,
  computeMovePlan,
  walkTree,
} from '@confl/shared';
import { z } from 'zod';
import { createAdapter } from './confluence/index.js';
import { commitMovePlan, validateMovePlan } from './services/move-service.js';
import { loadTreeByParentUrl } from './services/tree-service.js';
import { SessionStore } from './session-store.js';

interface CreateAppOptions {
  logger?: boolean;
}

interface StartServerOptions {
  host?: string;
  port?: number;
  logger?: boolean;
}

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? true });
  const sessions = new SessionStore();

  // Allows browser app and Electron file-origin renderer to call API.
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (request.method === 'OPTIONS') {
      reply.code(204).send();
    }
  });

  const connectSchema = z.object({
    deploymentType: z.enum(['cloud', 'dc']),
    baseUrl: z.string().url(),
    credentials: z.object({
      username: z.string().min(1),
      secret: z.string().min(1),
    }),
  });

  app.post('/api/session/connect', async (request, reply) => {
    try {
      const input = connectSchema.parse(request.body) as ConnectRequest;
      const adapter = createAdapter({
        deploymentType: input.deploymentType,
        baseUrl: input.baseUrl,
        username: input.credentials.username,
        secret: input.credentials.secret,
      });

      await adapter.verifyCredentials();
      const user = await adapter.getCurrentUser();
      const session = sessions.create(adapter, user);

      const response: ConnectResponse = {
        sessionId: session.id,
        user,
        siteInfo: {
          baseUrl: adapter.config.baseUrl,
          deploymentType: adapter.config.deploymentType,
        },
      };

      return reply.send(response);
    } catch (error) {
      return reply.status(400).send({
        message: toErrorMessage(error),
      });
    }
  });

  const loadSchema = z.object({
    sessionId: z.string().uuid(),
    parentPageUrl: z.string().url(),
  });

  app.post('/api/tree/load', async (request, reply) => {
    try {
      const input = loadSchema.parse(request.body) as LoadTreeRequest;
      const session = sessions.get(input.sessionId);
      const tree = await loadTreeByParentUrl(session.adapter, input.parentPageUrl);

      assertSingleSpace(tree);
      sessions.touchTree(session.id, tree);

      const response: LoadTreeResponse = {
        spaceKey: tree.spaceKey,
        rootPageId: tree.id,
        tree,
      };

      return reply.send(response);
    } catch (error) {
      return reply.status(400).send({
        message: toErrorMessage(error),
      });
    }
  });

  const planSchema = z.object({
    sessionId: z.string().uuid(),
    originalTree: z.any(),
    draftTree: z.any(),
  });

  app.post('/api/tree/plan', async (request, reply) => {
    try {
      const input = planSchema.parse(request.body) as PlanRequest;
      const session = sessions.get(input.sessionId);

      const plan = computeMovePlan(input.originalTree, input.draftTree);
      sessions.touchPlan(session.id, plan);

      const response: PlanResponse = {
        plan,
        warnings: plan.length === 0 ? ['No changes detected.'] : [],
      };

      return reply.send(response);
    } catch (error) {
      return reply.status(400).send({
        message: toErrorMessage(error),
      });
    }
  });

  const validateSchema = z.object({
    sessionId: z.string().uuid(),
    plan: z.array(z.any()),
  });

  app.post('/api/tree/validate', async (request, reply) => {
    try {
      const input = validateSchema.parse(request.body) as ValidateRequest;
      const session = sessions.get(input.sessionId);

      if (!session.lastLoadedTree) {
        throw new Error('Tree not loaded.');
      }

      const errors = validateMovePlan(session.lastLoadedTree, input.plan);

      const response: ValidateResponse = {
        ok: errors.length === 0,
        errors,
      };

      return reply.send(response);
    } catch (error) {
      return reply.status(400).send({
        message: toErrorMessage(error),
      });
    }
  });

  const commitSchema = z.object({
    sessionId: z.string().uuid(),
    plan: z.array(z.any()),
    dryRun: z.boolean().optional(),
  });

  app.post('/api/tree/commit', async (request, reply) => {
    try {
      const input = commitSchema.parse(request.body) as CommitRequest;
      const session = sessions.get(input.sessionId);

      if (!session.lastLoadedTree) {
        throw new Error('Tree not loaded.');
      }

      const errors = validateMovePlan(session.lastLoadedTree, input.plan);
      if (errors.length > 0) {
        return reply.status(409).send({
          message: 'Plan validation failed.',
          errors,
        });
      }

      const report = await commitMovePlan(session.adapter, input.plan, {
        dryRun: input.dryRun,
      });

      const response: CommitResponse = { report };
      return reply.send(response);
    } catch (error) {
      return reply.status(400).send({
        message: toErrorMessage(error),
      });
    }
  });

  return app;
}

export async function startServer(options: StartServerOptions = {}): Promise<FastifyInstance> {
  const app = createApp({ logger: options.logger });
  const host = options.host ?? process.env.HOST ?? '0.0.0.0';
  const port = options.port ?? Number(process.env.PORT ?? '8787');
  await app.listen({ host, port });
  return app;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertSingleSpace(root: PageNode): void {
  const expectedSpace = root.spaceKey;
  let invalid = false;

  walkTree(root, (node) => {
    if (node.spaceKey !== expectedSpace) {
      invalid = true;
    }
  });

  if (invalid) {
    throw new Error('Cross-space trees are not supported.');
  }
}
