/**
 * Charge toutes les images d'items passées en paramètre.
 * @param {Phaser.Scene} scene - La scène Phaser courante (this).
 * @param {Array} items - Tableau d'objets item ({ image: "ifrit.png" } ou { image }).
 * @param {string} [basePath="/assets/items/"] - Chemin de base des images.
 */
export function loadCardImages(scene, items, basePath = "/assets/items/") {
    if (!Array.isArray(items)) return;
    items.forEach(item => {
        if (!item.image) return;
        const key = `item_${item.image}`;
        const path = `${basePath}${item.image}`;
        if (!scene.textures.exists(key)) {
            scene.load.image(key, path);
        }
    });
}