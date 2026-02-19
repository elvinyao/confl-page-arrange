import { randomUUID } from 'node:crypto';
import { MoveOperation, PageNode } from '@confl/shared';
import { ConfluenceAdapter, ConfluenceUser } from './confluence/index.js';

export interface SessionState {
  id: string;
  adapter: ConfluenceAdapter;
  user: ConfluenceUser;
  createdAt: number;
  lastLoadedTree: PageNode | null;
  lastPlan: MoveOperation[];
}

const SESSION_TTL_MS = 30 * 60 * 1000;

export class SessionStore {
  private readonly sessions = new Map<string, SessionState>();

  create(adapter: ConfluenceAdapter, user: ConfluenceUser): SessionState {
    const id = randomUUID();
    const state: SessionState = {
      id,
      adapter,
      user,
      createdAt: Date.now(),
      lastLoadedTree: null,
      lastPlan: [],
    };
    this.sessions.set(id, state);
    return state;
  }

  get(sessionId: string): SessionState {
    const state = this.sessions.get(sessionId);
    if (!state) {
      throw new Error('Session not found. Please reconnect.');
    }
    if (Date.now() - state.createdAt > SESSION_TTL_MS) {
      this.sessions.delete(sessionId);
      throw new Error('Session expired. Please reconnect.');
    }
    return state;
  }

  touchTree(sessionId: string, tree: PageNode): void {
    const state = this.get(sessionId);
    state.lastLoadedTree = tree;
  }

  touchPlan(sessionId: string, plan: MoveOperation[]): void {
    const state = this.get(sessionId);
    state.lastPlan = plan;
  }
}
