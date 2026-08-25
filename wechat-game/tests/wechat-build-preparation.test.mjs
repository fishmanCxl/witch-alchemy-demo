import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const entryPath = resolve(projectRoot, 'build', 'wechatgame', 'subpackages', 'resources', 'game.js');
const projectConfigPath = resolve(projectRoot, 'build', 'wechatgame', 'project.config.json');

test('prepared resources subpackage exposes a WeChat game.js entry that loads its Cocos bundle', () => {
  const prepared = spawnSync(process.execPath, ['tools/prepare-wechat-build.mjs'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
  assert.equal(existsSync(entryPath), true, 'resources subpackage is missing the WeChat-required game.js');

  const required = [];
  vm.runInNewContext(readFileSync(entryPath, 'utf8'), {
    require(specifier) {
      required.push(specifier);
    },
  });
  assert.deepEqual(required, ['./index.js']);
});
test('prepared WeChat project keeps dynamically loaded Cocos bundle files in previews', () => {
  const prepared = spawnSync(process.execPath, ['tools/prepare-wechat-build.mjs'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);

  const projectConfig = JSON.parse(readFileSync(projectConfigPath, 'utf8'));
  assert.equal(projectConfig.setting.ignoreDevUnusedFiles, false);
  assert.equal(projectConfig.setting.ignoreUploadUnusedFiles, false);
  assert.equal(
    projectConfig.packOptions?.include?.some((rule) => rule.type === 'folder' && rule.value === 'subpackages/resources/'),
    true,
  );
});
