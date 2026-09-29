import { cpSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(projectRoot, '..');
const sourceRoot = join(workspaceRoot, 'prototype', 'public', 'assets', 'game');
const targetRoot = join(projectRoot, 'assets', 'resources', 'game');
const includeInProduction = (path) => relative(sourceRoot, path).replaceAll('\\', '/') !== 'chibi/ui/audio-settings-panel.png';

for (const directory of ['chibi', 'audio']) {
  const source = join(sourceRoot, directory);
  const target = join(targetRoot, directory);
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true, force: true, filter: includeInProduction });
}

function collectFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(path) : [path];
  });
}

const files = ['chibi', 'audio'].flatMap((directory) => collectFiles(join(sourceRoot, directory))).filter(includeInProduction);
const report = {
  source: 'prototype/public/assets/game',
  generatedAt: new Date().toISOString(),
  files: files.length,
  bytes: files.reduce((total, path) => total + statSync(path).size, 0),
  paths: files.map((path) => relative(sourceRoot, path).replaceAll('\\', '/')).sort(),
};
writeFileSync(join(targetRoot, 'sync-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`synchronized ${report.files} approved files (${report.bytes} bytes)`);

