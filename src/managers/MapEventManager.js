import Phaser from "phaser";

import { QuestRouter } from "../quests/QuestRouter";
import { EtoileDuSoirQuest } from "../quests/EtoileDuSoirQuest";

export class MapEventManager {
    constructor(scene, mapManager) {
        this.scene = scene;
        this.mapManager = mapManager;
        this.activeEvents = [];

        // Progression (PNJ dresseurs battus) pour le joueur courant
        this.defeatedTrainerIds = new Set();

        // Ambient NPC optimization: use a single collider vs player.
        this.ambientGroup = null;
        this.ambientCollider = null;

        // Router de quêtes (1 handler par quête) pour éviter que MapEventManager devienne un fourre-tout
        this.questRouter = new QuestRouter({
            scene: this.scene,
            mapManager: this.mapManager,
            eventManager: this,
            handlers: [new EtoileDuSoirQuest({ scene: this.scene, mapManager: this.mapManager, eventManager: this })]
        });
    }

    ensureAmbientGroup() {
        if (!this.scene?.physics) return;
        if (!this.ambientGroup) {
            this.ambientGroup = this.scene.physics.add.group({
                immovable: true,
                allowGravity: false,
            });
        }

        const player = this.scene.playerManager?.getPlayer();
        if (player && !this.ambientCollider) {
            this.ambientCollider = this.scene.physics.add.collider(player, this.ambientGroup);
        }
    }

    faceNpcToPlayer(npc) {
        // Optional opt-out per event
        if (npc && npc.facePlayerOnInteract === false) return;

        const player = this.scene.playerManager?.getPlayer();
        if (!player || !npc) return;

        const dx = player.x - npc.x;
        const dy = player.y - npc.y;

        // If the NPC uses the player spritesheet, we can set a directional idle frame.
        // Player idle frames (see PlayerManager CONFIG): right 56, up 62, left 68, down 74.
        if (npc.texture?.key === 'player' && typeof npc.setFrame === 'function') {
            let frame = 74; // down
            if (Math.abs(dx) > Math.abs(dy)) {
                frame = dx < 0 ? 68 : 56;
            } else {
                frame = dy < 0 ? 62 : 74;
            }
            npc.setFrame(frame);
            return;
        }

        // Generic fallback: flip horizontally towards the player (works for most NPC sprites).
        if (typeof npc.setFlipX === 'function') {
            npc.setFlipX(dx < 0);
        }
    }

    async loadWorldEvents() {
        const map = this.mapManager.map;
        if (!map) return;

        const eventsLayer = map.getObjectLayer("events");
        if (!eventsLayer) {
            console.warn("Pas de couche 'events' dans la map !");
        }

        const mapKey = map.key;
        let worldEvents = [];
        try {
            const res = await fetch(`${process.env.REACT_APP_API_URL}/api/world-events?mapKey=${mapKey}`);
            worldEvents = await res.json();
        } catch (e) {
            console.error("Erreur lors du chargement des worldEvents :", e);
        }

        // Charger la liste des dresseurs déjà battus (par joueur) pour cette map
        try {
            const playerData = this.scene.registry.get('playerData');
            const playerId = playerData ? playerData._id : null;
            this.defeatedTrainerIds = new Set();

            if (playerId && process.env.REACT_APP_API_URL) {
                const r = await fetch(
                    `${process.env.REACT_APP_API_URL}/api/trainer-npcs/defeated?playerId=${playerId}&mapKey=${mapKey}`
                );
                if (r.ok) {
                    const data = await r.json();
                    const ids = Array.isArray(data?.defeatedTrainerIds) ? data.defeatedTrainerIds : [];
                    this.defeatedTrainerIds = new Set(ids);
                }
            }
        } catch (e) {
            console.warn('[MapEventManager] Impossible de charger trainer-npcs/defeated:', e);
            this.defeatedTrainerIds = new Set();
        }

        // Vérification de sécurité après l'appel asynchrone
        if (!this.mapManager.map || this.mapManager.map.key !== mapKey) return;

        this.clearEvents();

        // Traitement des événements existants depuis la base de données
        if (eventsLayer) {
            eventsLayer.objects.forEach(obj => {
                const eventId = obj.properties?.find(p => p.name === "eventId")?.value;
                const type = obj.type || obj.properties?.find(p => p.name === "type")?.value;
                const x = obj.x, y = obj.y;

                let dynamicEvent = null;
                if (eventId) {
                    dynamicEvent = worldEvents.find(e => e.properties?.chestId === eventId || e.properties?.doorId === eventId);
                } else {
                    dynamicEvent = worldEvents.find(e => e.x === x && e.y === y && e.type === type);
                }
                if (!dynamicEvent) return;

                if (type === "chest") {
                    const chest = this.scene.physics.add.sprite(x + obj.width / 2, y - obj.height / 2, "!Chest", 0);
                    chest.setImmovable(true);
                    chest.eventData = dynamicEvent;
                    chest.setInteractive();
                    this.activeEvents.push(chest);

                    this.addCollisionIfNeeded(obj, chest);

                    if (dynamicEvent.state.opened) {
                        chest.setFrame(3);
                    }
                } else if (type === "npc") {
                    this.createNPC(dynamicEvent, x, y);
                }
            });
        }

        // Spécifique map3 (Oppède)
        if (mapKey === "map3") {
            this.createBoosterVendor();
            this.createRalofNPC();
        }

        // Spécifique metro
        if (mapKey === "metro") {
            this.createSubwayDoor();
        }

        // Spécifique Douai (Quête Etoile du Soir)
        if (mapKey === "douai") {
            this.questRouter.spawnForMap(mapKey);
        }

        // Populate Ambient NPCs
        if (["lille", "douai", "metro", "metroInterieur"].includes(mapKey)) {
            this.populateAmbientNPCs(mapKey);
        }

        // PNJ dresseurs bloquants (scriptés)
        this.spawnTrainerNPCsForMap(mapKey);
    }

