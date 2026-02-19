import { MoveOperation, ValidationError } from '@confl/shared';

interface PlanPreviewProps {
  plan: MoveOperation[];
  validationErrors: ValidationError[];
  t: (key: string, vars?: Record<string, string | number>) => string;
}

export function PlanPreview({ plan, validationErrors, t }: PlanPreviewProps) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t('plan.title')}</h2>
        <span>{plan.length}</span>
      </div>

      {plan.length === 0 ? (
        <p>{t('plan.empty')}</p>
      ) : (
        <table className="plan-table">
          <thead>
            <tr>
              <th>{t('plan.header.pageId')}</th>
              <th>{t('plan.header.fromParent')}</th>
              <th>{t('plan.header.toParent')}</th>
              <th>{t('plan.header.placement')}</th>
              <th>{t('plan.header.reason')}</th>
            </tr>
          </thead>
          <tbody>
            {plan.map((operation) => (
              <tr key={operation.pageId}>
                <td>{operation.pageId}</td>
                <td>{operation.fromParentId ?? t('common.null')}</td>
                <td>{operation.toParentId ?? t('common.null')}</td>
                <td>{`${t(`plan.placement.${operation.placement.mode}`)}(${operation.placement.referencePageId})`}</td>
                <td>{t(`plan.reason.${operation.reason}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {validationErrors.length === 0 ? (
        <p className="ok-message">{t('plan.ok')}</p>
      ) : (
        <div className="error-box">
          <p>{t('plan.invalid')}</p>
          <ul>
            {validationErrors.map((error) => (
              <li key={`${error.code}:${error.pageId}`}>{`${error.code}: ${error.message}`}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
