import ResponsiveManager from './ResponsiveManager.js';
export class ShopManager {
    constructor(scene) {
        this.scene = scene;
        this.isShopOpen = false;
        this.shopItems = [];
        this.shopElements = [];
    }

    async loadShopItems() {
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/items?type=booster`);
            if (!response.ok) {
                throw new Error('Erreur lors du chargement des boosters');
            }
            const boosters = await response.json();
            this.shopItems = boosters.filter(item => item.type === 'booster');
            console.log('🛒 Boosters chargés pour la boutique:', this.shopItems);
            console.log('🛒 Nombre de boosters:', this.shopItems.length);
        } catch (error) {
            console.error('❌ Erreur lors du chargement des boosters:', error);
            this.shopItems = [];
        }
    }

    loadBoosterTextures() {
        console.log('🎨 Chargement des textures de boosters...');

        // Mapping des images de boosters
        const boosterImages = {
            'boosterPack.png': '/assets/items/boosterPack.png',
            'boosterArgent.png': '/assets/items/boosterArgent.png',
            'boosterOr.png': '/assets/items/boosterOr.png',
            'boosterP.png': '/assets/items/boosterP.png'
        };

        // Charger chaque texture de booster
        Object.entries(boosterImages).forEach(([filename, path]) => {
            const textureKey = filename.replace('.png', '');

            // Vérifier si la texture n'est pas déjà chargée
            if (!this.scene.textures.exists(textureKey)) {
                console.log(`📥 Chargement texture: ${textureKey} depuis ${path}`);
                this.scene.load.image(textureKey, path);
            } else {
                console.log(`✅ Texture déjà chargée: ${textureKey}`);
            }
        });

        // Charger aussi les textures spécifiques aux boosters trouvés
        this.shopItems.forEach(booster => {
            if (booster.image) {
                const textureKey = booster.image.replace('.png', '');
                const imagePath = `/assets/items/${booster.image}`;

                if (!this.scene.textures.exists(textureKey)) {
                    console.log(`📥 Chargement texture booster: ${textureKey} depuis ${imagePath}`);
                    this.scene.load.image(textureKey, imagePath);
                }
            }
        });

        // Démarrer le chargement si nécessaire
        if (this.scene.load.totalToLoad > 0) {
            console.log(`🔄 Démarrage du chargement de ${this.scene.load.totalToLoad} textures...`);

            return new Promise((resolve) => {
                this.scene.load.once('complete', () => {
                    console.log('✅ Toutes les textures de boosters sont chargées');
                    this.texturesLoaded = true;
                    resolve();
                });
                this.scene.load.start();
            });
        } else {
            console.log('✅ Aucune texture à charger');
            this.texturesLoaded = true;
            return Promise.resolve();
        }
    }

    async openShop() {
        if (this.isShopOpen) return;

        console.log('🛒 Ouverture de la boutique...');
        await this.loadShopItems();
        this.responsive = ResponsiveManager.initialize(this.scene);
        await this.loadBoosterTextures();
        this.isShopOpen = true;
        this.createShopUI();
    }

    createShopUI() {
        const { width, height } = this.scene.scale;
        this.shopElements = [];

        console.log('🛒 Création de l\'UI de la boutique...');
        console.log('🛒 Dimensions:', width, height);
        console.log('🛒 Nombre d\'items à afficher:', this.shopItems.length);

        // Désactiver temporairement les autres inputs
        this.disableGameInputs();

        // ✅ SUPPRIMÉ - Plus de fond noir

        // Panneau principal plus petit
        const panel = this.scene.add.rectangle(width / 2, height / 2, width * 0.8, height * 0.7, 0x2c3e50, 0.9);
        panel.setStrokeStyle(4, 0xffffff);
        panel.setDepth(2001);
        panel.setScrollFactor(0);
        this.shopElements.push(panel);

        // Titre
        const title = this.scene.add.text(width / 2, height * 0.2, "🛒 Boutique de Boosters", {
            font: "28px Arial",
            fill: "#fff",
            fontStyle: "bold"
        });
        title.setOrigin(0.5);
        title.setDepth(2002);
        title.setScrollFactor(0);
        this.shopElements.push(title);

        // Argent du joueur
        const playerData = this.scene.registry.get("playerData");
        const playerMoney = playerData?.totalScore || 0;

        const moneyText = this.scene.add.text(width * 0.8, height * 0.25, `💰 ${playerMoney} pièces`, {
            font: "20px Arial",
            fill: "#FFD700",
            fontStyle: "bold"
        });
        moneyText.setOrigin(1, 0.5);
        moneyText.setDepth(2002);
        moneyText.setScrollFactor(0);
        this.shopElements.push(moneyText);

        // Bouton fermer
        this.createCloseButton(width, height);

        // ✅ CONDITION - Vérifier qu'on a des items avant de créer la liste
        if (this.shopItems.length > 0) {
            console.log('🛒 Création de la liste des boosters...');
            this.createBoosterList(width, height, playerMoney);
        } else {
            // Message si aucun booster
            const noItemsText = this.scene.add.text(width / 2, height / 2, "Aucun booster disponible", {
                font: "24px Arial",
                fill: "#fff"
            });
            noItemsText.setOrigin(0.5);
            noItemsText.setDepth(2002);
            noItemsText.setScrollFactor(0);
            this.shopElements.push(noItemsText);
        }
    }

    createCloseButton(width, height) {
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '❌';
        closeButton.style.position = 'fixed';
        closeButton.style.top = '15%';
        closeButton.style.right = '12%';
        closeButton.style.zIndex = '10000';
        closeButton.style.background = '#ffffff';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '50%';
        closeButton.style.width = '40px';
        closeButton.style.height = '40px';
        closeButton.style.fontSize = '20px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';

        closeButton.onclick = () => this.closeShop();

        document.body.appendChild(closeButton);
        this.closeButtonDOM = closeButton;
    }

    createBoosterList(width, height, playerMoney) {
        const startY = height * 0.35;
        const itemHeight = 80; // ✅ RÉDUIT - Taille des containers plus petite
        const spacing = 15; // ✅ RÉDUIT - Espacement plus petit

        console.log('🛒 Création de la liste avec startY:', startY);

        this.shopItems.forEach((booster, index) => {
            console.log(`🛒 Création booster ${index}:`, booster.nom);
            const y = startY + index * (itemHeight + spacing);
            console.log(`🛒 Position Y pour booster ${index}:`, y);

            this.createBoosterRow(booster, width / 2, y, width * 0.7, itemHeight, playerMoney, index); // ✅ RÉDUIT - Largeur plus petite
        });
    }

    createBoosterRow(booster, x, y, itemWidth, itemHeight, playerMoney, index) {
        const canAfford = playerMoney >= booster.prix;

        console.log(`🛒 Création ligne booster ${index}:`, {
            nom: booster.nom,
            x, y,
            itemWidth, itemHeight,
            canAfford,
            prix: booster.prix,
            playerMoney
        });

        // ✅ FOND PLUS PETIT ET PLUS TRANSPARENT
        const itemBg = this.scene.add.rectangle(x, y, itemWidth, itemHeight, canAfford ? 0x34495e : 0x7f8c8d, 0.8);
        itemBg.setStrokeStyle(2, canAfford ? 0x3498db : 0x95a5a6);
        itemBg.setDepth(2001);
        itemBg.setScrollFactor(0);
        this.shopElements.push(itemBg);

        // ✅ IMAGE DU BOOSTER - Plus petite
        let boosterImageKey = 'boosterPack';
        if (booster.image) {
            const imageMapping = {
                'boosterPack.png': 'boosterPack',
                'boosterArgent.png': 'boosterArgent',
                'boosterOr.png': 'boosterOr',
                'boosterP.png': 'boosterP'
            };
            boosterImageKey = imageMapping[booster.image] || 'boosterPack';
        }

        console.log(`🛒 Image booster ${index}:`, boosterImageKey);

        // ✅ VÉRIFIER QUE LA TEXTURE EXISTE
        if (this.scene.textures.exists(boosterImageKey)) {
            const boosterImage = this.scene.add.image(x - itemWidth * 0.35, y, boosterImageKey);
            boosterImage.setScale(0.15); // ✅ RÉDUIT - Image plus petite
            boosterImage.setTint(canAfford ? 0xffffff : 0x888888);
            boosterImage.setDepth(2002);
            boosterImage.setScrollFactor(0);
            this.shopElements.push(boosterImage);
            console.log(`✅ Image ${boosterImageKey} créée`);
        } else {
            console.warn(`❌ Texture ${boosterImageKey} n'existe pas`);
            // ✅ FALLBACK - Rectangle coloré plus petit
            const fallbackRect = this.scene.add.rectangle(x - itemWidth * 0.35, y, 45, 60, 0xff6b35, 1);
            fallbackRect.setDepth(2002);
            fallbackRect.setScrollFactor(0);
            this.shopElements.push(fallbackRect);
        }

