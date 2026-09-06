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
const mainBundlePath = resolve(projectRoot, 'build', 'wechatgame', 'assets', 'main', 'index.js');

function loadCompiledCollectionProgress() {
  const bundle = readFileSync(mainBundlePath, 'utf8');
  const start = bundle.indexOf('System.register("chunks:///_virtual/collection-progress.ts"');
  const end = bundle.indexOf('\nSystem.register(', start + 1);
  assert.notEqual(start, -1, 'compiled collection-progress module is missing');

  const compiledExports = {};
  const modules = {
    './rollupPluginModLoBabelHelpers.js': {
      createForOfIteratorHelperLoose(iterable) {
        const iterator = iterable[Symbol.iterator]();
        return () => iterator.next();
      },
    },
    cc: { cclegacy: { _RF: { push() {}, pop() {} } } },
    './chapter-catalog.ts': {
      CHAPTERS: [{ id: 1, firstLevel: 1, levelCount: 30, stageTitle: '见习魔女' }],
      getChapter: (id) => id === 1
        ? { id: 1, firstLevel: 1, levelCount: 30, stageTitle: '见习魔女' }
        : null,
    },
    './level-config.ts': {
      levelNumber: (id) => Number(/^level-([0-9]{3})$/.exec(id)?.[1] ?? NaN) || null,
    },
  };

  vm.runInNewContext(bundle.slice(start, end === -1 ? bundle.length : end), {
    System: {
      register(_name, dependencies, declare) {
        const registration = declare((name, value) => {
          if (typeof name === 'string') compiledExports[name] = value;
          else Object.assign(compiledExports, name);
        });
        registration.setters.forEach((setter, index) => setter(modules[dependencies[index]]));
        registration.execute();
      },
    },
  });
  return compiledExports.deriveCollectionProgress;
}

function loadCompiledLevelProgress() {
  const bundle = readFileSync(mainBundlePath, 'utf8');
  const start = bundle.indexOf('System.register("chunks:///_virtual/level-progress.ts"');
  const end = bundle.indexOf('\nSystem.register(', start + 1);
  assert.notEqual(start, -1, 'compiled level-progress module is missing');

  const levels = Array.from({ length: 60 }, (_, index) => ({
    id: `level-${String(index + 1).padStart(3, '0')}`,
    number: index + 1,
  }));
  const compiledExports = {};
  const modules = {
    './rollupPluginModLoBabelHelpers.js': {
      extends: Object.assign,
      createForOfIteratorHelperLoose(iterable) {
        const iterator = iterable[Symbol.iterator]();
        return () => iterator.next();
      },
    },
    cc: { cclegacy: { _RF: { push() {}, pop() {} } } },
    './level-catalog.ts': {
      GAME_CONFIG_VERSION: 'compiled-test',
      PUBLISHED_LEVELS: levels,
      getLevelConfig: (id) => levels.find((level) => level.id === id) ?? null,
      nextLevelConfig: (id) => {
        const index = levels.findIndex((level) => level.id === id);
        return index >= 0 ? levels[index + 1] ?? null : null;
      },
    },
  };

  vm.runInNewContext(bundle.slice(start, end === -1 ? bundle.length : end), {
    System: {
      register(_name, dependencies, declare) {
        const registration = declare((name, value) => {
          if (typeof name === 'string') compiledExports[name] = value;
          else Object.assign(compiledExports, name);
        });
        registration.setters.forEach((setter, index) => setter(modules[dependencies[index]]));
        registration.execute();
      },
    },
  });
  return compiledExports;
}

test('prepared resources subpackage executes the Cocos bundle directly from game.js', () => {
  const prepared = spawnSync(process.execPath, ['tools/prepare-wechat-build.mjs'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
  assert.equal(existsSync(entryPath), true, 'resources subpackage is missing the WeChat-required game.js');

  const registered = [];
  vm.runInNewContext(readFileSync(entryPath, 'utf8'), {
    System: {
      register(name) {
        registered.push(name);
      },
    },
  });
  assert.deepEqual(registered, [
    'chunks:///_virtual/resources',
    'virtual:///prerequisite-imports/resources',
  ]);
});
test('prepared WeChat project keeps dynamically loaded Cocos bundle files in previews', () => {
  const expectedAppId = 'wx-local-preview-test';
  const prepared = spawnSync(process.execPath, ['tools/prepare-wechat-build.mjs'], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, WECHAT_APPID: expectedAppId },
  });

  assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);

  const projectConfig = JSON.parse(readFileSync(projectConfigPath, 'utf8'));
  assert.equal(projectConfig.appid, expectedAppId);
  assert.equal(projectConfig.setting.ignoreDevUnusedFiles, false);
  assert.equal(projectConfig.setting.ignoreUploadUnusedFiles, false);
  assert.equal(
    projectConfig.packOptions?.include?.some((rule) => rule.type === 'folder' && rule.value === 'subpackages/resources/'),
    true,
  );
});

test('compiled WeChat collection progress derives pieces from the continuous boundary', () => {
  const deriveCollectionProgress = loadCompiledCollectionProgress();
  assert.equal(deriveCollectionProgress({ completedThrough: 30 }, 1).revealedPieces, 6);
});

test('compiled WeChat progress keeps five sequential completions without an ID array', () => {
  const { completeLevel, createDefaultProgress } = loadCompiledLevelProgress();
  let progress = createDefaultProgress();
  for (let number = 1; number <= 5; number += 1) {
    const id = `level-${String(number).padStart(3, '0')}`;
    progress = completeLevel(progress, id, 8);
  }

  assert.equal(progress.completedThrough, 5);
  assert.equal('completedLevels' in progress, false);
});
