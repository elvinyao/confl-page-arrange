import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const targetDir = join(root, 'apps', 'web');
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.html']);
const offenders = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') {
      continue;
    }
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }

    const ext = full.slice(full.lastIndexOf('.'));
    if (!allowedExtensions.has(ext)) {
      continue;
    }

    const lines = readFileSync(full, 'utf8').split('\n');
    lines.forEach((line, index) => {
      const hasRemote = /https?:\/\//i.test(line) || /\/\//.test(line) && /src=|href=|url\(/i.test(line);
      const isLocalhost = /https?:\/\/(localhost|127\.0\.0\.1)/i.test(line);
      if (hasRemote && !isLocalhost) {
        offenders.push(`${full}:${index + 1}: ${line.trim()}`);
      }
    });
  }
}

walk(targetDir);

if (offenders.length > 0) {
  console.error('Remote UI assets are not allowed. Found:');
  offenders.forEach((offender) => console.error(`- ${offender}`));
  process.exit(1);
}

console.log('OK: no remote UI asset references found.');
