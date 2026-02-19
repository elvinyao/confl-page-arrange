import { describe, expect, it } from 'vitest';
import {
  PageNode,
  computeMovePlan,
  moveNodeInTree,
  validatePlanAgainstTree,
} from '../src/index.js';

function createTree(): PageNode {
  return {
    id: 'root',
    title: 'Root',
    parentId: null,
    spaceKey: 'DOC',
    position: 0,
    children: [
      {
        id: 'a',
        title: 'A',
        parentId: 'root',
        spaceKey: 'DOC',
        position: 0,
        children: [],
      },
      {
        id: 'b',
        title: 'B',
        parentId: 'root',
        spaceKey: 'DOC',
        position: 1,
        children: [
          {
            id: 'c',
            title: 'C',
            parentId: 'b',
            spaceKey: 'DOC',
            position: 0,
            children: [],
          },
        ],
      },
    ],
  };
}

describe('tree planning', () => {
  it('computes reorder operations', () => {
    const original = createTree();
    const draft: PageNode = {
      ...original,
      children: [original.children[1], original.children[0]],
    };
    draft.children[0].position = 0;
    draft.children[1].position = 1;

    const plan = computeMovePlan(original, draft);
    expect(plan).toHaveLength(2);
    expect(plan[0].pageId).toBe('b');
  });

  it('detects cycle in plan', () => {
    const original = createTree();
    const errors = validatePlanAgainstTree(original, [
      {
        pageId: 'b',
        fromParentId: 'root',
        toParentId: 'c',
        fromIndex: 1,
        toIndex: 0,
        placement: {
          mode: 'appendToParent',
          referencePageId: 'c',
        },
        reason: 'parent-change',
      },
    ]);

    expect(errors.some((error) => error.code === 'CYCLE_DETECTED')).toBe(true);
  });

  it('moves node inside target', () => {
    const original = createTree();
    const result = moveNodeInTree(original, 'a', 'b', 'inside');

    expect(result.ok).toBe(true);
    if (result.ok) {
      const target = result.tree.children.find((node) => node.id === 'b');
      expect(target?.children.map((node) => node.id)).toContain('a');
    }
  });
});