    getPlayerIdleFrameForFacing(facing) {
        // Player idle frames (see PlayerManager CONFIG): right 56, up 62, left 68, down 74.
        switch ((facing || '').toLowerCase()) {
            case 'right':
                return 56;
            case 'up':
                return 62;
            case 'left':
                return 68;
            case 'down':
            default:
                return 74;
        }
    }

    applyTrainerNpcState(npc, { defeated, afterWinTile, afterWinFacing, initialFacing }) {
        if (!npc) return;

        if (defeated) {
            npc.trainerDefeated = true;
            if (afterWinTile) {
                npc.setPosition(afterWinTile.x * 48 + 24, afterWinTile.y * 48 + 24 - 24);
            }
            if (npc.texture?.key === 'player' && typeof npc.setFrame === 'function') {
                npc.setFrame(this.getPlayerIdleFrameForFacing(afterWinFacing || 'down'));
            }
        } else {
            npc.trainerDefeated = false;
            if (npc.texture?.key === 'player' && typeof npc.setFrame === 'function') {
                npc.setFrame(this.getPlayerIdleFrameForFacing(initialFacing || 'down'));
            }
        }
    }

    spawnTrainerNPCsForMap(mapKey) {
        if (!this.scene?.physics) return;
        if (!mapKey) return;

        // Pour l'instant: 1 dresseur bloquant dans metroInterieur
        if (mapKey !== 'metroInterieur') return;

        const player = this.scene.playerManager?.getPlayer();
        if (!player) return;

        // ID stable: map + tile coords (important pour la persistance)
        const trainerId = 'metroInterieur:13:7:blocker';

        const npc = this.scene.physics.add.sprite(13 * 48 + 24, 7 * 48 + 24 - 24, 'player', 0);

        // Hitbox pieds (comme les ambient NPC)
        npc.body.setSize(32, 32);
        npc.body.setOffset(8, 64);
        npc.setImmovable(true);
        npc.setInteractive();

        npc.npcType = 'pokemon_trainer';
        npc.trainerId = trainerId;
        npc.trainerName = 'Dresseur';
        npc.trainerDialogue = "Qui t'as dit que le métro de Lille était safe ?";

        // Équipe: Ratata lvl 8 + Roucoul lvl 7 (ids PokéAPI: 19, 16)
        npc.trainerTeam = [
            { speciesId: 19, level: 8 },
            { speciesId: 16, level: 7 }
        ];

        npc.trainerAfterWinTile = { x: 13, y: 8 };
        npc.trainerAfterWinFacing = 'down';
        npc.trainerInitialFacing = 'left';
        npc.facePlayerOnInteract = false; // on conserve sa pose (il "garde" le passage)

        // Collisions -> il bloque le passage
        this.scene.physics.add.collider(player, npc);

        // Appliquer état (déjà battu ?)
        const defeated = this.defeatedTrainerIds?.has(trainerId);
        this.applyTrainerNpcState(npc, {
            defeated,
            afterWinTile: npc.trainerAfterWinTile,
            afterWinFacing: npc.trainerAfterWinFacing,
            initialFacing: npc.trainerInitialFacing
        });

        this.activeEvents.push(npc);
    }

