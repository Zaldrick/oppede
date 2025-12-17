/*
  Splits oversized Tiled embedded tileset images referenced by TMJ files into
  smaller vertical slices that fit within a given GPU MAX_TEXTURE_SIZE.

  Why: Some Android WebGL devices refuse to upload textures larger than maxTex
  (commonly 4096 or 8192). When a tileset image exceeds that, Phaser tile layers
  can render black/missing while sprites still render.

  This script:
  - scans public/assets/maps/*.tmj
  - normalizes tileset.image paths to local files when possible
  - for any tileset image whose width/height exceeds maxTex:
      - slices vertically (height only) on tile-height boundaries
      - replaces the single tileset entry with multiple entries (part_0, part_1, ...)
      - preserves gid mapping by keeping firstgid contiguous
      - splits per-tile metadata (tiles[]) into the correct part
  - writes a .bak copy next to each modified tmj
  - writes generated images to public/assets/maps/sliced/

  Usage:
    node ./scripts/split_oversized_tilesets.js
    node ./scripts/split_oversized_tilesets.js --maxTex=4096

  Notes:
  - Idempotent-ish: it skips tilesets already referencing /sliced/ or *_part_\d+.
  - Only supports splitting along HEIGHT (width must be <= maxTex).
*/

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('[tilesets] Missing dependency: sharp');
  console.error('[tilesets] Install it with: npm i -D sharp');
  process.exit(1);
}

const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const MAPS_DIR = path.join(WORKSPACE_ROOT, 'public', 'assets', 'maps');
const OUTPUT_DIR = path.join(MAPS_DIR, 'sliced');

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function toPosix(p) {
  return String(p || '').replace(/\\/g, '/');
}

function basenamePosix(p) {
  const s = toPosix(p);
  const idx = s.lastIndexOf('/');
  return idx >= 0 ? s.slice(idx + 1) : s;
}

