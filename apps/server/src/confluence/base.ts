import { MoveOperation } from '@confl/shared';
import {
  AdapterConfig,
  ChildrenPageResult,
  ConfluenceAdapter,
  ConfluencePage,
  ConfluenceUser,
  MoveResult,
} from './types.js';

interface ContentResponse {
  id: string;
  title: string;
  space?: { key?: string };
  ancestors?: Array<{ id: string }>;
}

interface ChildPageResponse {
  results?: ContentResponse[];
  start?: number;
  limit?: number;
  size?: number;
}

export abstract class BaseConfluenceAdapter implements ConfluenceAdapter {
  readonly config: AdapterConfig;

  protected constructor(config: AdapterConfig) {
    this.config = {
      ...config,
      baseUrl: normalizeBaseUrl(config.baseUrl),
    };
  }

  protected abstract restBasePath(): string;

  protected authHeader(): string {
    const token = Buffer.from(`${this.config.username}:${this.config.secret}`).toString('base64');
    return `Basic ${token}`;
  }

  protected restUrl(path: string): string {
    return `${this.config.baseUrl}${this.restBasePath()}${path}`;
  }

  protected async requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      Accept: 'application/json',
      Authorization: this.authHeader(),
      ...init.headers,
    };

    const result = await requestWithRetry(url, {
      ...init,
      headers,
    });

    if (!result.ok) {
      const body = await result.text();
      throw new Error(`Confluence API ${result.status}: ${body.slice(0, 400)}`);
    }

    return (await result.json()) as T;
  }

  async verifyCredentials(): Promise<void> {
    await this.getCurrentUser();
  }

  async getCurrentUser(): Promise<ConfluenceUser> {
    const response = await this.requestJson<{ accountId?: string; userKey?: string; displayName?: string }>(
      this.restUrl('/user/current'),
    );
    return {
      accountId: response.accountId ?? response.userKey ?? 'unknown',
      displayName: response.displayName ?? 'Unknown User',
    };
  }

  async getPage(pageId: string): Promise<ConfluencePage> {
    const response = await this.requestJson<ContentResponse>(
      this.restUrl(`/content/${encodeURIComponent(pageId)}?expand=ancestors,space`),
    );

    return {
      id: response.id,
      title: response.title,
      parentId: response.ancestors && response.ancestors.length > 0 ? response.ancestors[response.ancestors.length - 1].id : null,
      spaceKey: response.space?.key ?? 'UNKNOWN',
    };
  }

  async listChildren(parentPageId: string, start = 0): Promise<ChildrenPageResult> {
    const response = await this.requestJson<ChildPageResponse>(
      this.restUrl(`/content/${encodeURIComponent(parentPageId)}/child/page?limit=100&start=${start}&expand=ancestors,space`),
    );

    const pages = (response.results ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      parentId: parentPageId,
      spaceKey: item.space?.key ?? 'UNKNOWN',
    }));

    const totalLoaded = (response.start ?? start) + (response.size ?? pages.length);
    const limit = response.limit ?? 100;
    const nextStart = (response.size ?? pages.length) >= limit ? totalLoaded : null;

    return {
      pages,
      nextStart,
    };
  }

  async movePage(move: MoveOperation): Promise<MoveResult> {
    const position = placementToApiPosition(move);
    const target = move.placement.referencePageId;
    const url = this.restUrl(`/content/${encodeURIComponent(move.pageId)}/move/${position}/${encodeURIComponent(target)}`);

    const response = await requestWithRetry(url, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        Authorization: this.authHeader(),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Move failed (${move.pageId}): ${response.status} ${body.slice(0, 300)}`);
    }

    return { ok: true };
  }
}

function placementToApiPosition(move: MoveOperation): string {
  switch (move.placement.mode) {
    case 'appendToParent':
      return 'append';
    case 'beforeSibling':
      return 'before';
    case 'afterSibling':
      return 'after';
    default:
      return 'append';
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

async function requestWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url, init);
      if (response.status === 429 || response.status >= 500) {
        await wait((i + 1) * 300);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      await wait((i + 1) * 300);
    }
  }

  throw new Error(`Confluence request failed after retries: ${String(lastError ?? 'unknown')}`);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
