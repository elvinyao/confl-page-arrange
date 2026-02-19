import { PageNode } from '@confl/shared';
import { ConfluenceAdapter, ConfluencePage } from '../confluence/index.js';
import { extractPageIdFromUrl } from '../utils/parse-confluence-url.js';

const MAX_PAGES = 500;

export async function loadTreeByParentUrl(adapter: ConfluenceAdapter, parentPageUrl: string): Promise<PageNode> {
  const rootPageId = extractPageIdFromUrl(parentPageUrl);
  const rootPage = await adapter.getPage(rootPageId);

  let loadedCount = 0;
  const rootNode = await buildPageNode(adapter, rootPage, () => {
    loadedCount += 1;
    if (loadedCount > MAX_PAGES) {
      throw new Error(`Tree has more than ${MAX_PAGES} pages. Narrow your root page.`);
    }
  });

  return rootNode;
}

async function buildPageNode(
  adapter: ConfluenceAdapter,
  page: ConfluencePage,
  onNodeLoaded: () => void,
): Promise<PageNode> {
  onNodeLoaded();

  const childrenPages = await listAllChildren(adapter, page.id);
  const children: PageNode[] = [];

  for (let index = 0; index < childrenPages.length; index += 1) {
    const childPage = childrenPages[index];
    const childNode = await buildPageNode(adapter, childPage, onNodeLoaded);
    childNode.position = index;
    childNode.parentId = page.id;
    children.push(childNode);
  }

  return {
    id: page.id,
    title: page.title,
    parentId: page.parentId,
    spaceKey: page.spaceKey,
    position: 0,
    children,
  };
}

async function listAllChildren(adapter: ConfluenceAdapter, pageId: string): Promise<ConfluencePage[]> {
  const result: ConfluencePage[] = [];
  let start = 0;

  while (true) {
    const chunk = await adapter.listChildren(pageId, start);
    result.push(...chunk.pages);
    if (chunk.nextStart === null) {
      break;
    }
    start = chunk.nextStart;
  }

  return result;
}
