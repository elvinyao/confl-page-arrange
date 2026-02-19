import { PageNode } from '@confl/shared';
import { DragEvent, useMemo, useState } from 'react';

interface PageTreeProps {
  root: PageNode;
  onMove: (dragId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

export function PageTree({ root, onMove, t }: PageTreeProps) {
  const [hoveredKey, setHoveredKey] = useState<string>('');
  const totalPages = useMemo(() => countNodes(root), [root]);

  const renderNode = (node: PageNode, depth: number) => {
    const keyPrefix = `${node.id}`;
    return (
      <li key={node.id} className="tree-node">
        <div
          className={`tree-row ${hoveredKey.startsWith(`${keyPrefix}:`) ? 'tree-row--hovered' : ''}`}
          style={{ paddingLeft: `${depth * 16}px` }}
          draggable={node.id !== root.id}
          onDragStart={(event) => handleDragStart(event, node.id)}
          onDragOver={(event) => handleDragOver(event, node.id)}
          onDragLeave={() => setHoveredKey('')}
          onDrop={(event) => handleDrop(event, node.id)}
        >
          <span className="tree-title">{node.title}</span>
          <span className="tree-meta">#{node.id}</span>
          {hoveredKey === `${node.id}:before` && <span className="drop-hint">{t('drop.before')}</span>}
          {hoveredKey === `${node.id}:inside` && <span className="drop-hint">{t('drop.inside')}</span>}
          {hoveredKey === `${node.id}:after` && <span className="drop-hint">{t('drop.after')}</span>}
        </div>

        {node.children.length > 0 && <ul className="tree-list">{node.children.map((child) => renderNode(child, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t('tree.root')}</h2>
        <span>{`${t('tree.loaded')}: ${totalPages}`}</span>
      </div>
      <p className="panel-hint">{t('tree.hint')}</p>
      <ul className="tree-list">{renderNode(root, 0)}</ul>
    </section>
  );

  function handleDragStart(event: DragEvent<HTMLDivElement>, pageId: string) {
    event.dataTransfer.setData('text/page-id', pageId);
    event.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>, pageId: string) {
    event.preventDefault();
    const position = inferDropPosition(event);
    setHoveredKey(`${pageId}:${position}`);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, targetId: string) {
    event.preventDefault();
    const dragId = event.dataTransfer.getData('text/page-id');
    if (!dragId) {
      return;
    }

    const position = inferDropPosition(event);
    setHoveredKey('');
    onMove(dragId, targetId, position);
  }
}

function inferDropPosition(event: DragEvent<HTMLDivElement>): 'before' | 'after' | 'inside' {
  const rect = event.currentTarget.getBoundingClientRect();
  const offsetY = event.clientY - rect.top;
  const ratio = offsetY / rect.height;

  if (ratio < 0.25) {
    return 'before';
  }
  if (ratio > 0.75) {
    return 'after';
  }
  return 'inside';
}

function countNodes(root: PageNode): number {
  let count = 1;
  root.children.forEach((child) => {
    count += countNodes(child);
  });
  return count;
}
