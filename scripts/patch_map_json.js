const fs = require('fs');
const path = require('path');

const mapPath = path.join(__dirname, '../public/assets/maps/qwest.tmj');
const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

// Configuration
const originalTilesetName = "Interiors_48x48";
const splitBaseName = "Interiors_48x48_part_";
const originalImageHeight = 41232;
const splitHeight = 4080;
const tileHeight = 48;
const tilesPerSplit = splitHeight / tileHeight; // 85 tiles high
const originalWidth = 768;
const tilesWidth = originalWidth / tileHeight; // 16 tiles wide
const totalTilesInSplit = tilesPerSplit * tilesWidth; // 1360 tiles per split

// Find the original tileset
const tilesetIndex = mapData.tilesets.findIndex(t => t.name === originalTilesetName);

if (tilesetIndex === -1) {
    console.error(`Tileset ${originalTilesetName} not found!`);
    process.exit(1);
}

const originalTileset = mapData.tilesets[tilesetIndex];
const startGid = originalTileset.firstgid;

console.log(`Found tileset ${originalTilesetName} at index ${tilesetIndex} with firstgid ${startGid}`);

// Create new tileset entries
const newTilesets = [];
const numSplits = Math.ceil(originalImageHeight / splitHeight);

for (let i = 0; i < numSplits; i++) {
    const currentHeight = (i === numSplits - 1) ? (originalImageHeight % splitHeight) : splitHeight;
    const currentTileCount = (currentHeight / tileHeight) * tilesWidth;
    
    const newTileset = {
        ...originalTileset,
        name: `${splitBaseName}${i}`,
        image: `${splitBaseName}${i}.png`,
        imageheight: currentHeight,
        tilecount: currentTileCount,
        firstgid: startGid + (i * totalTilesInSplit),
        // Clear tiles property as it might contain specific tile data that needs to be mapped or cleared
        // For now, we keep it empty or copy if needed, but usually large tilesets don't have per-tile properties for all tiles
        tiles: [] 
    };
    
    // If the original tileset had specific tile properties (collisions etc), we might need to map them.
    // But for visual tilesets, usually it's fine.
    // If there were properties, we'd need to filter them by ID range.
    if (originalTileset.tiles) {
        const minId = i * totalTilesInSplit;
        const maxId = minId + currentTileCount;
        
        newTileset.tiles = originalTileset.tiles
            .filter(t => t.id >= minId && t.id < maxId)
            .map(t => ({
                ...t,
                id: t.id - minId
            }));
    }

    newTilesets.push(newTileset);
}

// Replace the old tileset with the new ones
mapData.tilesets.splice(tilesetIndex, 1, ...newTilesets);

// Save
fs.writeFileSync(mapPath, JSON.stringify(mapData, null, 1));
console.log(`Patched ${mapPath} with ${newTilesets.length} split tilesets.`);