        // ✅ TEXTES - Taille réduite
        const textStartX = x - itemWidth * 0.15;

        const nameText = this.scene.add.text(textStartX, y - 20, booster.nom, {
            font: "16px Arial", // ✅ RÉDUIT
            fill: canAfford ? "#fff" : "#aaa",
            fontStyle: "bold"
        });
        nameText.setOrigin(0, 0.5);
        nameText.setDepth(2002);
        nameText.setScrollFactor(0);
        this.shopElements.push(nameText);
        /*
        const descText = this.scene.add.text(textStartX, y, booster.description || `${booster.cardCount} cartes`, {
            font: "13px Arial", // ✅ RÉDUIT
            fill: canAfford ? "#bbb" : "#888"
        });
        descText.setOrigin(0, 0.5);
        descText.setDepth(2002);
        descText.setScrollFactor(0);
        this.shopElements.push(descText);*/

        const priceText = this.scene.add.text(textStartX, y + 20, `💰 ${booster.prix} pièces`, {
            font: "15px Arial", // ✅ RÉDUIT
            fill: canAfford ? "#FFD700" : "#ff6b6b",
            fontStyle: "bold"
        });
        priceText.setOrigin(0, 0.5);
        priceText.setDepth(2002);
        priceText.setScrollFactor(0);
        this.shopElements.push(priceText);

