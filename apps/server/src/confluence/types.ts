import { DeploymentType, MoveOperation } from '@confl/shared';

export interface AdapterConfig {
  deploymentType: DeploymentType;
  baseUrl: string;
  username: string;
  secret: string;
}

export interface ConfluenceUser {
  accountId: string;
  displayName: string;
}

export interface ConfluencePage {
  id: string;
  title: string;
  parentId: string | null;
  spaceKey: string;
}

export interface ChildrenPageResult {
  pages: ConfluencePage[];
  nextStart: number | null;
}

export interface MoveResult {
  ok: true;
}

export interface ConfluenceAdapter {
  readonly config: AdapterConfig;
  verifyCredentials(): Promise<void>;
  getCurrentUser(): Promise<ConfluenceUser>;
  getPage(pageId: string): Promise<ConfluencePage>;
  listChildren(parentPageId: string, start?: number): Promise<ChildrenPageResult>;
  movePage(move: MoveOperation): Promise<MoveResult>;
}
