import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..');
const dist = resolve(root, 'dist');
mkdirSync(dist, { recursive: true });
copyFileSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'));
