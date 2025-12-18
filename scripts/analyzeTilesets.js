/*
  Analyze which tileset images are actually referenced by Tiled maps (.tmj)
  in public/assets/maps and their tileset definitions (.tsx).

  Usage:
    node scripts/analyzeTilesets.js
*/

const fs = require('fs');
const path = require('path');

function walk(dir) {
  let out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out = out.concat(walk(p));
    else out.push(p);
  }
  return out;
}

function norm(p) {
  return String(p || '').replace(/\\/g, '/');
}

function parseTsxImages(tsxPath) {
  const xml = fs.readFileSync(tsxPath, 'utf8');
  const out = [];
  for (const m of xml.matchAll(/<image[^>]*\ssource="([^"]+)"/g)) {
    out.push(norm(m[1]));
  }
  return out;
}

function main() {
  const repoRoot = process.cwd();
  const mapsRoot = path.join(repoRoot, 'public', 'assets', 'maps');

  if (!fs.existsSync(mapsRoot)) {
    console.error('Maps folder not found:', mapsRoot);
    process.exitCode = 1;
    return;
  }

  const tmjFiles = walk(mapsRoot).filter(f => f.toLowerCase().endsWith('.tmj'));

  const usedImages = new Set();
  const tmjTilesetSources = new Set();

  for (const tmj of tmjFiles) {
    let json;
    try {
      json = JSON.parse(fs.readFileSync(tmj, 'utf8'));
    } catch (e) {
      console.error('Invalid JSON:', norm(path.relative(repoRoot, tmj)), e.message);
      continue;
    }

    const tilesets = Array.isArray(json.tilesets) ? json.tilesets : [];
    for (const ts of tilesets) {
      if (ts.image) usedImages.add(norm(ts.image));

      if (ts.source) {
        const source = norm(ts.source);
        tmjTilesetSources.add(source);

        if (source.toLowerCase().endsWith('.tsx')) {
          const tsxPath = path.join(path.dirname(tmj), ts.source);
          if (fs.existsSync(tsxPath)) {
            for (const img of parseTsxImages(tsxPath)) usedImages.add(img);
          } else {
            console.warn('Missing TSX referenced by TMJ:', norm(path.relative(repoRoot, tmj)), '->', source);
          }
        }
      }
    }
  }

  const images = [...usedImages].sort((a, b) => a.localeCompare(b));
  const tsxSources = [...tmjTilesetSources].filter(s => s.toLowerCase().endsWith('.tsx')).sort((a, b) => a.localeCompare(b));

  console.log('TMJ files:', tmjFiles.length);
  console.log('Tileset sources (.tsx) referenced by TMJ:', tsxSources.length);
  console.log('\nTileset images referenced by TMJ/TSX (as written in files):');
  for (const img of images) console.log(' -', img);
}

main();
