import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputRoot = resolve(projectRoot, 'build', 'wechatgame');
const sourceBundle = resolve(outputRoot, 'assets', 'resources');
const targetBundle = resolve(outputRoot, 'subpackages', 'resources');
const assertInsideOutput = (path) => {
  if (!normalize(path).startsWith(`${normalize(outputRoot)}\\`)) throw new Error(`unsafe output path: ${path}`);
};
assertInsideOutput(sourceBundle);
assertInsideOutput(targetBundle);

if (!existsSync(sourceBundle) && !existsSync(targetBundle)) {
  throw new Error('missing build/wechatgame assets/resources; build the WeChat target first');
}
if (existsSync(sourceBundle)) {
  if (existsSync(targetBundle)) rmSync(targetBundle, { recursive: true });
  mkdirSync(dirname(targetBundle), { recursive: true });
  renameSync(sourceBundle, targetBundle);
}
writeFileSync(join(targetBundle, 'game.js'), "require('./index.js');\n");

const gamePath = join(outputRoot, 'game.json');
const game = JSON.parse(readFileSync(gamePath, 'utf8'));
game.subpackages = [
  ...(Array.isArray(game.subpackages) ? game.subpackages : []).filter((entry) => entry?.name !== 'resources'),
  { name: 'resources', root: 'subpackages/resources' },
];
writeFileSync(gamePath, `${JSON.stringify(game, null, 2)}\n`);

const projectConfigPath = join(outputRoot, 'project.config.json');
const projectConfig = JSON.parse(readFileSync(projectConfigPath, 'utf8'));
const appId = process.env.WECHAT_APPID?.trim();
if (appId) projectConfig.appid = appId;
projectConfig.setting = projectConfig.setting || {};
projectConfig.setting.ignoreDevUnusedFiles = false;
projectConfig.setting.ignoreUploadUnusedFiles = false;
projectConfig.packOptions = projectConfig.packOptions || {};
const packageIncludes = Array.isArray(projectConfig.packOptions.include) ? projectConfig.packOptions.include : [];
projectConfig.packOptions.include = [
  ...packageIncludes.filter((rule) => rule?.type !== 'folder' || rule?.value !== 'subpackages/resources/'),
  { type: 'folder', value: 'subpackages/resources/' },
];
writeFileSync(projectConfigPath, `${JSON.stringify(projectConfig, null, 2)}\n`);

const settingsPath = join(outputRoot, 'src', 'settings.json');
const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
settings.assets.subpackages = [...new Set([...(settings.assets.subpackages || []), 'resources'])];
writeFileSync(settingsPath, JSON.stringify(settings));

const allFiles = [];
const walk = async (root) => {
  const { readdir } = await import('node:fs/promises');
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) await walk(path);
    else allFiles.push(path);
  }
};
await walk(outputRoot);
const { stat } = await import('node:fs/promises');
let mainBytes = 0;
let subpackageBytes = 0;
for (const path of allFiles) {
  const size = (await stat(path)).size;
  if (path.startsWith(`${resolve(outputRoot, 'subpackages')}\\`)) subpackageBytes += size;
  else mainBytes += size;
}
const totalBytes = mainBytes + subpackageBytes;
if (mainBytes > 4 * 1048576) throw new Error(`WeChat main package exceeds 4 MiB: ${mainBytes}`);
if (totalBytes > 30 * 1048576) throw new Error(`WeChat total package exceeds 30 MiB: ${totalBytes}`);
console.log(JSON.stringify({
  mainBytes,
  subpackageBytes,
  totalBytes,
  mainMiB: +(mainBytes / 1048576).toFixed(2),
  subpackageMiB: +(subpackageBytes / 1048576).toFixed(2),
  totalMiB: +(totalBytes / 1048576).toFixed(2),
}));
