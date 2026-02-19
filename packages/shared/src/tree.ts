import {
  MoveOperation,
  PageNode,
  PlacementRef,
  ValidationError,
} from './types.js';

export type DropPosition = 'before' | 'after' | 'inside';

interface NodeIndexEntry {
  node: PageNode;
  parentId: string | null;
  index: number;
}

export function cloneTree(root: PageNode): PageNode {
  return {
    ...root,
    children: root.children.map((child) => cloneTree(child)),
  };
}

export function walkTree(root: PageNode, visit: (node: PageNode, parentId: string | null, index: number) => void): void {
  const traverse = (node: PageNode, parentId: string | null, index: number) => {
    visit(node, parentId, index);
    node.children.forEach((child, childIndex) => traverse(child, node.id, childIndex));
  };
  traverse(root, root.parentId, 0);
}

export function buildNodeIndex(root: PageNode): Map<string, NodeIndexEntry> {
  const index = new Map<string, NodeIndexEntry>();
  walkTree(root, (node, parentId, position) => {
    index.set(node.id, {
      node,
      parentId,
      index: position,
    });
  });
  return index;
}

export function hasCycle(root: PageNode): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const dfs = (node: PageNode): boolean => {
    if (visiting.has(node.id)) {
      return true;
    }
    if (visited.has(node.id)) {
      return false;
    }

    visiting.add(node.id);
    for (const child of node.children) {
      if (dfs(child)) {
        return true;
      }
    }
    visiting.delete(node.id);
    visited.add(node.id);
    return false;
  };

  return dfs(root);
}

function buildChildrenByParent(root: PageNode): Map<string, string[]> {
  const map = new Map<string, string[]>();

  const traverse = (node: PageNode) => {
    map.set(
      node.id,
      node.children.map((child) => child.id),
    );
    node.children.forEach((child) => traverse(child));
  };

  traverse(root);
  return map;
}

function createPlacement(
  pageId: string,
  parentId: string,
  toIndex: number,
  siblings: string[],
): PlacementRef {
  const prevId = toIndex > 0 ? siblings[toIndex - 1] : undefined;
  const nextId = toIndex < siblings.length - 1 ? siblings[toIndex + 1] : undefined;

  if (prevId && prevId !== pageId) {
    return {
      mode: 'afterSibling',
      referencePageId: prevId,
    };
  }

  if (nextId && nextId !== pageId) {
    return {
      mode: 'beforeSibling',
      referencePageId: nextId,
    };
  }

  return {
    mode: 'appendToParent',
    referencePageId: parentId,
  };
}

export function computeMovePlan(originalTree: PageNode, draftTree: PageNode): MoveOperation[] {
  const originalIndex = buildNodeIndex(originalTree);
  const draftIndex = buildNodeIndex(draftTree);

  if (originalIndex.size !== draftIndex.size) {
    throw new Error('Original tree and draft tree have different node counts.');
  }

  const draftChildrenByParent = buildChildrenByParent(draftTree);
  const moves: MoveOperation[] = [];

  for (const [pageId, before] of originalIndex.entries()) {
    if (pageId === originalTree.id) {
      continue;
    }

    const after = draftIndex.get(pageId);
    if (!after) {
      throw new Error(`Page ${pageId} does not exist in draft tree.`);
    }

    const parentChanged = before.parentId !== after.parentId;
    const indexChanged = before.index !== after.index;
    if (!parentChanged && !indexChanged) {
      continue;
    }

    if (!after.parentId) {
      throw new Error(`Page ${pageId} does not have a target parent in draft tree.`);
    }

    const siblings = draftChildrenByParent.get(after.parentId) ?? [];
    const placement = createPlacement(pageId, after.parentId, after.index, siblings);

    moves.push({
      pageId,
      fromParentId: before.parentId,
      toParentId: after.parentId,
      fromIndex: before.index,
      toIndex: after.index,
      placement,
      reason: parentChanged ? 'parent-change' : 'reorder',
    });
  }

  const parentMoves = moves.filter((move) => move.reason === 'parent-change');
  const reorderMoves = moves
    .filter((move) => move.reason === 'reorder')
    .sort((left, right) => {
      const leftParent = left.toParentId ?? '';
      const rightParent = right.toParentId ?? '';
      if (leftParent !== rightParent) {
        return leftParent.localeCompare(rightParent);
      }
      if (left.toIndex !== right.toIndex) {
        return left.toIndex - right.toIndex;
      }
      return left.pageId.localeCompare(right.pageId);
    });
  return [...parentMoves, ...reorderMoves];
}

function collectNodeIds(root: PageNode): Set<string> {
  const ids = new Set<string>();
  walkTree(root, (node) => {
    ids.add(node.id);
  });
  return ids;
}

