import {
  CommitRequest,
  CommitResponse,
  ConnectRequest,
  ConnectResponse,
  LoadTreeRequest,
  LoadTreeResponse,
  PlanRequest,
  PlanResponse,
  ValidateRequest,
  ValidateResponse,
} from '@confl/shared';

const apiBaseUrl = (window.__APP_CONFIG__?.apiBaseUrl ?? '').replace(/\/+$/, '');

async function postJson<TResponse>(path: string, payload: unknown): Promise<TResponse> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed: ${response.status}`);
  }

  return (await response.json()) as TResponse;
}

export function connectSession(input: ConnectRequest): Promise<ConnectResponse> {
  return postJson<ConnectResponse>('/api/session/connect', input);
}

export function loadTree(input: LoadTreeRequest): Promise<LoadTreeResponse> {
  return postJson<LoadTreeResponse>('/api/tree/load', input);
}

export function buildPlan(input: PlanRequest): Promise<PlanResponse> {
  return postJson<PlanResponse>('/api/tree/plan', input);
}

export function validatePlan(input: ValidateRequest): Promise<ValidateResponse> {
  return postJson<ValidateResponse>('/api/tree/validate', input);
}

export function commitPlan(input: CommitRequest): Promise<CommitResponse> {
  return postJson<CommitResponse>('/api/tree/commit', input);
}
