import { useEffect, useMemo, useState } from 'react';
import { AuthPayload, ExecutionReport, MoveOperation, PageNode, ValidationError, moveNodeInTree } from '@confl/shared';
import { buildPlan, commitPlan, connectSession, loadTree, validatePlan } from './api.js';
import { PageTree } from './components/PageTree.js';
import { PlanPreview } from './components/PlanPreview.js';
import { createTranslator, getInitialLocale } from './i18n/index.js';

const AUTH_STORAGE_KEY = 'confl_page_arrange_auth_v1';

export function App() {
  const locale = getInitialLocale();
  const t = useMemo(() => createTranslator(locale), [locale]);
  const initialAuth = loadPersistedAuth();

  const [deploymentType, setDeploymentType] = useState<'cloud' | 'dc'>(initialAuth?.deploymentType ?? 'cloud');
  const [baseUrl, setBaseUrl] = useState(initialAuth?.baseUrl ?? '');
  const [username, setUsername] = useState(initialAuth?.credentials.username ?? '');
  const [secret, setSecret] = useState(initialAuth?.credentials.secret ?? '');
  const [parentPageUrl, setParentPageUrl] = useState('');

  const [connectedUser, setConnectedUser] = useState('');
  const [originalTree, setOriginalTree] = useState<PageNode | null>(null);
  const [draftTree, setDraftTree] = useState<PageNode | null>(null);
  const [plan, setPlan] = useState<MoveOperation[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [report, setReport] = useState<ExecutionReport | null>(null);

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const hasAuth = baseUrl.trim().length > 0 && username.trim().length > 0 && secret.length > 0;
  const canLoadTree = hasAuth;
  const canBuildPlan = originalTree !== null && draftTree !== null;

  useEffect(() => {
    persistAuth({
      deploymentType,
      baseUrl,
      credentials: {
        username,
        secret,
      },
    });
  }, [deploymentType, baseUrl, username, secret]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>{t('app.title')}</h1>
        <p>{t('app.subtitle')}</p>
      </header>

      <section className="panel">
        <h2>{t('connect.title')}</h2>
        <div className="form-grid">
          <label>
            <span>{t('connect.deployment')}</span>
            <select value={deploymentType} onChange={(event) => setDeploymentType(event.target.value as 'cloud' | 'dc')}>
              <option value="cloud">{t('connect.cloud')}</option>
              <option value="dc">{t('connect.dc')}</option>
            </select>
          </label>

          <label>
            <span>{t('connect.baseUrl')}</span>
            <input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder={t('connect.baseUrlPlaceholder')}
            />
          </label>

          <label>
            <span>{t('connect.username')}</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>

          <label>
            <span>{t('connect.secret')}</span>
            <input type="password" value={secret} onChange={(event) => setSecret(event.target.value)} />
          </label>
        </div>

        <button className="button-primary" type="button" onClick={handleConnect} disabled={status === 'loading' || !hasAuth}>
          {t('connect.connect')}
        </button>

        {connectedUser && <p>{`${t('connect.connectedAs')}: ${connectedUser}`}</p>}
      </section>

      <section className="panel">
        <h2>{t('tree.loadTitle')}</h2>
        <label>
          <span>{t('tree.parentUrl')}</span>
          <input value={parentPageUrl} onChange={(event) => setParentPageUrl(event.target.value)} />
        </label>
        <button className="button-primary" type="button" disabled={!canLoadTree || status === 'loading'} onClick={handleLoadTree}>
          {t('tree.load')}
        </button>
      </section>

      {draftTree && (
        <PageTree
          root={draftTree}
          onMove={(dragId, targetId, position) => {
            const result = moveNodeInTree(draftTree, dragId, targetId, position);
            if (!result.ok) {
              setStatus('error');
              setErrorMessage(result.error);
              return;
            }
            setDraftTree(result.tree);
            setPlan([]);
            setValidationErrors([]);
            setReport(null);
          }}
          t={t}
        />
      )}

      {canBuildPlan && (
        <section className="panel actions-row">
          <button type="button" onClick={handleBuildPlan} disabled={status === 'loading'}>
            {t('plan.build')}
          </button>
          <button type="button" onClick={handleValidatePlan} disabled={status === 'loading' || plan.length === 0}>
            {t('plan.validate')}
          </button>
          <button
            type="button"
            className="button-primary"
            onClick={() => handleCommit(false)}
            disabled={status === 'loading' || plan.length === 0 || !hasAuth}
          >
            {t('plan.commit')}
          </button>
          <button type="button" onClick={() => handleCommit(true)} disabled={status === 'loading' || plan.length === 0 || !hasAuth}>
            {t('plan.dryRun')}
          </button>
        </section>
      )}

      <PlanPreview plan={plan} validationErrors={validationErrors} t={t} />

      <section className="panel">
        <h2>{t('result.title')}</h2>
        <p>{`${t(`status.${status}`)}${errorMessage ? `: ${errorMessage}` : ''}`}</p>
        {report && (
          <div>
            <p>{t('result.summary', report)}</p>
            <ul>
              {report.items.map((item) => (
                <li key={`${item.pageId}:${item.status}`}>{`${item.pageId}: ${t(`status.${item.status}`)} - ${item.message}`}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );

  async function handleConnect() {
    setStatus('loading');
    setErrorMessage('');
    try {
      const response = await connectSession(buildAuthPayload(deploymentType, baseUrl, username, secret));
      setConnectedUser(response.user.displayName);
      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(toErrorMessage(error));
    }
  }

  async function handleLoadTree() {
    if (!hasAuth) {
      return;
    }
    setStatus('loading');
    setErrorMessage('');
    try {
      const response = await loadTree({
        auth: buildAuthPayload(deploymentType, baseUrl, username, secret),
        parentPageUrl,
      });
      setOriginalTree(response.tree);
      setDraftTree(response.tree);
      setPlan([]);
      setValidationErrors([]);
      setReport(null);
      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(toErrorMessage(error));
    }
  }

  async function handleBuildPlan() {
    if (!originalTree || !draftTree) {
      return;
    }
    setStatus('loading');
    setErrorMessage('');
    try {
      const response = await buildPlan({
        originalTree,
        draftTree,
      });
      setPlan(response.plan);
      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(toErrorMessage(error));
    }
  }

  async function handleValidatePlan() {
    if (!originalTree || plan.length === 0) {
      return;
    }
    setStatus('loading');
    setErrorMessage('');
    try {
      const response = await validatePlan({
        tree: originalTree,
        plan,
      });
      setValidationErrors(response.errors);
      setStatus(response.ok ? 'success' : 'error');
      setErrorMessage(response.ok ? '' : t('plan.invalid'));
    } catch (error) {
      setStatus('error');
      setErrorMessage(toErrorMessage(error));
    }
  }

  async function handleCommit(dryRun: boolean) {
    if (!originalTree || plan.length === 0 || !hasAuth) {
      return;
    }
    setStatus('loading');
    setErrorMessage('');
    try {
      const response = await commitPlan({
        auth: buildAuthPayload(deploymentType, baseUrl, username, secret),
        tree: originalTree,
        plan,
        dryRun,
      });
      setReport(response.report);
      setStatus(response.report.failed > 0 ? 'error' : 'success');
      if (response.report.failed > 0) {
        setErrorMessage(t('result.failedCount', { count: response.report.failed }));
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage(toErrorMessage(error));
    }
  }
}

function buildAuthPayload(
  deploymentType: 'cloud' | 'dc',
  baseUrl: string,
  username: string,
  secret: string,
): AuthPayload {
  return {
    deploymentType,
    baseUrl,
    credentials: {
      username,
      secret,
    },
  };
}

function loadPersistedAuth(): AuthPayload | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AuthPayload;
    if (!parsed?.deploymentType || !parsed?.baseUrl || !parsed?.credentials) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistAuth(auth: AuthPayload): void {
  if (typeof window === 'undefined') {
    return;
  }

  const shouldClear =
    auth.baseUrl.trim().length === 0 &&
    auth.credentials.username.trim().length === 0 &&
    auth.credentials.secret.length === 0;

  if (shouldClear) {
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
