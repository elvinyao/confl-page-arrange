export type DeploymentType = 'cloud' | 'dc';

export interface CredentialsInput {
  username: string;
  secret: string;
}

export interface PageNode {
  id: string;
  title: string;
  parentId: string | null;
  spaceKey: string;
  position: number;
  children: PageNode[];
}

export interface TreeSnapshot {
  spaceKey: string;
  rootPageId: string;
  tree: PageNode;
}

export type PlacementMode = 'appendToParent' | 'beforeSibling' | 'afterSibling';

export interface PlacementRef {
  mode: PlacementMode;
  referencePageId: string;
}

export interface MoveOperation {
  pageId: string;
  fromParentId: string | null;
  toParentId: string | null;
  fromIndex: number;
  toIndex: number;
  placement: PlacementRef;
  reason: 'parent-change' | 'reorder';
}

export interface ValidationError {
  code:
    | 'DUPLICATE_PAGE'
    | 'SELF_PARENT'
    | 'MISSING_PAGE'
    | 'CROSS_SPACE'
    | 'CYCLE_DETECTED'
    | 'ROOT_MOVE_FORBIDDEN';
  pageId: string;
  message: string;
}

export interface ExecutionItem {
  pageId: string;
  status: 'success' | 'failed' | 'skipped';
  message: string;
  retryable: boolean;
}

export interface ExecutionReport {
  total: number;
  succeeded: number;
  failed: number;
  items: ExecutionItem[];
}

export interface ConnectRequest {
  deploymentType: DeploymentType;
  baseUrl: string;
  credentials: CredentialsInput;
}

export interface AuthPayload {
  deploymentType: DeploymentType;
  baseUrl: string;
  credentials: CredentialsInput;
}

export interface ConnectResponse {
  user: {
    accountId: string;
    displayName: string;
  };
  siteInfo: {
    baseUrl: string;
    deploymentType: DeploymentType;
  };
}

export interface LoadTreeRequest {
  auth: AuthPayload;
  parentPageUrl: string;
}

export interface LoadTreeResponse extends TreeSnapshot {}

export interface PlanRequest {
  originalTree: PageNode;
  draftTree: PageNode;
}

export interface PlanResponse {
  plan: MoveOperation[];
  warnings: string[];
}

export interface ValidateRequest {
  tree: PageNode;
  plan: MoveOperation[];
}

export interface ValidateResponse {
  ok: boolean;
  errors: ValidationError[];
}

export interface CommitRequest {
  auth: AuthPayload;
  tree: PageNode;
  plan: MoveOperation[];
  dryRun?: boolean;
}

export interface CommitResponse {
  report: ExecutionReport;
}