    populateAmbientNPCs(mapKey) {
        const npcListLille = [
            "adam", "alex", "amelia", "ash", "bob", "bouncer", 
            "bruce", "dan", "edward", "fishmonger_1", "kid_abby", "kid_karen"
        ];
        // old_man_josh retiré car géré manuellement pour la quête
        const npcListDouai = [
            "kid_mitty", "kid_oscar", "kid_romeo", "kid_tim", "lucy", "molly", 
            "old_woman_jenny", "pier", "rob", "roki", "samuel"
        ];
        
        let npcsToSpawn = [];
        let startX = 0;
        let startY = 0;

        if (mapKey === "lille") {
            npcsToSpawn = npcListLille;
            startX = 25; startY = 25;
        } else if (mapKey === "douai") {
            npcsToSpawn = npcListDouai;
            startX = 110; startY = 25;
        } else if (mapKey === "metro") {
            npcsToSpawn = [...npcListLille, ...npcListDouai];
            startX = 30; startY = 30;
        } else if (mapKey === "metroInterieur") {
            npcsToSpawn = [...npcListLille, ...npcListDouai];
            startX = 10; startY = 15;
        }

        npcsToSpawn.forEach((npcName, index) => {
            // Simple placement logic: spread them out a bit
            const x = (startX + (index % 5) * 2) * 48 + 24;
            const y = (startY + Math.floor(index / 5) * 2) * 48 + 24;
            
            this.createAmbientNPC(npcName, x, y);
        });
    }

    createAmbientNPC(npcName, x, y) {
        const spriteKey = `npc_${npcName}`;
        if (!this.scene.textures.exists(spriteKey)) return;

        this.ensureAmbientGroup();

        // Ajustement Y pour les sprites de 96px de haut (centrés par défaut)
        // On remonte de 24px pour aligner les pieds
        const npc = this.scene.physics.add.sprite(x, y - 24, spriteKey, 0);
        
        // Configuration de la Hitbox (plus petite, aux pieds)
        // Sprite 48x96. On veut une hitbox de ~32x32 en bas.
        npc.body.setSize(32, 32);
        npc.body.setOffset(8, 64); // Centré horizontalement (48-32)/2 = 8. En bas (96-32) = 64.

        npc.setImmovable(true);
        npc.setInteractive();
        npc.npcType = "ambient";
        npc.npcName = npcName;
        if (this.ambientGroup) {
            this.ambientGroup.add(npc);
        }
        
        // Animation
        const animKey = `${npcName}_idle`;
        if (!this.scene.anims.exists(animKey)) {
            const isMobile = (() => {
                try {
                    const os = this.scene?.sys?.game?.device?.os;
                    return !!(os?.android || os?.iOS);
                } catch (e) {
                    return false;
                }
            })();
            this.scene.anims.create({
                key: animKey,
                frames: this.scene.anims.generateFrameNumbers(spriteKey, { start: 0, end: 3 }), // Assuming 4 frames for idle
                frameRate: isMobile ? 2 : 4,
                repeat: -1,
                yoyo: true
            });
        }
        npc.play(animKey);

        this.activeEvents.push(npc);
    }

    clearEvents() {
        try {
            if (this.ambientCollider) {
                this.ambientCollider.destroy();
                this.ambientCollider = null;
            }
            if (this.ambientGroup) {
                // Children are destroyed via activeEvents cleanup; destroy group only.
                this.ambientGroup.destroy(false);
                this.ambientGroup = null;
            }
        } catch (e) {
            // ignore
        }

        if (this.activeEvents) {
            this.activeEvents.forEach(event => {
                if (event.bubble) event.bubble.destroy();
                event.destroy();
            });
        }
        this.activeEvents = [];
    }

