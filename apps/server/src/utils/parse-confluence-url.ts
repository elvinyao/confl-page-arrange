const PAGE_ID_PATTERNS = [
  /pageId=(\d+)/i,
  /\/pages\/(\d+)\//i,
  /\/pages\/(\d+)$/i,
  /\/spaces\/[^/]+\/pages\/(\d+)/i,
];

export function extractPageIdFromUrl(input: string): string {
  for (const pattern of PAGE_ID_PATTERNS) {
    const match = input.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  throw new Error('Cannot parse page ID from URL.');
}
