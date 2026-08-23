import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const functionsRoot = join(root, 'functions');
const shared = join(functionsRoot, '_shared', 'runtime.js');
const names = ['bootstrap', 'getGameConfig', 'syncProgress', 'claimRewardedBottle', 'submitLevelResult'];
for (const name of names) {
  const target = join(functionsRoot, name, '_shared');
  mkdirSync(target, { recursive: true });
  cpSync(shared, join(target, 'runtime.js'));
}
console.log(`prepared ${names.length} CloudBase functions`);
