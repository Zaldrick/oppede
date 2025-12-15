export class MapPhysicsManager {
    constructor(scene, mapManager) {
        this.scene = scene;
        this.mapManager = mapManager;
        this.customColliders = null;
    }

    createCustomCollisions() {
        const map = this.mapManager.map;
        if (!map || !map.objects) return;

        if (!this.customColliders) {
            this.customColliders = this.scene.physics.add.staticGroup();
        }

        map.objects.forEach(layerData => {
            // Simplification: On cherche uniquement les calques contenant "collision" dans le nom
            if (layerData.name.toLowerCase().includes('collision')) {
                console.log(`[MapPhysicsManager] Processing collision layer: ${layerData.name}`);

                layerData.objects.forEach(obj => {
                    // Ignore Tile Objects (gid) - handled by createObjectLayers
                    if (obj.gid) return;

                    
                    // Tiled Rectangle: x, y (top-left)
                    // Phaser Rectangle/Body: x, y (center)
                    const width = obj.width;
                    const height = obj.height;
                    const centerX = obj.x + (width / 2);
                    const centerY = obj.y + (height / 2);
                    
                    // Create an invisible rectangle
                    const rect = this.scene.add.rectangle(centerX, centerY, width, height);
                    rect.setVisible(false);
                    
                    // Add physics (static)
                    this.scene.physics.add.existing(rect, true);
                    
                    this.customColliders.add(rect);
                    
                    console.log(`[MapPhysicsManager] Added collision rect at ${centerX},${centerY} (${width}x${height})`);
                });
            }
        });
    }

    clear() {
        if (this.customColliders) {
            this.customColliders.clear(true, true);
        }
    }

    getColliders() {
        return this.customColliders;
    }
}