    createSubwayDoor() {
        if (!this.mapManager.map) return;

        const finalX = 26 * 48 + 21; 
        const finalY = 15 * 48 - 10;

        const door = this.scene.physics.add.sprite(finalX, finalY, "subway_door", 0);
        door.setImmovable(true);
        door.setDepth(-1);

        // Animations
        if (!this.scene.anims.exists('subway_door_open')) {
            this.scene.anims.create({
                key: 'subway_door_open',
                frames: this.scene.anims.generateFrameNumbers('subway_door', { start: 0, end: 7 }),
                frameRate: 10,
                repeat: 0
            });
        }
        if (!this.scene.anims.exists('subway_door_close')) {
            this.scene.anims.create({
                key: 'subway_door_close',
                frames: this.scene.anims.generateFrameNumbers('subway_door', { start: 7, end: 0 }),
                frameRate: 10,
                repeat: 0
            });
        }

        // Zone de détection pour l'ouverture
        const detectionZone = this.scene.add.zone(finalX, finalY, 100, 180);
        this.scene.physics.world.enable(detectionZone);
        
        door.isOpen = false;
        
        this.scene.physics.add.overlap(this.scene.playerManager.getPlayer(), detectionZone, () => {
            if (!door.active) return;
            
            if (!door.isOpen) {
                try {
                    door.play('subway_door_open');
                    this.scene.sound.play('metro_open', { volume: 0.5 });
                    door.isOpen = true;
                } catch (e) {
                    console.warn("Failed to play door open animation/sound", e);
                }
            }
            door.lastOverlapTime = this.scene.time.now;
        });

        const updateListener = () => {
            if (!door.active) {
                this.scene.events.off('update', updateListener);
                return;
            }

            if (door.isOpen && this.scene.time.now - door.lastOverlapTime > 200) {
                try {
                    door.play('subway_door_close');
                    this.scene.sound.play('metro_close', { volume: 0.5 });
                    door.isOpen = false;
                } catch (e) {
                    console.warn("Failed to play door close animation/sound", e);
                }
            }
        };
        
        this.scene.events.on('update', updateListener);
        this.activeEvents.push(door);
    }

    createSparklesEvent() {
        const x = 41 * 48 + 24;
        const y = 73 * 48 + 24;

        // Animation sparkles
        if (!this.scene.anims.exists('sparkles_anim')) {
            this.scene.anims.create({
                key: 'sparkles_anim',
                frames: this.scene.anims.generateFrameNumbers('sparkles', { start: 0, end: 3 }),
                frameRate: 8,
                repeat: -1
            });
        }

        const sparkles = this.scene.physics.add.sprite(x, y, "sparkles");
        sparkles.play('sparkles_anim');
        sparkles.setImmovable(true);
        sparkles.setInteractive();
        sparkles.npcType = "sparkles_quest"; 
        
        // Hitbox
        sparkles.body.setSize(32, 32);
        sparkles.body.setOffset(8, 8);

        this.activeEvents.push(sparkles);
    }

    createJoshNPC() {
        const x = 50 * 48 + 24;
        const y = 73 * 48 + 24;
        
        // Sprite 48x96 -> npc_old_man_josh
        const josh = this.scene.physics.add.sprite(x, y - 24, "npc_old_man_josh", 0);
        josh.body.setSize(32, 32);
        josh.body.setOffset(8, 64);
        josh.setImmovable(true);
        josh.setInteractive();
        josh.npcType = "josh_quest";

        const animKey = 'old_man_josh_idle'; // Key used by populateAmbientNPCs logic
        if (!this.scene.anims.exists(animKey)) {
             this.scene.anims.create({
                key: animKey,
                frames: this.scene.anims.generateFrameNumbers('npc_old_man_josh', { start: 0, end: 3 }),
                frameRate: 4,
                repeat: -1,
                yoyo: true
            });
        }
        josh.play(animKey);

        const player = this.scene.playerManager?.getPlayer();
        if (player) {
            this.scene.physics.add.collider(player, josh);
        }
        this.activeEvents.push(josh);
    }

    createQuestChest() {
        const x = 49 * 48 + 24;
        const y = 73 * 48 + 24;

        const chest = this.scene.physics.add.sprite(x, y, "coffre", 0);
        chest.setImmovable(true);
        chest.setInteractive();
        chest.npcType = "quest_chest";
        
        // Hitbox
        chest.body.setSize(32, 32);
        chest.body.setOffset(8, 16);

        // Animation ouverture
        if (!this.scene.anims.exists('coffre_open')) {
            this.scene.anims.create({
                key: 'coffre_open',
                frames: this.scene.anims.generateFrameNumbers('coffre', { start: 0, end: 3 }),
                frameRate: 8,
                repeat: 0
            });
        }

        // État initial selon la quête
        const playerData = this.scene.registry.get("playerData");
        const questId = playerData.quests ? playerData.quests["Etoile du Soir"] : 0;
        
        if (questId >= 3) {
            chest.setFrame(3); // Déjà ouvert
        }

        const player = this.scene.playerManager?.getPlayer();
        if (player) {
            this.scene.physics.add.collider(player, chest);
        }
        this.activeEvents.push(chest);
    }