        // ✅ BOUTON UNIQUEMENT SI LE JOUEUR PEUT ACHETER
        if (canAfford) {
            this.createBuyButtonDOM(booster, x + itemWidth * 0.32, y);
        }

        console.log(`✅ Booster ${index} créé avec succès`);
    }

    createBuyButtonDOM(booster, x, y) {
        const canvas = this.scene.game.canvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.offsetWidth / canvas.width;
        const scaleY = canvas.offsetHeight / canvas.height;

        const domX = rect.left + (x * scaleX);
        const domY = rect.top + (y * scaleY);

        const buyButton = document.createElement('button');
        buyButton.innerHTML = '💰'; // ✅ CHANGÉ - Symbole d'argent uniquement
        buyButton.style.position = 'fixed';
        buyButton.style.left = `${domX - 25}px`; // ✅ AJUSTÉ - Centrage pour bouton plus petit
        buyButton.style.top = `${domY - 20}px`;
        buyButton.style.zIndex = '10000';
        buyButton.style.background = '#27ae60';
        buyButton.style.color = 'white';
        buyButton.style.border = 'none';
        buyButton.style.borderRadius = '50%'; // ✅ CHANGÉ - Bouton rond
        buyButton.style.width = '50px'; // ✅ RÉDUIT - Bouton plus petit
        buyButton.style.height = '50px';
        buyButton.style.fontSize = '20px'; // ✅ AJUSTÉ - Symbole bien visible
        buyButton.style.cursor = 'pointer';
        buyButton.style.fontWeight = 'bold';
        buyButton.style.display = 'flex';
        buyButton.style.alignItems = 'center';
        buyButton.style.justifyContent = 'center';
        buyButton.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';

        buyButton.onmouseover = () => {
            buyButton.style.background = '#2ecc71';
            buyButton.style.transform = 'scale(1.1)';
        };
        buyButton.onmouseout = () => {
            buyButton.style.background = '#27ae60';
            buyButton.style.transform = 'scale(1)';
        };
        buyButton.onclick = () => this.buyBooster(booster);

        document.body.appendChild(buyButton);

        if (!this.buyButtonsDOM) this.buyButtonsDOM = [];
        this.buyButtonsDOM.push(buyButton);
    }

    // ✅ SUPPRIMÉ - Plus de bouton désactivé visible

    disableGameInputs() {
        if (this.scene.input) {
            this.scene.input.enabled = false;
        }

        this.savedInputState = {
            uiManagerEnabled: this.scene.uiManager ? true : false
        };
    }

    enableGameInputs() {
        if (this.scene.input) {
            this.scene.input.enabled = true;
        }
    }

    async buyBooster(booster) {
        try {
            const playerData = this.scene.registry.get("playerData");
            const playerPseudo = this.scene.registry.get("playerPseudo");

            if (!playerData || !playerPseudo) {
                alert("Erreur: Données joueur manquantes");
                return;
            }

            if (playerData.totalScore < booster.prix) {
                alert("Pas assez d'argent !");
                return;
            }

            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/shop/buy-booster`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId: playerData._id,
                    boosterId: booster._id,
                    price: booster.prix
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Erreur lors de l\'achat');
            }

            playerData.totalScore -= booster.prix;
            this.scene.registry.set("playerData", playerData);

            alert(`${booster.nom} acheté avec succès !\nNouveau solde: ${playerData.totalScore} pièces`);

            this.closeShop();

        } catch (error) {
            console.error('Erreur lors de l\'achat:', error);
            alert(`Erreur: ${error.message}`);
        }
    }

    closeShop() {
        if (!this.isShopOpen) return;

        console.log('🛒 Fermeture de la boutique...');

        // Nettoyage DOM
        if (this.closeButtonDOM) {
            document.body.removeChild(this.closeButtonDOM);
            this.closeButtonDOM = null;
        }

        if (this.buyButtonsDOM) {
            this.buyButtonsDOM.forEach(btn => {
                try {
                    document.body.removeChild(btn);
                } catch (e) {
                    console.warn('Bouton déjà supprimé');
                }
            });
            this.buyButtonsDOM = [];
        }

        // Nettoyage Phaser
        this.shopElements.forEach(element => {
            try {
                if (element && element.destroy) {
                    element.destroy();
                }
            } catch (error) {
                console.warn('Erreur lors de la destruction:', error);
            }
        });
        this.shopElements = [];

        this.enableGameInputs();
        this.isShopOpen = false;
    }

    destroy() {
        this.closeShop();
    }
}