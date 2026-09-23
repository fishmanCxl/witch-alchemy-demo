import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../assets/resources/game/chibi/', import.meta.url));
const requested = new Set(process.argv.slice(2).map((path) => path.replaceAll('\\', '/')));

function pngSize(path) {
  const header = readFileSync(path).subarray(0, 24);
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

function spriteFrameMeta(baseUuid, textureUuid, displayName, width, height) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  return {
    importer: 'sprite-frame',
    uuid: `${baseUuid}@f9941`,
    displayName,
    id: 'f9941',
    name: 'spriteFrame',
    userData: {
      trimType: 'auto', trimThreshold: 1, rotated: false,
      offsetX: 0, offsetY: 0, trimX: 0, trimY: 0,
      width, height, rawWidth: width, rawHeight: height,
      borderTop: 0, borderBottom: 0, borderLeft: 0, borderRight: 0,
      isUuid: true,
      imageUuidOrDatabaseUri: textureUuid,
      atlasUuid: '', packable: true,
      vertices: {
        rawPosition: [-halfWidth, -halfHeight, 0, halfWidth, -halfHeight, 0, -halfWidth, halfHeight, 0, halfWidth, halfHeight, 0],
        indexes: [0, 1, 2, 2, 1, 3],
        uv: [0, height, width, height, 0, 0, width, 0],
        nuv: [0, 0, 1, 0, 0, 1, 1, 1],
        minPos: [-halfWidth, -halfHeight, 0],
        maxPos: [halfWidth, halfHeight, 0],
      },
      pixelsToUnit: 100, pivotX: 0.5, pivotY: 0.5, meshType: 0,
    },
    ver: '1.0.12', imported: true, files: ['.json'], subMetas: {},
  };
}

const pending = [root];
let pngCount = 0;
let changed = 0;

while (pending.length > 0) {
  const directory = pending.pop();
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) pending.push(path);
    if (!entry.isFile() || !entry.name.endsWith('.png')) continue;
    const relativePath = relative(root, path).replaceAll('\\', '/');
    if (requested.size > 0 && !requested.has(relativePath)) continue;
    pngCount += 1;

    const metaPath = `${path}.meta`;
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    const texture = Object.values(meta.subMetas).find((subMeta) => subMeta.importer === 'texture');
    if (!texture) throw new Error(`missing texture sub-meta: ${entry.name}`);
    texture.userData.wrapModeS = 'clamp-to-edge';
    texture.userData.wrapModeT = 'clamp-to-edge';
    const { width, height } = pngSize(path);
    meta.subMetas.f9941 = spriteFrameMeta(meta.uuid, texture.uuid, texture.displayName, width, height);
    meta.userData.type = 'sprite-frame';

    const next = `${JSON.stringify(meta, null, 2)}\n`;
    if (next !== readFileSync(metaPath, 'utf8')) {
      writeFileSync(metaPath, next);
      changed += 1;
    }
  }
}

console.log(`configured ${pngCount} chibi PNGs as SpriteFrames; changed ${changed}`);