    createBoosterVendor() {
        if (!this.mapManager.map) return;

        const vendorX = 50 * 48 + 24;
        const vendorY = 7 * 48 + 24;

        const vendor = this.scene.physics.add.sprite(vendorX, vendorY, "marchand", 0);
        
        // Hitbox fix for 48x48 sprite
        vendor.body.setSize(32, 32);
        vendor.body.setOffset(8, 16);

        vendor.setImmovable(true);
        vendor.setInteractive();
        vendor.npcType = "booster_vendor";

        if (!this.scene.anims.exists('marchand_idle')) {
            this.scene.anims.create({
                key: 'marchand_idle',
                frames: this.scene.anims.generateFrameNumbers('marchand', { start: 0, end: 3 }),
                frameRate: 2,
                repeat: -1
            });
        }

        vendor.play('marchand_idle');

        const player = this.scene.playerManager?.getPlayer();
        if (player) {
            this.scene.physics.add.collider(player, vendor);
        }

        this.activeEvents.push(vendor);

        const bubble = this.scene.add.text(vendorX, vendorY - 35, "🛒", {
            font: "24px Arial",
            fill: "#fff",
            stroke: "#000",
            strokeThickness: 2
        }).setOrigin(0.5);

        this.scene.tweens.add({
            targets: bubble,
            y: vendorY - 45,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.scene.tweens.add({
            targets: bubble,
            scale: { from: 1, to: 1.3 },
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Power2'
        });

        vendor.bubble = bubble;
        console.log(`🛒 Marchand de boosters créé à la position (${vendorX}, ${vendorY})`);
    }

    createRalofNPC() {
        if (!this.mapManager.map) return;

        const ralofX = 6 * 48 + 24; 
        const ralofY = 10 * 48 + 24;

        const ralof = this.scene.physics.add.sprite(ralofX, ralofY - 24, "ralof", 0);
        
        // Configuration de la Hitbox (plus petite, aux pieds)
        ralof.body.setSize(32, 32);
        ralof.body.setOffset(8, 64);

        ralof.setImmovable(true);
        ralof.setInteractive();
        ralof.npcType = "ralof";

        if (!this.scene.anims.exists('ralof_idle')) {
            this.scene.anims.create({
                key: 'ralof_idle',
                frames: this.scene.anims.generateFrameNumbers('ralof', { start: 3, end: 3 }),
                frameRate: 4,
                repeat: -1,
                yoyo: true
            });
        }

        ralof.play('ralof_idle');

        const player = this.scene.playerManager?.getPlayer();
        if (player) {
            this.scene.physics.add.collider(player, ralof);
        }

        this.activeEvents.push(ralof);

        const bubble = this.scene.add.text(ralofX, ralofY - 35, "?", {
            font: "24px Arial",
            fill: "#fff",
            stroke: "#000",
            strokeThickness: 2
        }).setOrigin(0.5);

        this.scene.tweens.add({
            targets: bubble,
            y: ralofY - 45,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        ralof.bubble = bubble;
        console.log(`Ralof créé à la position (${ralofX}, ${ralofY})`);
    }

    createNPC(eventData, x, y) {
        // Ajustement pour sprite 48x96 (Marin/Player)
        const npc = this.scene.physics.add.sprite(x + 24, y, "player", 0);
        
        // Hitbox fix
        npc.body.setSize(32, 32);
        npc.body.setOffset(8, 64);

        npc.setImmovable(true);
        npc.eventData = eventData;
        npc.setInteractive();
        npc.npcType = "dialogue";
        this.activeEvents.push(npc);

        this.addCollisionIfNeeded({ properties: [{ name: "Collision", value: true }] }, npc);
    }

    handleNPCInteraction(npc) {
        const playerData = this.scene.registry.get("playerData");
        const playerId = playerData ? playerData._id : null;

        // Make the NPC face the player before any dialogue/quest handling.
        this.faceNpcToPlayer(npc);

        // Quêtes : si un handler s'en occupe, on stop ici.
        if (this.questRouter && this.questRouter.handleNPCInteraction(npc)) {
            return;
        }

        if (npc.npcType === "ralof") {
            const answer = window.prompt("What's my Name ?");
            if (answer && answer.toLowerCase() === "ralof") {
                this.mapManager.changeMap("qwest", 13 * 48 + 24, 5 * 48 + 24);
            }
        } else if (npc.npcType === "booster_vendor") {
            this.scene.displayMessage("Salut l'ami ! Tu veux des boosters de cartes ?\n J'ai ce qu'il te faut !", "Marchand");
            setTimeout(() => {
                if (this.scene.shopManager) {
                    this.scene.shopManager.openShop();
                }
            }, 1500);
        } else if (npc.npcType === "ambient") {
            const dialogues = [
                "Belle journée, n'est-ce pas ?",
                "Je suis juste là pour le décor.",
                "As-tu vu mon chat ?",
                "Il paraît qu'il y a des trésors cachés.",
                "J'attends le métro...",
                "La vie est belle à Oppède.",
                "Bonjour !",
                "..."
            ];
            const randomDialogue = dialogues[Math.floor(Math.random() * dialogues.length)];
            this.scene.displayMessage(randomDialogue, npc.npcName || "Habitant");
        } else if (npc.npcType === 'pokemon_trainer') {
            // Déjà battu -> il s'est écarté, pas de combat
            if (npc.trainerDefeated) {
                return;
            }

            if (!playerId) {
                this.scene.displayMessage('Impossible de lancer le combat (joueur non chargé).', 'Erreur');
                return;
            }

            // Dialogue d'intro
            this.scene.displayMessage(npc.trainerDialogue || '...');

            // Lancer le combat après un court délai
            setTimeout(() => {
                // sécurité si la scène a changé entre-temps
                if (!this.scene?.scene) return;

                this.scene.scene.start('PokemonBattleScene', {
                    playerId,
                    battleType: 'trainer',
                    returnScene: 'GameScene',
                    trainerBattle: {
                        trainerId: npc.trainerId,
                        mapKey: this.mapManager?.map?.key || null,
                        name: npc.trainerName || null,
                        team: npc.trainerTeam || []
                    }
                });
            }, 1200);
        } else if (npc.npcType === "dialogue" && npc.eventData) {
            const dialogue = npc.eventData.properties?.dialogue || "Bonjour !";
            this.scene.displayMessage(dialogue, npc.eventData.properties?.speaker || "PNJ");

            if (!npc.eventData.state.hasSpoken) {
                fetch(`${process.env.REACT_APP_API_URL}/api/world-events/${npc.eventData._id}/state`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ hasSpoken: true })
                });
                npc.eventData.state.hasSpoken = true;
            }
        }
    }

    handleChestInteraction(chest) {
        const playerPseudo = this.scene.registry.get("playerPseudo") || "Moi";
        const { eventData } = chest;
        if (eventData.state.opened) {
            this.scene.displayMessage("Ce coffre est déjà ouvert !", playerPseudo);
            return;
        }

        chest.anims.play('chest-open');
        chest.once('animationcomplete', () => {
            chest.setFrame(4);
        });

        this.scene.displayMessage(`Vous trouvez : ${eventData.properties.loot}`, playerPseudo);

        fetch(`${process.env.REACT_APP_API_URL}/api/world-events/${eventData._id}/state`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ opened: true })
        });

        this.scene.addItemToInventory({ nom: eventData.properties.loot, quantite: 1 });
        eventData.state.opened = true;
        
        try {
            if (this.scene && this.scene.sound) {
                this.scene.sound.play('item_get', { volume: 0.85 });
            }
        } catch (e) { /* ignore */ }
    }

    addCollisionIfNeeded(obj, sprite) {
        const hasCollision = obj.properties?.find(p => p.name === "Collision" && p.value === true);
        const player = this.scene.playerManager?.getPlayer();
        if (hasCollision && player) {
            this.scene.physics.add.collider(player, sprite);
        }
    }

    getNearbyEventObject(playerX, playerY) {
        if (!this.activeEvents) return null;
        const threshold = 48;
        return this.activeEvents.find(obj =>
            Phaser.Math.Distance.Between(playerX, playerY, obj.x, obj.y) < threshold
        );
    }
}