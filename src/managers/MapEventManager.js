import Phaser from "phaser";

import { QuestRouter } from "../quests/QuestRouter";
import { EtoileDuSoirQuest } from "../quests/EtoileDuSoirQuest";
import { BesoinDunTicketQuest } from "../quests/BesoinDunTicketQuest";
import { RentrerALaMaisonQuest } from "../quests/RentrerALaMaisonQuest";
import { SePreparerQuest } from "../quests/SePreparerQuest";
import { QwestEvents } from "../quests/QwestEvents";
import { LeMessageManquantQuest } from "../quests/LeMessageManquantQuest";
import { LushMaisPasTropQuest } from "../quests/LushMaisPasTropQuest";
import { AHauteurDeBetteuQuest } from "../quests/AHauteurDeBetteuQuest";

export class MapEventManager {
    constructor(scene, mapManager) {
        this.scene = scene;
        this.mapManager = mapManager;
        this.activeEvents = [];

        // Progression (PNJ dresseurs battus) pour le joueur courant
        this.defeatedTrainerIds = new Set();

        // Définitions de dresseurs chargées depuis la BDD pour la map courante
        this.trainerNpcDefinitions = [];

        // Ambient NPC optimization: use a single collider vs player.
        this.ambientGroup = null;
        this.ambientCollider = null;

        // Router de quêtes (1 handler par quête) pour éviter que MapEventManager devienne un fourre-tout
        this.questRouter = new QuestRouter({
            scene: this.scene,
            mapManager: this.mapManager,
            eventManager: this,
            handlers: [
                new EtoileDuSoirQuest({ scene: this.scene, mapManager: this.mapManager, eventManager: this }),
                new BesoinDunTicketQuest({ scene: this.scene, mapManager: this.mapManager, eventManager: this }),
                new RentrerALaMaisonQuest({ scene: this.scene, mapManager: this.mapManager, eventManager: this }),
                new SePreparerQuest({ scene: this.scene, mapManager: this.mapManager, eventManager: this }),
                new QwestEvents({ scene: this.scene, mapManager: this.mapManager, eventManager: this }),
                new LeMessageManquantQuest({ scene: this.scene, mapManager: this.mapManager, eventManager: this }),
                new LushMaisPasTropQuest({ scene: this.scene, mapManager: this.mapManager, eventManager: this }),
                new AHauteurDeBetteuQuest({ scene: this.scene, mapManager: this.mapManager, eventManager: this })
            ]
        });
    }

    getApiBaseUrl() {
        const envUrl = process.env.REACT_APP_API_URL;
        if (envUrl && envUrl !== 'undefined' && envUrl !== 'null') {
            return String(envUrl).replace(/\/$/, '');
        }

        // Safe fallback: same-origin API (useful in prod deployments behind one domain).
        try {
            const origin = typeof window !== 'undefined' && window.location && window.location.origin
                ? window.location.origin
                : null;
            return origin ? String(origin).replace(/\/$/, '') : null;
        } catch (e) {
            return null;
        }
    }