export function validatePlanAgainstTree(root: PageNode, plan: MoveOperation[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const treeIndex = buildNodeIndex(root);
  const ids = collectNodeIds(root);
  const seen = new Set<string>();

  for (const op of plan) {
    if (seen.has(op.pageId)) {
      errors.push({
        code: 'DUPLICATE_PAGE',
        pageId: op.pageId,
        message: `Duplicate move operation for page ${op.pageId}.`,
      });
      continue;
    }
    seen.add(op.pageId);

    if (op.pageId === root.id) {
      errors.push({
        code: 'ROOT_MOVE_FORBIDDEN',
        pageId: op.pageId,
        message: 'Root page cannot be moved.',
      });
    }

    if (!ids.has(op.pageId)) {
      errors.push({
        code: 'MISSING_PAGE',
        pageId: op.pageId,
        message: `Page ${op.pageId} is missing in the loaded tree.`,
      });
    }

    if (!op.toParentId || !ids.has(op.toParentId)) {
      errors.push({
        code: 'MISSING_PAGE',
        pageId: op.pageId,
        message: `Target parent ${op.toParentId ?? 'null'} does not exist.`,
      });
      continue;
    }

    if (op.pageId === op.toParentId) {
      errors.push({
        code: 'SELF_PARENT',
        pageId: op.pageId,
        message: 'Page cannot be moved under itself.',
      });
    }

    const page = treeIndex.get(op.pageId)?.node;
    const parent = treeIndex.get(op.toParentId)?.node;
    if (page && parent && page.spaceKey !== parent.spaceKey) {
      errors.push({
        code: 'CROSS_SPACE',
        pageId: op.pageId,
        message: 'Cross-space move is not allowed.',
      });
    }
  }

  const simulatedParent = new Map<string, string | null>();
  for (const [id, entry] of treeIndex.entries()) {
    simulatedParent.set(id, entry.parentId);
  }
  for (const op of plan) {
    simulatedParent.set(op.pageId, op.toParentId);
  }

  for (const pageId of simulatedParent.keys()) {
    const path = new Set<string>();
    let current: string | null | undefined = pageId;
    while (current) {
      if (path.has(current)) {
        errors.push({
          code: 'CYCLE_DETECTED',
          pageId,
          message: `Cycle detected around page ${pageId}.`,
        });
        break;
      }
      path.add(current);
      current = simulatedParent.get(current);
    }
  }

  return dedupeErrors(errors);
}

function dedupeErrors(errors: ValidationError[]): ValidationError[] {
  const byKey = new Map<string, ValidationError>();
  for (const error of errors) {
    const key = `${error.code}:${error.pageId}:${error.message}`;
    byKey.set(key, error);
  }
  return [...byKey.values()];
}

interface LocateResult {
  node: PageNode;
  parent: PageNode | null;
  index: number;
}

function locateNode(root: PageNode, id: string): LocateResult | null {
  const stack: Array<{ node: PageNode; parent: PageNode | null }> = [{ node: root, parent: null }];

  while (stack.length > 0) {
    const item = stack.pop();
    if (!item) {
      break;
    }

    if (item.node.id === id) {
      const index = item.parent ? item.parent.children.findIndex((child) => child.id === id) : 0;
      return { node: item.node, parent: item.parent, index };
    }

    for (let i = item.node.children.length - 1; i >= 0; i -= 1) {
      stack.push({ node: item.node.children[i], parent: item.node });
    }
  }

  return null;
}

function containsDescendant(root: PageNode, candidateId: string): boolean {
  if (root.id === candidateId) {
    return true;
  }
  return root.children.some((child) => containsDescendant(child, candidateId));
}

function normalizeTree(root: PageNode, parentId: string | null): void {
  root.parentId = parentId;
  root.children.forEach((child, index) => {
    child.position = index;
    normalizeTree(child, root.id);
  });
}

export function moveNodeInTree(
  rootTree: PageNode,
  dragId: string,
  targetId: string,
  position: DropPosition,
): { ok: true; tree: PageNode } | { ok: false; error: string } {
  if (dragId === targetId && position === 'inside') {
    return { ok: false, error: 'Page cannot become its own parent.' };
  }

  const root = cloneTree(rootTree);
  if (root.id === dragId) {
    return { ok: false, error: 'Root page cannot be moved.' };
  }

  const dragRef = locateNode(root, dragId);
  const targetRef = locateNode(root, targetId);

  if (!dragRef || !targetRef) {
    return { ok: false, error: 'Drag node or target node not found.' };
  }

  if (containsDescendant(dragRef.node, targetId)) {
    return { ok: false, error: 'Cannot move a page into its own subtree.' };
  }

  if (!dragRef.parent) {
    return { ok: false, error: 'Drag node has no parent.' };
  }

  dragRef.parent.children.splice(dragRef.index, 1);

  if (position === 'inside') {
    targetRef.node.children.push(dragRef.node);
  } else {
    if (!targetRef.parent) {
      return { ok: false, error: 'Cannot place before/after root.' };
    }

    const freshTargetRef = locateNode(root, targetId);
    if (!freshTargetRef || !freshTargetRef.parent) {
      return { ok: false, error: 'Target no longer available.' };
    }

    const insertIndex =
      position === 'before' ? freshTargetRef.index : Math.min(freshTargetRef.index + 1, freshTargetRef.parent.children.length);
    freshTargetRef.parent.children.splice(insertIndex, 0, dragRef.node);
  }

  normalizeTree(root, root.parentId);
  return { ok: true, tree: root };
}