function looksAlreadySliced(tileset) {
  const name = String(tileset?.name || '');
  const img = String(tileset?.image || '');
  if (/\bsliced\//i.test(img)) return true;
  if (/_part_\d+$/i.test(name)) return true;
  if (/_part_\d+\./i.test(img)) return true;
  return false;
}

function cloneWithout(obj, keysToOmit) {
  const out = {};
  for (const k of Object.keys(obj || {})) {
    if (!keysToOmit.has(k)) out[k] = obj[k];
  }
  return out;
}

function splitTileMetadata(originalTiles, sliceStartId, sliceTileCount) {
  if (!Array.isArray(originalTiles) || originalTiles.length === 0) return undefined;
  const sliceEndExclusive = sliceStartId + sliceTileCount;
  const picked = [];
  for (const t of originalTiles) {
    const id = t?.id;
    if (typeof id !== 'number') continue;
    if (id >= sliceStartId && id < sliceEndExclusive) {
      const copy = { ...t, id: id - sliceStartId };
      picked.push(copy);
    }
  }
  return picked.length > 0 ? picked : undefined;
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function fileExists(p) {
  try {
    await fsp.access(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function loadJson(filePath) {
  const txt = await fsp.readFile(filePath, 'utf8');
  return JSON.parse(txt);
}

async function writeJson(filePath, data) {
  const txt = JSON.stringify(data, null, 1) + '\n';
  await fsp.writeFile(filePath, txt, 'utf8');
}

async function splitTilesetImage({
  srcPath,
  outBaseName,
  tileHeight,
  columns,
  tileCount,
  maxTex,
}) {
  const meta = await sharp(srcPath).metadata();
  const imgW = meta.width;
  const imgH = meta.height;

  if (!imgW || !imgH) throw new Error(`Cannot read metadata for ${srcPath}`);
  if (imgW > maxTex) {
    throw new Error(`Tileset too wide (${imgW}) for maxTex=${maxTex}: ${path.basename(srcPath)}`);
  }

  const totalRows = Math.ceil(tileCount / columns);
  const maxRowsPerSlice = Math.floor(maxTex / tileHeight);
  if (maxRowsPerSlice <= 0) throw new Error(`maxTex too small for tileHeight=${tileHeight}`);

  const slices = [];
  let rowStart = 0;
  let tileIdStart = 0;

  while (rowStart < totalRows) {
    const rows = Math.min(maxRowsPerSlice, totalRows - rowStart);
    const expectedSliceHeight = rows * tileHeight;
    const top = rowStart * tileHeight;

    // Clamp to source image height (in case metadata is off). Keep multiple of tileHeight when possible.
    let height = Math.min(expectedSliceHeight, imgH - top);
    if (height <= 0) break;
    if (height % tileHeight !== 0) {
      height = height - (height % tileHeight);
      if (height <= 0) break;
    }

    const sliceIndex = slices.length;
    const outFile = `${outBaseName}_part_${sliceIndex}.png`;
    const outPath = path.join(OUTPUT_DIR, outFile);

    // Compute how many tiles are in this slice
    const rowsEffective = Math.floor(height / tileHeight);
    const tilesInSliceMax = rowsEffective * columns;
    const remainingTiles = tileCount - tileIdStart;
    const tilesInSlice = Math.min(tilesInSliceMax, remainingTiles);

    await sharp(srcPath)
      .extract({ left: 0, top, width: imgW, height })
      .png({ compressionLevel: 9 })
      .toFile(outPath);

    slices.push({
      outFile,
      outPath,
      width: imgW,
      height,
      tileIdStart,
      tileCount: tilesInSlice,
      columns,
    });

    rowStart += rowsEffective;
    tileIdStart += tilesInSlice;
  }

  if (tileIdStart !== tileCount) {
    throw new Error(`Slice computation mismatch for ${path.basename(srcPath)}: produced ${tileIdStart} tiles, expected ${tileCount}`);
  }

  return slices;
}

async function transformMapInPlace(map, maxTex) {
  if (!Array.isArray(map.tilesets) || map.tilesets.length === 0) return { changed: false, changes: [] };

  const changes = [];
  const newTilesets = [];

  for (const ts of map.tilesets) {
    // Keep non-embedded external TSX untouched
    if (ts && ts.source) {
      newTilesets.push(ts);
      continue;
    }

    if (!ts || !ts.image || !ts.name) {
      newTilesets.push(ts);
      continue;
    }

    if (looksAlreadySliced(ts)) {
      newTilesets.push(ts);
      continue;
    }

    const tw = Number(ts.tilewidth);
    const th = Number(ts.tileheight);
    const cols = Number(ts.columns) || (Number(ts.imagewidth) && tw ? Math.floor(Number(ts.imagewidth) / tw) : 0);
    const tileCount = Number(ts.tilecount);
    if (!tw || !th || !cols || !tileCount) {
      newTilesets.push(ts);
      continue;
    }

    // Resolve image file from TMJ into local public/assets/maps.
    const imgRaw = String(ts.image);
    const imgBase = basenamePosix(imgRaw);
    const candidate1 = path.join(MAPS_DIR, toPosix(imgRaw));
    const candidate2 = path.join(MAPS_DIR, imgBase);

    let srcPath = null;
    if (await fileExists(candidate1)) srcPath = candidate1;
    else if (await fileExists(candidate2)) srcPath = candidate2;

    if (!srcPath) {
      newTilesets.push(ts);
      continue;
    }

    const meta = await sharp(srcPath).metadata();
    const w = meta.width;
    const h = meta.height;
    if (!w || !h) {
      newTilesets.push(ts);
      continue;
    }

    // Normalize to local filename when possible.
    const normalizedImage = imgBase;
    const oversize = w > maxTex || h > maxTex;

    if (!oversize) {
      if (ts.image !== normalizedImage) {
        newTilesets.push({ ...ts, image: normalizedImage, imagewidth: w, imageheight: h });
        changes.push({ type: 'normalize-image', tileset: ts.name });
      } else {
        newTilesets.push(ts);
      }
      continue;
    }

    if (w > maxTex) {
      // Not supported in this script (would require splitting horizontally and remapping ids).
      newTilesets.push(ts);
      changes.push({ type: 'skip-too-wide', tileset: ts.name, width: w, maxTex });
      continue;
    }

    await ensureDir(OUTPUT_DIR);

    const slices = await splitTilesetImage({
      srcPath,
      outBaseName: ts.name,
      tileHeight: th,
      columns: cols,
      tileCount,
      maxTex,
    });

    const baseFields = cloneWithout(ts, new Set([
      'image',
      'imagewidth',
      'imageheight',
      'tilecount',
      'firstgid',
      'name',
      'tiles',
    ]));

    slices.forEach((s, idx) => {
      const partName = idx === 0 ? ts.name : `${ts.name}_part_${idx}`;
      const partFirstGid = Number(ts.firstgid) + s.tileIdStart;
      const partTiles = splitTileMetadata(ts.tiles, s.tileIdStart, s.tileCount);

      const partTs = {
        ...baseFields,
        columns: s.columns,
        firstgid: partFirstGid,
        image: `sliced/${s.outFile}`,
        imagewidth: s.width,
        imageheight: s.height,
        margin: ts.margin ?? 0,
        spacing: ts.spacing ?? 0,
        name: partName,
        tilecount: s.tileCount,
        tilewidth: tw,
        tileheight: th,
      };
      if (partTiles) partTs.tiles = partTiles;
      newTilesets.push(partTs);
    });

    changes.push({ type: 'split', tileset: ts.name, parts: slices.length, width: w, height: h });
  }

  if (changes.length > 0) {
    map.tilesets = newTilesets;
    return { changed: true, changes };
  }
  return { changed: false, changes: [] };
}

async function main() {
  const args = parseArgs(process.argv);
  const maxTex = Number(args.maxTex || 4096);

  if (!Number.isFinite(maxTex) || maxTex < 256) {
    console.error('[tilesets] Invalid --maxTex value');
    process.exit(1);
  }

  const entries = await fsp.readdir(MAPS_DIR, { withFileTypes: true });
  const tmjs = entries
    .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.tmj'))
    .map(e => path.join(MAPS_DIR, e.name));

  if (tmjs.length === 0) {
    console.log('[tilesets] No .tmj files found in', MAPS_DIR);
    return;
  }

  console.log(`[tilesets] Scanning ${tmjs.length} TMJ files (maxTex=${maxTex})…`);

  let modifiedCount = 0;
  let splitCount = 0;

  for (const tmj of tmjs) {
    try {
      const map = await loadJson(tmj);
      const res = await transformMapInPlace(map, maxTex);

      if (!res.changed) continue;

      const bak = tmj.replace(/\.tmj$/i, `.bak.tmj`);
      if (!(await fileExists(bak))) {
        await fsp.copyFile(tmj, bak);
      }

      await writeJson(tmj, map);

      modifiedCount += 1;
      splitCount += res.changes.filter(c => c.type === 'split').length;

      console.log(`[tilesets] Updated ${path.basename(tmj)}: ${res.changes.map(c => c.type).join(', ')}`);
    } catch (e) {
      console.warn(`[tilesets] ${path.basename(tmj)} failed: ${e.message || e}`);
    }
  }

  console.log(`[tilesets] Done. Modified TMJ files: ${modifiedCount}. Split tilesets: ${splitCount}.`);
  if (modifiedCount > 0) {
    console.log(`[tilesets] Generated images in: ${path.relative(WORKSPACE_ROOT, OUTPUT_DIR)}`);
  }
}

main().catch((e) => {
  console.error('[tilesets] Fatal:', e);
  process.exit(1);
});
