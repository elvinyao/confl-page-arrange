import Fastify, { FastifyInstance } from 'fastify';
import {
  AuthPayload,
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
      const response: ConnectResponse = {
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
    auth: z.object({
      deploymentType: z.enum(['cloud', 'dc']),
      baseUrl: z.string().url(),
      credentials: z.object({
        username: z.string().min(1),
        secret: z.string().min(1),
      }),
    }),
    parentPageUrl: z.string().url(),
  });

  app.post('/api/tree/load', async (request, reply) => {
    try {
      const input = loadSchema.parse(request.body) as LoadTreeRequest;
      const adapter = createAdapter(toAdapterConfig(input.auth));
      const tree = await loadTreeByParentUrl(adapter, input.parentPageUrl);

      assertSingleSpace(tree);

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
    originalTree: z.any(),
    draftTree: z.any(),
  });

  app.post('/api/tree/plan', async (request, reply) => {
    try {
      const input = planSchema.parse(request.body) as PlanRequest;
      const plan = computeMovePlan(input.originalTree, input.draftTree);

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
    tree: z.any(),
    plan: z.array(z.any()),
  });

  app.post('/api/tree/validate', async (request, reply) => {
    try {
      const input = validateSchema.parse(request.body) as ValidateRequest;
      const errors = validateMovePlan(input.tree, input.plan);

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
    auth: z.object({
      deploymentType: z.enum(['cloud', 'dc']),
      baseUrl: z.string().url(),
      credentials: z.object({
        username: z.string().min(1),
        secret: z.string().min(1),
      }),
    }),
    tree: z.any(),
    plan: z.array(z.any()),
    dryRun: z.boolean().optional(),
  });

  app.post('/api/tree/commit', async (request, reply) => {
    try {
      const input = commitSchema.parse(request.body) as CommitRequest;
      const errors = validateMovePlan(input.tree, input.plan);
      if (errors.length > 0) {
        return reply.status(409).send({
          message: 'Plan validation failed.',
          errors,
        });
      }

      const adapter = createAdapter(toAdapterConfig(input.auth));
      const report = await commitMovePlan(adapter, input.plan, {
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

function toAdapterConfig(auth: AuthPayload) {
  return {
    deploymentType: auth.deploymentType,
    baseUrl: auth.baseUrl,
    username: auth.credentials.username,
    secret: auth.credentials.secret,
  };
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
