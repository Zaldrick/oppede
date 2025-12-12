const fs = require('fs');
const path = require('path');

const mapPath = path.join(__dirname, '../public/assets/maps/qwest.tmj');
const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

console.log("Layers found:");
mapData.layers.forEach((layer, index) => {
    console.log(`[${index}] Name: "${layer.name}", Type: "${layer.type}", Visible: ${layer.visible}`);
    if (layer.type === 'objectgroup') {
        console.log(`   Objects count: ${layer.objects.length}`);
        if (layer.objects.length > 0) {
            console.log(`   Sample object GID: ${layer.objects[0].gid}`);
        }
    }
});
