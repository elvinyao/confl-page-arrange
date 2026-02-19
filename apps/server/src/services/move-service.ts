import {
  ExecutionReport,
  MoveOperation,
  PageNode,
  ValidationError,
  validatePlanAgainstTree,
} from '@confl/shared';
import { ConfluenceAdapter } from '../confluence/index.js';

export function validateMovePlan(tree: PageNode, plan: MoveOperation[]): ValidationError[] {
  return validatePlanAgainstTree(tree, plan);
}

export async function commitMovePlan(
  adapter: ConfluenceAdapter,
  plan: MoveOperation[],
  options: { dryRun?: boolean } = {},
): Promise<ExecutionReport> {
  const orderedPlan = orderPlan(plan);

  if (options.dryRun) {
    return {
      total: orderedPlan.length,
      succeeded: orderedPlan.length,
      failed: 0,
      items: orderedPlan.map((move) => ({
        pageId: move.pageId,
        status: 'skipped',
        message: 'Dry-run: operation not executed.',
        retryable: false,
      })),
    };
  }

  const items: ExecutionReport['items'] = [];
  for (const move of orderedPlan) {
    try {
      await adapter.movePage(move);
      items.push({
        pageId: move.pageId,
        status: 'success',
        message: `Moved page ${move.pageId}.`,
        retryable: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown move failure';
      items.push({
        pageId: move.pageId,
        status: 'failed',
        message,
        retryable: /429|5\d\d/.test(message),
      });
    }
  }

  const failed = items.filter((item) => item.status === 'failed').length;
  const succeeded = items.length - failed;

  return {
    total: items.length,
    succeeded,
    failed,
    items,
  };
}

function orderPlan(plan: MoveOperation[]): MoveOperation[] {
  const parentChange = plan.filter((move) => move.reason === 'parent-change');
  const reorder = plan.filter((move) => move.reason === 'reorder');
  return [...parentChange, ...reorder];
}