    update() {
        try {
            if (this.questRouter && typeof this.questRouter.update === 'function') {
                this.questRouter.update();
            }
        } catch (e) {
            // ignore
        }
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

    getAmbientDialoguePool(mapKey, npcName) {
        const key = (mapKey || '').toLowerCase();
        const name = (npcName || '').toLowerCase();

        const isKid = name.startsWith('kid_') || name.includes('kid');
        const isFishmonger = name.includes('fishmonger');

        const pools = {
            lille: {
                general: [
                    "T'as vu le métro ? Ici c'est plus calme.",
                    "À Lille, on marche vite, mais on reste polis.",
                    "Le vent du Nord, ça réveille.",
                    "Je te jure, y'a toujours un truc qui se passe sur la Grand'Place.",
                    "Fais gaffe aux toits, il pleut sans prévenir.",
                    "Si tu cherches un raccourci, c'est rarement une bonne idée."
                ],
                kid: [
                    "Je fais la course jusqu'au prochain lampadaire !",
                    "J'ai perdu un caillou super précieux...",
                    "Chut, je joue à cache-cache.",
                    "Je connais un endroit secret à Lille."
                ],
                fish: [
                    "Poisson du jour ! Enfin... pas ici.",
                    "Ça sent la mer... ou c'est mon imagination ?",
                    "Un bon plat chaud et ça repart."
                ]
            },
            metro: {
                general: [
                    "Le métro, c'est un monde à part.",
                    "J'attends depuis dix minutes...",
                    "On dirait qu'il manque toujours un ticket quelque part.",
                    "Si ça bippe pas, c'est que c'est pas bon.",
                    "Fais pas attention, je surveille juste les gens."
                ],
                kid: [
                    "J'aime bien les rames, ça fait du bruit !",
                    "Je veux m'asseoir côté fenêtre.",
                    "On arrive bientôt ?"
                ],
                fish: [
                    "Ici, y'a pas de poisson... triste.",
                    "J'ai faim, j'aurais dû prendre un sandwich."
                ]
            },
            metrointerieur: {
                general: [
                    "On respire pas pareil sous terre.",
                    "T'entends ? Ça gronde...",
                    "Fais attention où tu mets les pieds.",
                    "C'est plus sombre ici, hein ?",
                    "Je reste là. Je bouge pas."
                ],
                kid: [
                    "J'aime pas quand ça fait écho...",
                    "J'ai froid.",
                    "On peut remonter ?"
                ],
                fish: [
                    "Ça sent pas la mer, ici.",
                    "Même le poisson aurait peur ici."
                ]
            },
            douai: {
                general: [
                    "À Douai, on prend le temps.",
                    "Les rues ici, je les connais par cœur.",
                    "T'as entendu parler de l'étoile du soir ?",
                    "Le coin est tranquille, mais pas trop."
                ],
                kid: [
                    "Je joue près de la place.",
                    "Tu connais un jeu avec des cartes ?",
                    "J'ai vu un truc briller !"
                ],
                fish: [
                    "Le marché, c'est la vie.",
                    "Ça me manque de crier mes prix."
                ]
            }
        };

        const selected = pools[key] || {
            general: [
                "Bonjour !",
                "...",
                "Belle journée, n'est-ce pas ?",
                "Il paraît qu'il y a des trésors cachés."
            ],
            kid: ["Salut !"],
            fish: ["..."],
        };

        if (isFishmonger) return selected.fish;
        if (isKid) return selected.kid;
        return selected.general;
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

        // npc_* spritesheets: use facing frames/idle anim
        if (typeof npc.texture?.key === 'string' && npc.texture.key.startsWith('npc_')) {
            const facing = (() => {
                if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
                return dy < 0 ? 'up' : 'down';
            })();
            this.setNpcFacing(npc, facing);
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
            const apiBase = this.getApiBaseUrl();
            if (apiBase) {
                const res = await fetch(`${apiBase}/api/world-events?mapKey=${mapKey}`);
                worldEvents = await res.json();
            }
        } catch (e) {
            console.error("Erreur lors du chargement des worldEvents :", e);
        }

        // Charger la liste des dresseurs déjà battus (par joueur) pour cette map
        try {
            const playerData = this.scene.registry.get('playerData');
            const playerId = playerData ? playerData._id : null;
            this.defeatedTrainerIds = new Set();

            const apiBase = this.getApiBaseUrl();
            if (playerId && apiBase) {
                const r = await fetch(
                    `${apiBase}/api/trainer-npcs/defeated?playerId=${playerId}&mapKey=${mapKey}`
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

        // 🆕 Pokécenters (soin équipe + mémorisation dernier lieu de soin)
        if (mapKey === 'marin') {
            this.createPokeCenterZone({
                id: 'pokecenter_marin_37_8',
                mapKey: 'marin',
                tileX: 37,
                tileY: 8
            });
        }
        if (mapKey === 'metro') {
            this.createPokeCenterZone({
                id: 'pokecenter_metro_17_21',
                mapKey: 'metro',
                tileX: 17.5,
                tileY: 21
            });
        }
        if (mapKey === 'qwest') {
            this.createPokeCenterZone({
                id: 'pokecenter_metro_3_2',
                mapKey: 'qwest',
                tileX: 3,
                tileY: 2
            });
        }

        // 🆕 Coffres statiques (coffre.png) -> 2 potions
        if (mapKey === 'metro') {
            this.createStaticChest({ id: 'chest_metro_9_15', mapKey: 'metro', tileX: 9, tileY: 15, lootName: 'Potion', lootQty: 2 });
        }
        if (mapKey === 'lille') {
            this.createStaticChest({ id: 'chest_lille_30_32', mapKey: 'lille', tileX: 30, tileY: 32, lootName: 'Potion', lootQty: 2 });
        }
        if (mapKey === 'douai') {
            this.createStaticChest({ id: 'chest_douai_29_39', mapKey: 'douai', tileX: 29, tileY: 39, lootName: 'Potion', lootQty: 2 });
        }

        // 🆕 Événement type Poké Ball (1 fois) : donne Gaara et disparaît définitivement
        // Si besoin de déplacer l'event sur une autre map, changez le mapKey ici.
        if (mapKey === 'lille') {
            this.createGaaraPokeballPickup({ id: 'pickup_gaara_18_63', tileX: 18, tileY: 63});
        }
        if (mapKey === 'metroInterieur') {
            this.createFlokiPokeballPickup({ id: 'pickup_floki_42_7', tileX: 42, tileY: 7});
        }
        if (mapKey === 'marin') {
            this.createTanukiPokeballPickup({ id: 'pickup_tanuki_1_2', tileX: 1, tileY: 2 });
        }

        // Quêtes (spawn/cleanup) pour la map courante
        if (this.questRouter) {
            this.questRouter.spawnForMap(mapKey);
        }

        // Populate Ambient NPCs
        if (["lille", "douai", "metro", "metroInterieur"].includes(mapKey)) {
            this.populateAmbientNPCs(mapKey);
        }

        // PNJ dresseurs (chargés depuis BDD)
        await this.spawnTrainerNPCsForMap(mapKey);
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

    getNpcIdleRangeForFacing(facing, textureKey) {
        const safeFacing = ['down', 'left', 'right', 'up'].includes((facing || '').toLowerCase())
            ? (facing || '').toLowerCase()
            : 'down';

        const texture = textureKey ? this.scene?.textures?.get(textureKey) : null;
        const frameTotal = texture ? texture.frameTotal : 0;

        // Spritesheet layout (1 row): 6 frames per direction
        // order: right (0-5), up (6-11), left (12-17), down (18-23)
        const rangesByFacing6 = {
            right: { start: 0, end: 5 },
            up: { start: 6, end: 11 },
            left: { start: 12, end: 17 },
            down: { start: 18, end: 23 }
        };

        if (frameTotal >= 24) {
            return rangesByFacing6[safeFacing];
        }

        // Fallback for older 4-frame sheets
        return { start: 0, end: Math.max(0, Math.min(3, frameTotal - 1)) };
    }

    ensureNpcIdleAnimation(textureKey, facing) {
        if (!textureKey) return null;
        const safeFacing = ['down', 'left', 'right', 'up'].includes((facing || '').toLowerCase())
            ? (facing || '').toLowerCase()
            : 'down';

        const animKey = `${textureKey}_idle_${safeFacing}`;
        if (this.scene.anims.exists(animKey)) return animKey;

        const range = this.getNpcIdleRangeForFacing(safeFacing, textureKey);
        const isMobile = (() => {
            try {
                const os = this.scene?.sys?.game?.device?.os;
                return !!(os?.android || os?.iOS);
            } catch (e) {
                return false;
            }
        })();

        try {
            this.scene.anims.create({
                key: animKey,
                frames: this.scene.anims.generateFrameNumbers(textureKey, { start: range.start, end: range.end }),
                frameRate: isMobile ? 3 : 6,
                repeat: -1,
                yoyo: true
            });
            return animKey;
        } catch (e) {
            return null;
        }
    }

    setNpcFacing(npc, facing) {
        if (!npc || typeof npc.setFrame !== 'function') return;

        const textureKey = npc.texture?.key;
        if (!textureKey) return;

        // Player spritesheet uses fixed idle frames.
        if (textureKey === 'player') {
            npc.setFrame(this.getPlayerIdleFrameForFacing(facing || 'down'));
            return;
        }

        // npc_* sheets: apply direction by frame range start + play idle animation
        if (typeof textureKey === 'string' && textureKey.startsWith('npc_')) {
            const range = this.getNpcIdleRangeForFacing(facing || 'down', textureKey);
            try {
                npc.setFrame(range.start);
            } catch (e) {
                // ignore
            }

            const animKey = this.ensureNpcIdleAnimation(textureKey, facing || 'down');
            if (animKey) {
                try {
                    npc.play(animKey);
                } catch (e) {
                    // ignore
                }
            }
            return;
        }

        // Generic fallback: flip for left/right
        if (typeof npc.setFlipX === 'function') {
            const f = (facing || '').toLowerCase();
            if (f === 'left') npc.setFlipX(true);
            if (f === 'right') npc.setFlipX(false);
        }
    }

    applyTrainerNpcState(npc, { defeated, afterWinTile, afterWinFacing, initialFacing }) {
        if (!npc) return;

        if (defeated) {
            npc.trainerDefeated = true;

            if (npc.trainerHideOnDefeat) {
                try {
                    npc.setVisible(false);
                    npc.setActive(false);
                    if (npc.body) npc.body.enable = false;
                    if (typeof npc.disableInteractive === 'function') npc.disableInteractive();
                } catch (e) {
                    // ignore
                }
                return;
            }

            if (afterWinTile) {
                npc.setPosition(afterWinTile.x * 48 + 24, afterWinTile.y * 48 + 24 - 24);
            }
            this.setNpcFacing(npc, afterWinFacing || 'down');
        } else {
            npc.trainerDefeated = false;
            if (npc.trainerHideOnDefeat) {
                try {
                    npc.setVisible(true);
                    npc.setActive(true);
                    if (npc.body) npc.body.enable = true;
                    // Leave interactive state as-is; spawn code sets it.
                } catch (e) {
                    // ignore
                }
            }
            this.setNpcFacing(npc, initialFacing || 'down');
        }
    }

    /**
     * Marque un dresseur comme battu dans l'état local (sans recharger la map)
     * et met à jour son sprite (position + facing + flag trainerDefeated).
     */
    markTrainerDefeated(trainerId) {
        if (!trainerId) return;
        if (!this.defeatedTrainerIds) this.defeatedTrainerIds = new Set();
        this.defeatedTrainerIds.add(trainerId);

        // Mettre à jour le PNJ déjà spawné si présent
        const npc = (this.activeEvents || []).find(
            (e) => e && e.npcType === 'pokemon_trainer' && e.trainerId === trainerId
        );
        if (!npc) return;

        this.applyTrainerNpcState(npc, {
            defeated: true,
            afterWinTile: npc.trainerAfterWinTile,
            afterWinFacing: npc.trainerAfterWinFacing,
            initialFacing: npc.trainerInitialFacing
        });
    }

    async spawnTrainerNPCsForMap(mapKey) {
        if (!this.scene?.physics) return;
        if (!mapKey) return;

        const player = this.scene.playerManager?.getPlayer();
        if (!player) return;

        // Charger définitions depuis backend
        try {
            this.trainerNpcDefinitions = [];
            const apiBase = this.getApiBaseUrl();
            if (apiBase) {
                const r = await fetch(`${apiBase}/api/trainer-npcs?mapKey=${mapKey}`);
                if (r.ok) {
                    const docs = await r.json();
                    this.trainerNpcDefinitions = Array.isArray(docs) ? docs : [];
                }
            }
        } catch (e) {
            console.warn('[MapEventManager] Impossible de charger /api/trainer-npcs:', e);
            this.trainerNpcDefinitions = [];
        }

        try {
            console.log(`[MapEventManager] trainerNpcs chargés pour ${mapKey}: ${this.trainerNpcDefinitions.length}`);
        } catch (e) {
            // ignore
        }

        // Spawner chaque dresseur
        for (const def of this.trainerNpcDefinitions) {
            const trainerId = def?.trainerId;
            const tileX = def?.tileX;
            const tileY = def?.tileY;
            if (!trainerId || tileX === undefined || tileY === undefined) continue;

            const xPx = tileX * 48 + 24;
            const yPx = tileY * 48 ;

            const npc = this.scene.physics.add.sprite(xPx, yPx, def?.spriteKey || 'player', 0);
            npc.body.setSize(32, 32);
            npc.body.setOffset(8, 64);
            npc.setImmovable(true);
            npc.setInteractive();

            npc.npcType = 'pokemon_trainer';
            npc.trainerId = trainerId;
            npc.trainerName = def?.name || 'Dresseur';
            npc.trainerDialogue = def?.dialogue || '...';
            npc.trainerAfterDialogue = def?.afterDialogue || null;
            npc.trainerTeam = Array.isArray(def?.team) ? def.team : [];
            npc.trainerAfterWinTile = (def?.afterWinTileX !== undefined && def?.afterWinTileY !== undefined)
                ? { x: def.afterWinTileX, y: def.afterWinTileY }
                : null;
            npc.trainerAfterWinFacing = def?.afterWinFacing || 'down';
            npc.trainerInitialFacing = def?.initialFacing || 'down';
            npc.facePlayerOnInteract = def?.facePlayerOnInteract === false ? false : true;
            npc.trainerHideOnDefeat = def?.hideOnDefeat === true;

            // Blocage du chemin
            if (def?.blocks !== false) {
                this.scene.physics.add.collider(player, npc);
            }

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
    }

    populateAmbientNPCs(mapKey) {
        const npcListLille = [
            "Edouard", "Alex", "Jeanne", "Eric", "Bob", "Frédéric", 
            "Brandon", "Maxime", "Antoine", "Charlie", "Julie", "Karima"
        ];
        // old_man_josh retiré car géré manuellement pour la quête
        const npcListDouai = [
            "Clotilde", "Oscar", "Romain", "Tim", "Lucie", "Lola", 
            "Justine", "Patrick", "Robert", "Richard", "Samuel"
        ];
        
        let npcsToSpawn = [];
        let startX = 0;
        let startY = 0;

        if (mapKey === "lille") {
            npcsToSpawn = npcListLille;

            // Placement manuel des PNJ d'ambiance (coordonnées en tuiles + direction + dialogue)
            const placements = [
                { tileX: 21, tileY: 21, facing: 'up', dialogue: 'J\'ai faim sa mère, il est où le vendeur wsh.' },
                { tileX: 22, tileY: 21, facing: 'up', dialogue: 'J\hésite, mayo ou ketchup ?' },
                { tileX: 18, tileY: 33, facing: 'left', dialogue: 'Bah super, zéro effort le bus, je passe comment moi ?' },
                { tileX: 24, tileY: 62, facing: 'right', dialogue: 'Frérot je t\'assure, 5euros le pack ca part tout seul !' },
                { tileX: 25, tileY: 62, facing: 'left', dialogue: 'C\'est pas possible, personne n\'accepterait un tel prix' },
                { tileX: 12, tileY: 48, facing: 'down', dialogue: 'T\'es pas censé pouvoir me parler, dégage' },
                { tileX: 12, tileY: 49, facing: 'up', dialogue: 'Moi non plus  t\'es pas censé...' },
                { tileX: 71, tileY: 64, facing: 'left', dialogue: 'Dur dur le quinquenat sous macron ...' }
            ];

            // Alterner les sprites / éviter les doublons: on prend des npcName uniques.
            const used = new Set();
            let cursor = 0;
            const pickNextUnique = () => {
                for (let tries = 0; tries < npcsToSpawn.length; tries++) {
                    const name = npcsToSpawn[cursor % npcsToSpawn.length];
                    cursor++;
                    if (!name) continue;
                    if (used.has(name)) continue;
                    const spriteKey = `npc_${String(name).toLowerCase()}`;
                    if (!this.scene.textures.exists(spriteKey)) continue;
                    used.add(name);
                    return name;
                }
                return null;
            };

            placements.forEach((p) => {
                const npcName = pickNextUnique();
                if (!npcName) return;
                const x = p.tileX * 48 + 24;
                const y = p.tileY * 48 + 24;
                this.createAmbientNPC(npcName, x, y, p.facing, p.dialogue);
            });
            return;
        } else if (mapKey === "douai") {
            // Placement manuel des PNJ d'ambiance (coordonnées en tuiles + direction + nom affiché + dialogue)
            // L'utilisateur fournit: x:y + direction + nom + dialogue.
            const placements = [
                {
                    tileX: 117,
                    tileY: 26,
                    facing: 'right',
                    displayName: 'Douaisien',
                    dialogue: "J'ai enfin l'eau potable chez moi, t'imagine ?"
                },
                {
                    tileX: 118,
                    tileY: 26,
                    facing: 'left',
                    displayName: 'Douaisienne',
                    dialogue: "Oh wow, c'est vraiment le futur ici !"
                },
                {
                    tileX: 84,
                    tileY: 17,
                    facing: 'left',
                    displayName: 'Douaisien',
                    dialogue: "C'est pas n'importe quelle passerelle Harry !"
                },
                {
                    tileX: 84,
                    tileY: 26,
                    facing: 'up',
                    displayName: 'Pauvre',
                    dialogue: "Mais quelle invention génial le parkmètre quand même"
                },
                {
                    tileX: 126,
                    tileY: 25,
                    facing: 'right',
                    displayName: 'Sceptique',
                    dialogue: "Hmmm, tu avais déjà vu cette fontaine ici avant toi ? C'est certainement un complot"
                },
                {
                    tileX: 72,
                    tileY: 36,
                    facing: 'down',
                    displayName: 'Douaisien',
                    dialogue: "J'adore les bancs putain"
                },
                {
                    tileX: 14,
                    tileY: 40,
                    facing: 'left',
                    displayName: 'Douaisienne',
                    dialogue: "Comment je vais faire pour rentrer chez moi…"
                },
                {
                    tileX: 0,
                    tileY: 17,
                    facing: 'right',
                    displayName: 'Douaisien',
                    dialogue: "C'est pas trop frustrant de pas avoir de pokéball ? Peut-être qu'il y en a ..."
                }
            ];

            // Sprites réellement disponibles dans public/assets/sprites (noms de fichiers capitalisés)
            const maleSprites = [
                'Alex', 'Antoine', 'Bob', 'Brandon', 'Charlie', 'Didier', 'Edouard', 'Eric', 'Frédéric',
                'Maxime', 'Oscar', 'Patrick', 'Richard', 'Robert', 'Romain', 'Samuel', 'Tim'
            ];
            const femaleSprites = ['Clotilde', 'Jeanne', 'Julie', 'Justine', 'Karima', 'Lola', 'Lucie'];

            const used = new Set();
            let maleCursor = 0;
            let femaleCursor = 0;

            const pickSprite = (gender) => {
                const list = gender === 'female' ? femaleSprites : maleSprites;
                let cursor = gender === 'female' ? femaleCursor : maleCursor;

                for (let tries = 0; tries < list.length; tries++) {
                    const name = list[cursor % list.length];
                    cursor++;
                    if (!name) continue;
                    const spriteId = String(name).toLowerCase();
                    if (used.has(spriteId)) continue;
                    if (!this.scene.textures.exists(`npc_${spriteId}`)) continue;
                    used.add(spriteId);

                    if (gender === 'female') femaleCursor = cursor;
                    else maleCursor = cursor;

                    return name;
                }

                // Fallback: n'importe quel sprite dispo
                for (const anyName of [...femaleSprites, ...maleSprites]) {
                    if (!anyName) continue;
                    const spriteId = String(anyName).toLowerCase();
                    if (used.has(spriteId)) continue;
                    if (!this.scene.textures.exists(`npc_${spriteId}`)) continue;
                    used.add(spriteId);
                    return anyName;
                }

                return null;
            };

            const normalizeFacing = (f) => {
                const v = (f || '').toString().trim().toLowerCase();
                if (v === 'top' || v === 'up') return 'up';
                if (v === 'down' || v === 'bottom') return 'down';
                if (v === 'left') return 'left';
                if (v === 'right') return 'right';
                return 'down';
            };

            placements.forEach((p) => {
                const facing = normalizeFacing(p.facing);
                const isFemale = (p.displayName || '').toLowerCase().includes('douaisienne');
                const gender = isFemale ? 'female' : 'male';
                const npcName = pickSprite(gender);
                if (!npcName) return;

                const x = p.tileX * 48 + 24;
                const y = p.tileY * 48 + 24;
                this.createAmbientNPC(npcName, x, y, facing, p.dialogue, p.displayName);
            });

            // Garder l'ancien comportement d'ajout d'autres PNJ si besoin:
            // on spawn le reste en zone dédiée pour éviter les chevauchements.
            npcsToSpawn = npcListDouai.filter((n) => !used.has(String(n).toLowerCase()));
            startX = 110;
            startY = 32;
        } else if (mapKey === "metro") {
            npcsToSpawn = [...npcListLille, ...npcListDouai];

            // Placement manuel des PNJ (coordonnées en tuiles + direction du regard + dialogue)
            const placements = [
                { tileX: 22, tileY: 22, facing: 'left', dialogue: 'Je suis coincé dans le portique snif' },
                { tileX: 10, tileY: 21, facing: 'up', dialogue: '...' },
                { tileX: 20, tileY: 15.4, facing: 'down', dialogue: '...' },
                { tileX: 8, tileY: 12, facing: 'up', dialogue: '...' },
                { tileX: 19, tileY: 5, facing: 'down', dialogue: '...' },
                { tileX: 22, tileY: 2, facing: 'left', dialogue: '...' },
                { tileX: 26, tileY: 2, facing: 'down', dialogue: '...' }
            ];

            placements.forEach((p, i) => {
                const npcName = npcsToSpawn[i];
                if (!npcName) return;
                const x = p.tileX * 48 + 24;
                const y = p.tileY * 48 + 24;
                this.createAmbientNPC(npcName, x, y, p.facing, p.dialogue);
            });
            return;
        } else if (mapKey === "metroInterieur") {
            npcsToSpawn = [...npcListLille, ...npcListDouai];

            // Placement manuel des PNJ (coordonnées en tuiles + direction du regard + dialogue)
            // Format demandé: x:y + direction
            const placements = [
                { tileX: 6, tileY: 7, facing: 'right', dialogue: 'Pour une fois qu\'il roule ce métro...' },
                { tileX: 8, tileY: 6, facing: 'down', dialogue: 'Tu veux ma place ? C\'est mort ! ' },
                { tileX: 10, tileY: 6, facing: 'right', dialogue: 'Sympa le metro.mp3 nan ?' },
                { tileX: 11, tileY: 6, facing: 'left', dialogue: 'Je changerai bien de wagon mais y\'a un taré qui bloque le chemin ...' },
                { tileX: 16, tileY: 6, facing: 'right', dialogue: 'Euh, c\'est quoi le prochain arrêt ?' },
                { tileX: 17, tileY: 6, facing: 'left', dialogue: 'Ostricourt je crois.' },
                { tileX: 23, tileY: 6, facing: 'down', dialogue: 'J\'ai pu de batterie dans mes écouteurs, j\'ai le seum.' },
                { tileX: 28, tileY: 7, facing: 'up', dialogue: 'Tu veux quoi ?' }
            ];

            placements.forEach((p, i) => {
                const npcName = npcsToSpawn[i];
                if (!npcName) return;
                const x = p.tileX * 48 + 24;
                const y = p.tileY * 48 + 24;
                this.createAmbientNPC(npcName, x, y, p.facing, p.dialogue);
            });
            return;
        }

        npcsToSpawn.forEach((npcName, index) => {
            // Simple placement logic: spread them out a bit
            const x = (startX + (index % 5) * 2) * 48 + 24;
            const y = (startY + Math.floor(index / 5) * 2) * 48 + 24;
            
            this.createAmbientNPC(npcName, x, y);
        });
    }

    createAmbientNPC(npcName, x, y, facing = 'down', dialogue = null, displayName = null) {
        const rawName = (npcName || '').toString();
        const spriteId = rawName.toLowerCase();
        const spriteKey = `npc_${spriteId}`;
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
        // Store a stable, lowercase id for sprite/anim lookup, but keep a human-friendly name for UI.
        npc.npcName = spriteId;
        npc.displayName = typeof displayName === 'string' && displayName.trim().length > 0
            ? displayName
            : (rawName && rawName !== spriteId ? rawName : null);
        npc.ambientDialogue = typeof dialogue === 'string' ? dialogue : null;
        if (this.ambientGroup) {
            this.ambientGroup.add(npc);
        }
        
        // Animation (spritesheet sur 1 ligne: 6 frames par direction)
        // Ordre: droite (0-5), haut (6-11), gauche (12-17), bas (18-23)
        const safeFacing = ['down', 'left', 'right', 'up'].includes(facing) ? facing : 'down';
        const animKey = `${spriteId}_idle_${safeFacing}`;

        const texture = this.scene.textures.get(spriteKey);
        const frameTotal = texture ? texture.frameTotal : 0;

        const rangesByFacing6 = {
            right: { start: 0, end: 5 },
            up: { start: 6, end: 11 },
            left: { start: 12, end: 17 },
            down: { start: 18, end: 23 }
        };

        // Fallback: si la texture n'a pas assez de frames, on reste sur 0-3 (comportement historique)
        const range = frameTotal >= 24
            ? rangesByFacing6[safeFacing]
            : { start: 0, end: Math.max(0, Math.min(3, frameTotal - 1)) };

        // Force le frame initial selon la direction (même si l'anim est lente)
        try {
            npc.setFrame(range.start);
        } catch (e) {
            // ignore
        }

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
                frames: this.scene.anims.generateFrameNumbers(spriteKey, { start: range.start, end: range.end }),
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
                try { if (event?.bubble) event.bubble.destroy(); } catch (e) {}

                // Pokécenter zones create separate visuals that must be destroyed explicitly,
                // otherwise they can persist when changing maps.
                try { if (event?.pokeCenterEffect) event.pokeCenterEffect.destroy?.(); } catch (e) {}
                try { if (event?.pokeCenterIcon && event.pokeCenterIcon !== event.pokeCenterEffect) event.pokeCenterIcon.destroy?.(); } catch (e) {}

                try { event?.destroy?.(); } catch (e) {}
            });
        }
        this.activeEvents = [];
    }

    createSubwayDoor() {
        if (!this.mapManager.map) return;

        const finalX = 26 * 48 + 21; 
        const finalY = 10 * 48 - 10;

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

        // 🆕 Pokécenter
        if (npc.npcType === 'pokecenter') {
            this.handlePokeCenterInteraction(npc).catch((e) => {
                console.warn('[MapEventManager] PokeCenter interaction error:', e);
            });
            return;
        }

        // 🆕 Pickup (Poké Ball) persistant
        if (npc.npcType === 'world_pickup') {
            this.handleWorldPickupInteraction(npc).catch((e) => {
                console.warn('[MapEventManager] World pickup interaction error:', e);
            });
            return;
        }

        // 🆕 Coffres statiques (coffre.png)
        if (npc.npcType === 'static_chest') {
            this.handleStaticChestInteraction(npc);
            return;
        }

        if (npc.npcType === "ralof") {
            const answer = window.prompt("What's my Name ?");
            if (answer && answer.toLowerCase() === "ralof") {
                try {
                    this.scene.registry.set('teleport:ralof->qwest', true);
                } catch (e) {
                    // ignore
                }
                this.mapManager.changeMap("qwest", 3 * 48 + 24, 4 * 48 + 24);
            }
        } else if (npc.npcType === "booster_vendor") {
            this.scene.displayMessage("Salut l'ami ! Tu veux des boosters de cartes ?\n J'ai ce qu'il te faut !", "Marchand");
            setTimeout(() => {
                if (this.scene.shopManager) {
                    this.scene.shopManager.openShop();
                }
            }, 1500);
        } else if (npc.npcType === "ambient") {
            const manual = (typeof npc.ambientDialogue === 'string' && npc.ambientDialogue.trim().length > 0)
                ? npc.ambientDialogue
                : null;

            const speakerName = npc.displayName || npc.npcName || "Habitant";

            if (manual) {
                this.scene.displayMessage(manual, speakerName);
                return;
            }

            // Fallback pour les PNJ d'ambiance auto-spawn / anciens placements
            const currentMapKey = this.mapManager?.map?.key || this.scene.registry.get('currentMapKey') || '';
            const pool = this.getAmbientDialoguePool(currentMapKey, npc.npcName);
            const randomDialogue = pool[Math.floor(Math.random() * pool.length)];
            this.scene.displayMessage(randomDialogue, speakerName);
        } else if (npc.npcType === 'pokemon_trainer') {
            // Déjà battu -> il s'est écarté, pas de combat
            if (npc.trainerDefeated) {
                const afterText = npc.trainerAfterDialogue;
                if (afterText) {
                    this.scene.displayMessage(afterText, npc.trainerName || 'Dresseur');
                }
                return;
            }

            if (!playerId) {
                this.scene.displayMessage('Impossible de lancer le combat (joueur non chargé).', 'Erreur');
                return;
            }

            const launchTrainerBattle = () => {
                // sécurité si la scène a changé entre-temps
                if (!this.scene?.scene) return;

                // Fermer toute boîte de dialogue avant de passer en combat
                // (sinon elle peut rester visible quand on revient via resume)
                if (typeof this.scene.forceCloseDialogue === 'function') {
                    this.scene.forceCloseDialogue({ clearQueue: true });
                }

                // Reset mobile inputs if the player was moving/sprinting on mobile
                try { this.scene.uiManager?.resetInputs?.(); } catch (e) {}

                // ✅ Flow "combat" propre: pause GameScene puis launch battle overlay
                const returnSceneKey = this.scene.scene.key || 'GameScene';
                try {
                    if (this.scene.scene.isActive(returnSceneKey)) {
                        this.scene.scene.pause(returnSceneKey);
                    }
                } catch (e) {
                    // ignore
                }

                if (this.scene.scene.isActive('PokemonBattleScene')) {
                    console.warn('[MapEventManager] PokemonBattleScene déjà active, skip');
                    return;
                }

                this.scene.scene.launch('PokemonBattleScene', {
                    playerId,
                    battleType: 'trainer',
                    returnScene: returnSceneKey,
                    trainerBattle: {
                        trainerId: npc.trainerId,
                        mapKey: this.mapManager?.map?.key || null,
                        name: npc.trainerName || null,
                        team: npc.trainerTeam || []
                    }
                });
            };

            // Dialogue d'intro: on attend explicitement l'input utilisateur (fermeture)
            // avant de lancer le combat.
            this.scene.displayMessage(
                npc.trainerDialogue || '...',
                npc.trainerName || 'Dresseur',
                () => {
                    // On passe au combat une fois le dialogue fermé.
                    launchTrainerBattle();
                }
            );
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

    createPokeCenterZone({ id, mapKey, tileX, tileY }) {
        try {
            const x = tileX * 48 + 24;
            const y = tileY * 48 + 24;

            const zone = this.scene.add.zone(x, y, 48, 48).setOrigin(0.5);
            this.scene.physics.world.enable(zone);
            zone.body.setAllowGravity(false);
            zone.body.setImmovable(true);
            zone.setInteractive();

            zone.npcType = 'pokecenter';
            zone.pokeCenterId = id;
            zone.pokeCenterData = { id, mapKey, tileX, tileY, posX: x, posY: y };

            // Add a small pokecenter icon at the zone position if available,
            // otherwise draw a small fallback graphic so heal zones are visible.
            try {
                let icon = null;
                if (this.scene.textures && this.scene.textures.exists && this.scene.textures.exists('pokecenter')) {
                    icon = this.scene.add.image(x, y, 'pokecenter').setOrigin(0.5).setScale(0.5);
                } else {
                    icon = this.scene.add.graphics();
                    icon.fillStyle(0xff5a5a, 1);
                    icon.fillCircle(x, y - 8, 6);
                }
                if (icon) {
                    icon.setDepth(0);
                    zone.pokeCenterIcon = icon;
                     try {
                    this.scene.tweens.add({
                        targets: icon,
                        alpha: { from: 1, to: 0.25 },
                        duration: 1000,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                } catch (e) {}
                zone.pokeCenterEffect = icon;
                }
            } catch (e) {}

            // Add a pulsing ring effect behind the icon to improve visibility


            this.activeEvents.push(zone);
        } catch (e) {
            console.warn('[MapEventManager] createPokeCenterZone failed:', e);
        }
    }

    async handlePokeCenterInteraction(zone) {
        const apiUrl = process.env.REACT_APP_API_URL;
        const playerData = this.scene.registry.get('playerData');
        const playerPseudo = this.scene.registry.get('playerPseudo') || 'Moi';
        const playerId = playerData ? playerData._id : null;
        const mapKey = zone?.pokeCenterData?.mapKey || this.mapManager?.map?.key || null;
        const mapId = (mapKey && this.mapManager?.mapIds && typeof this.mapManager.mapIds[mapKey] === 'number')
            ? this.mapManager.mapIds[mapKey]
            : (playerData?.mapId ?? null);
        const posX = Number(zone?.pokeCenterData?.posX);
        const posY = Number(zone?.pokeCenterData?.posY);

        if (!apiUrl || !playerId) {
            this.scene.displayMessage("Impossible de soigner l'équipe (joueur non chargé).", 'Erreur');
            return;
        }

        // Heal all
        try {
            const r = await fetch(`${apiUrl}/api/pokemon/team/heal-all`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId })
            });
            if (!r.ok) {
                const body = await r.text().catch(() => '');
                throw new Error(`HTTP ${r.status} ${body}`);
            }
        } catch (e) {
            console.warn('[PokeCenter] heal-all failed:', e);
            this.scene.displayMessage("Le soin a échoué.", 'Erreur');
            return;
        }

        // Sound + message
        try { this.scene.sound?.play?.('pkmncenter', { volume: 0.3 }); } catch (e) {}
        this.scene.displayMessage("L'équipe est soignée !", playerPseudo);

        // Double camera flash for emphasis and a short pulse on the icon/ring
        try {
            const cam = this.scene.cameras?.main;
            if (cam) {
                cam.flash(120, 255, 255, 255);
                this.scene.time.delayedCall(160, () => {
                    try { cam.flash(120, 255, 255, 255); } catch (e) {}
                });
            }
        } catch (e) {}

        try {
            if (zone?.pokeCenterEffect) {
                this.scene.tweens.add({
                    targets: zone.pokeCenterEffect,
                    scaleX: { from: 1, to: 1.7 },
                    scaleY: { from: 1, to: 1.7 },
                    alpha: { from: 1, to: 0.2 },
                    duration: 180,
                    yoyo: true,
                    repeat: 1,
                    ease: 'Cubic.easeOut'
                });
            }
            if (zone?.pokeCenterIcon) {
                this.scene.tweens.add({
                    targets: zone.pokeCenterIcon,
                    scale: { from: zone.pokeCenterIcon.scale || 1, to: (zone.pokeCenterIcon.scale || 1) * 1.25 },
                    duration: 180,
                    yoyo: true,
                    repeat: 1,
                    ease: 'Cubic.easeOut'
                });
            }
        } catch (e) {}

        // Persist lastHeal for respawn
        try {
            const lastHeal = {
                mapKey: mapKey ?? null,
                mapId: typeof mapId === 'number' ? mapId : null,
                posX,
                posY,
                updatedAt: new Date().toISOString()
            };

            // Update in registry (so battle defeat can use it immediately)
            try {
                if (playerData) {
                    const updated = { ...playerData, lastHeal };
                    this.scene.registry.set('playerData', updated);
                }
            } catch (e) {}

            // Persist server-side
            await fetch(`${apiUrl}/api/players/update-last-heal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId, mapKey, mapId, posX, posY })
            }).catch(() => {});
        } catch (e) {
            console.warn('[PokeCenter] update-last-heal failed (non bloquant):', e);
        }
    }

    createStaticChest({ id, mapKey, tileX, tileY, lootName, lootQty }) {
        try {
            const x = tileX * 48 + 24;
            const y = tileY * 48 + 24;

            const chest = this.scene.physics.add.sprite(x, y, 'coffre', 0);
            chest.setImmovable(true);
            chest.setInteractive();
            chest.npcType = 'static_chest';
            chest.chestId = id;
            chest.lootName = lootName;
            chest.lootQty = Number(lootQty) || 1;

            // Hitbox
            chest.body.setSize(40, 40);
            chest.body.setOffset(8, 16);
            chest.facePlayerOnInteract = false;
            // Animation ouverture
            if (!this.scene.anims.exists('coffre_open')) {
                this.scene.anims.create({
                    key: 'coffre_open',
                    frames: this.scene.anims.generateFrameNumbers('coffre', { start: 0, end: 3 }),
                    frameRate: 8,
                    repeat: 0
                });
            }

            // État initial selon les coffres déjà ouverts côté joueur
            const playerData = this.scene.registry.get('playerData');
            const opened = Array.isArray(playerData?.openedChests) && playerData.openedChests.includes(String(id));
            if (opened) {
                chest.setFrame(3);
                chest.__opened = true;
            } else {
                chest.__opened = false;
            }

            const player = this.scene.playerManager?.getPlayer();
            if (player) {
                this.scene.physics.add.collider(player, chest);
            }

            this.activeEvents.push(chest);
        } catch (e) {
            console.warn('[MapEventManager] createStaticChest failed:', e);
        }
    }

    handleStaticChestInteraction(chest) {
        const playerPseudo = this.scene.registry.get('playerPseudo') || 'Moi';
        const playerData = this.scene.registry.get('playerData');
        const playerId = playerData ? playerData._id : null;

        if (chest.__opened) {
            this.scene.displayMessage('Ce coffre est déjà ouvert !', playerPseudo);
            return;
        }

        chest.__opened = true;
        try {
            chest.play('coffre_open');
            chest.once('animationcomplete', () => {
                try { chest.setFrame(3); } catch (e) {}
            });
        } catch (e) {
            // fallback
            try { chest.setFrame(3); } catch (err) {}
        }

        const lootName = chest.lootName || 'Potion';
        const lootQty = Number(chest.lootQty) || 1;
        const lootLabel = `${lootQty} ${lootName}${lootQty > 1 ? 's' : ''}`;
        this.scene.displayMessage(`J'ai trouvé ${lootLabel}`, playerPseudo);

        // Donner les objets
        try {
            this.scene.addItemToInventory({ nom: lootName, quantite: lootQty });
        } catch (e) {
            console.warn('[StaticChest] addItemToInventory failed:', e);
        }

        // Persist opened state
        try {
            const apiUrl = process.env.REACT_APP_API_URL;
            if (apiUrl && playerId && chest.chestId) {
                fetch(`${apiUrl}/api/players/opened-chests/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ playerId, chestId: String(chest.chestId) })
                }).catch(() => {});
            }

            // Update local registry so it stays opened even without reload
            try {
                if (playerData) {
                    const current = Array.isArray(playerData.openedChests) ? playerData.openedChests : [];
                    if (!current.includes(String(chest.chestId))) {
                        const updated = { ...playerData, openedChests: [...current, String(chest.chestId)] };
                        this.scene.registry.set('playerData', updated);
                    }
                }
            } catch (e) {}
        } catch (e) {
            console.warn('[StaticChest] persist opened failed (non bloquant):', e);
        }

        try {
            this.scene.sound?.play?.('item_get', { volume: 0.3 });
        } catch (e) { /* ignore */ }
    }

    createGaaraPokeballPickup({ id, tileX, tileY }) {
        this.createPokeballPokemonPickup({ id, tileX, tileY, kind: 'gaara_pokemon' }, '[MapEventManager] createGaaraPokeballPickup failed:');
    }

    createFlokiPokeballPickup({ id, tileX, tileY }) {
        this.createPokeballPokemonPickup({ id, tileX, tileY, kind: 'floki_pokemon' }, '[MapEventManager] createFlokiPokeballPickup failed:');
    }

    createTanukiPokeballPickup({ id, tileX, tileY }) {
        this.createPokeballPokemonPickup({ id, tileX, tileY, kind: 'tanuki_pokemon' }, '[MapEventManager] createTanukiPokeballPickup failed:');
    }

    getPokeballPickupConfig(kind) {
        const k = String(kind || '').toLowerCase();

        const configs = {
            gaara_pokemon: {
                speciesId: 552,
                nickname: 'Gaara',
                level: 7,
                prompt: 'Gaara ??',
                failMessage: "Impossible d'ajouter Gaara.",
                successMessage: "Gaara ajouté à l'équipe !"
            },
            floki_pokemon: {
                // clone Givrali
                speciesId: 471,
                nickname: 'Floki',
                level: 10,
                prompt: 'Floki ??',
                failMessage: "Impossible d'ajouter Floki.",
                successMessage: "Floki ajouté à l'équipe !"
            },
            tanuki_pokemon: {
                // clone Luxray
                speciesId: 405,
                nickname: 'Tanuki',
                level: 12,
                prompt: 'Tanuki ??',
                failMessage: "Impossible d'ajouter Tanuki.",
                successMessage: "Tanuki ajouté à l'équipe !"
            }
        };

        return configs[k] || null;
    }

    createPokeballPokemonPickup({ id, tileX, tileY, kind }, logPrefix) {
        try {
            const playerData = this.scene.registry.get('playerData');
            const collected = Array.isArray(playerData?.collectedWorldItems) ? playerData.collectedWorldItems : [];
            if (collected.includes(String(id))) return;

            const cfg = this.getPokeballPickupConfig(kind);
            if (!cfg) {
                console.warn('[MapEventManager] Unknown pickup kind:', kind);
                return;
            }

            const x = tileX * 48 + 24;
            const y = tileY * 48 + 24;

            const pickup = this.scene.physics.add.image(x, y, 'overworld_pokeball');
            pickup.setImmovable(true);
            pickup.setInteractive();
            pickup.setDepth(6);
            pickup.setDisplaySize(36, 36);
            pickup.facePlayerOnInteract = false;
            // Hitbox un peu plus petite que le sprite
            pickup.body.setSize(36, 36, true);

            const player = this.scene.playerManager?.getPlayer();
            if (player) {
                this.scene.physics.add.collider(player, pickup);
            }

            pickup.npcType = 'world_pickup';
            pickup.pickupId = String(id);
            pickup.pickupKind = String(kind);

            this.activeEvents.push(pickup);
        } catch (e) {
            console.warn(logPrefix, e);
        }
    }

    async handleWorldPickupInteraction(pickup) {
        const apiUrl = process.env.REACT_APP_API_URL;
        const playerPseudo = this.scene.registry.get('playerPseudo') || 'Moi';
        const playerData = this.scene.registry.get('playerData');
        const playerId = playerData ? playerData._id : null;

        if (!playerId) {
            this.scene.displayMessage("Impossible de récupérer (joueur non chargé).", 'Erreur');
            return;
        }

        if (!pickup || pickup.__busy) return;
        pickup.__busy = true;

        try {
            const cfg = this.getPokeballPickupConfig(pickup.pickupKind);
            if (!cfg) {
                this.scene.displayMessage("Impossible de récupérer (objet inconnu).", 'Erreur');
                return;
            }

            // Dialogue joueur
            await new Promise((resolve) => {
                this.scene.displayMessage(cfg.prompt, playerPseudo, resolve);
            });

            const createUrl = apiUrl ? `${apiUrl}/api/pokemon/create` : '/api/pokemon/create';
            const r = await fetch(createUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId,
                    speciesId: cfg.speciesId,
                    nickname: cfg.nickname,
                    level: cfg.level
                })
            });

            const body = await r.json().catch(() => ({}));
            if (!r.ok || body?.success === false) {
                const msg = body?.message || cfg.failMessage;
                this.scene.displayMessage(msg, 'Système');
                return;
            }

            // Persist "collecté" (non bloquant, comme pour les coffres)
            try {
                const persistUrl = apiUrl ? `${apiUrl}/api/players/collected-world-items/add` : '/api/players/collected-world-items/add';
                await fetch(persistUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ playerId, itemId: String(pickup.pickupId) })
                }).catch(() => {});

                // Update local registry
                try {
                    if (playerData) {
                        const current = Array.isArray(playerData.collectedWorldItems) ? playerData.collectedWorldItems : [];
                        if (!current.includes(String(pickup.pickupId))) {
                            const updated = { ...playerData, collectedWorldItems: [...current, String(pickup.pickupId)] };
                            this.scene.registry.set('playerData', updated);
                        }
                    }
                } catch (e) {}
            } catch (e) {
                console.warn('[WorldPickup] persist collected failed (non bloquant):', e);
            }

            await new Promise((resolve) => {
                this.scene.displayMessage(cfg.successMessage, 'Système', resolve);
            });

            // Disparition
            try { pickup.destroy(); } catch (e) {}
            this.activeEvents = (this.activeEvents || []).filter((ev) => ev !== pickup);
        } finally {
            if (pickup) pickup.__busy = false;
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

        this.scene.displayMessage(`J'ai trouvé ${eventData.properties.loot}`, playerPseudo);

        fetch(`${process.env.REACT_APP_API_URL}/api/world-events/${eventData._id}/state`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ opened: true })
        });

        this.scene.addItemToInventory({ nom: eventData.properties.loot, quantite: 1 });
        eventData.state.opened = true;
        
        try {
            if (this.scene && this.scene.sound) {
                this.scene.sound.play('item_get', { volume: 0.3 });
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