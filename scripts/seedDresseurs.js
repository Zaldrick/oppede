const { MongoClient } = require('mongodb');

async function connectToDatabase() {
  // Même philosophie que scripts/seedDatabase.js : env si dispo, sinon fallback.
  const uri = process.env.MONGO_URI || 'mongodb+srv://zaldrick:xtHDAM0ZFpq2iL9L@oppede.zfhlzph.mongodb.net/oppede';

  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  return client;
}

async function seedDresseurs() {
  let client;

  try {
    client = await connectToDatabase();
    console.log('[seedDresseurs] Connecté à MongoDB');

    const db = client.db('oppede');
    const trainerNpcs = db.collection('trainerNpcs');
    const trainerNpcDefeats = db.collection('trainerNpcDefeats');

    // ⚠️ Mode destructif (vide les collections) : nécessite confirmation explicite
    const wantsReset = process.argv.includes('--reset') || process.env.SEED_RESET === '1' || process.env.SEED_RESET === 'true';
    const confirmedReset = process.argv.includes('--confirm-reset') || process.env.CONFIRM_RESET === '1' || process.env.CONFIRM_RESET === 'true';

    if (wantsReset && !confirmedReset) {
      console.error('[seedDresseurs] REFUS: reset demandé mais non confirmé. Ajoute --confirm-reset (ou CONFIRM_RESET=1).');
      process.exit(1);
    }

    if (wantsReset && confirmedReset) {
      console.warn('[seedDresseurs] RESET: suppression de TOUTES les entrées trainerNpcs + trainerNpcDefeats');
      await trainerNpcs.deleteMany({});
      await trainerNpcDefeats.deleteMany({});
      console.log('[seedDresseurs] RESET terminé');
    }

    // ⚠️ Pas de drop/suppression. On fait des upserts par trainerId.
    const docs = [
      {
        trainerId: 'metroInterieur:13:7:blocker',
        mapKey: 'metroInterieur',

        // Coordonnées en cases (tile)
        tileX: 13,
        tileY: 7,

        // Sprite (par défaut: spritesheet "player")
        spriteKey: 'npc_didier',

        // Comportement
        blocks: true,
        facePlayerOnInteract: false,

        // Dialogue / identité
        name: 'Dresseur',
        dialogue: "Qui t'as dit que le métro de Lille était safe ?",
        afterDialogue: "Je devrais peut-être m'inquiéter pour moi plutôt ...",

        // Team (speciesId = id PokéAPI)
        team: [
          { speciesId: 19, level: 8 }, // Rattata
          { speciesId: 17, level: 11 }  // Pidgey
        ],

        // Après victoire
        afterWinTileX: 13,
        afterWinTileY: 6,
        afterWinFacing: 'down',
        initialFacing: 'left',

        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        trainerId: 'metroInterieur:19:7:blocker',
        mapKey: 'metroInterieur',

        // Coordonnées en cases (tile)
        tileX: 19,
        tileY: 7,

        // Sprite (par défaut: spritesheet "player")
        spriteKey: 'npc_didier',

        // Comportement
        blocks: true,
        facePlayerOnInteract: false,

        // Dialogue / identité
        name: 'Dresseur',
        dialogue: 'Mais tu comptes aller où comme ça ma jolie ?',
        afterDialogue: "Grr, J'ai pas l'habitude qu'on me réponde comme ça, t'es libre demain soir ?",

        // Team (speciesId = id PokéAPI)
        team: [
          { speciesId: 88, level: 14 } // Tadmorv
        ],

        // Après victoire
        afterWinTileX: 19,
        afterWinTileY: 6,
        afterWinFacing: 'down',
        initialFacing: 'left',

        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        trainerId: 'metroInterieur:36:7:blocker',
        mapKey: 'metroInterieur',

        // Coordonnées en cases (tile)
        tileX: 36,
        tileY: 7,

        // Sprite (par défaut: spritesheet "player")
        spriteKey: 'npc_didier',

        // Comportement
        blocks: true,
        facePlayerOnInteract: false,

        // Dialogue / identité
        name: 'Dresseur',
        dialogue: "T'es là pour me contrôler mon ticket c'est ça ?",
        afterDialogue: "Ah tu voulais juste passer ? Dfaçon j'ai pas de ticket ! ",

        // Team (speciesId = id PokéAPI)
        team: [
          { speciesId: 52, level: 11 }, // Miaous
          { speciesId: 27, level: 11 }, // Sablette
          { speciesId: 66, level: 11 }  // Machoc
        ],

        // Après victoire
        afterWinTileX: 36,
        afterWinTileY: 6,
        afterWinFacing: 'down',
        initialFacing: 'left',

        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        trainerId: 'metro:29:23:blocker',
        mapKey: 'metro',

        // Coordonnées en cases (tile)
        tileX: 29,
        tileY: 23,

        // Sprite
        spriteKey: 'npc_didier',

        // Comportement
        blocks: true,
        facePlayerOnInteract: false,

        // Dialogue / identité
        name: 'Dresseur',
        dialogue: "J'ai verrouillé la machine à ticket, fuck Ilévia, vive Transpole putain !",
        afterDialogue: "C'est 1234 le code, j'arrive pas à le changer la loose",

        // Team
        team: [
          { speciesId: 50, level: 7 },
          { speciesId: 50, level: 7 },
          { speciesId: 50, level: 7 }
        ],

        // Après victoire: déplacement à droite, regard vers la gauche
        afterWinTileX: 29,
        afterWinTileY: 23,
        afterWinFacing: 'left',
        initialFacing: 'left',

        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        trainerId: 'metro:26:11:blocker',
        mapKey: 'metro',

        // Coordonnées en cases (tile)
        tileX: 26,
        tileY: 11,

        // Sprite
        spriteKey: 'npc_brandon',

        // Comportement
        blocks: true,
        facePlayerOnInteract: false,

        // Dialogue / identité
        name: 'FouDuMétro',
        dialogue: 'Quoi ? tu veux rentrer ? Faut le mériter',
        afterDialogue: "J'adore empêcher les gens de sortir du wagon.",

        // Team
        team: [
          { speciesId: 32, level: 8 }, // Nidoran♂
          { speciesId: 41, level: 8 }  // Nosferapti
        ],

        // Après victoire: déplacement à gauche, regard vers la droite
        afterWinTileX: 25,
        afterWinTileY: 11,
        afterWinFacing: 'right',
        initialFacing: 'down',

        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        trainerId: 'qwest:15:25:blocker',
        mapKey: 'qwest',

        // Coordonnées en cases (tile)
        tileX: 15,
        tileY: 25,

        // Sprite
        spriteKey: 'npc_lucie',

        // Comportement
        blocks: true,
        facePlayerOnInteract: false,
        hideOnDefeat: true,

        // Dialogue / identité
        name: 'Voisine',
        dialogue: "Tu viens de sortir de CET appart ?! T'es qui exactement ? C'est privé ici !",

        // Team (speciesId = id PokéAPI)
        team: [
          { speciesId: 129, level: 1 }, // Magicarpe
          { speciesId: 91, level: 4 }   // Crustabri
        ],

        // Orientation initiale (vers le haut)
        initialFacing: 'up',

        createdAt: new Date(),
        updatedAt: new Date()
      },

      // Douai: nouveaux dresseurs (se décalent après défaite)
      {
        trainerId: 'douai:68:12:blocker',
        mapKey: 'douai',

        // Coordonnées en cases (tile)
        tileX: 68,
        tileY: 12,

        // Sprite (réutilise un sprite existant)
        spriteKey: 'npc_didier',

        // Comportement
        blocks: true,
        facePlayerOnInteract: false,

        // Dialogue / identité
        name: 'Dresseur',
        dialogue: "C'est MA passerelle, du balais !",
        afterDialogue: 'Nan bah on peut partager, tranquille',

        // Team (speciesId = id PokéAPI)
        team: [
          { speciesId: 15, level: 17 }, // Dardargnan (Beedrill)
          { speciesId: 33, level: 16 }  // Nidorino
        ],

        // Après victoire: se décale d'une tuile (laisse passer)
        afterWinTileX: 68,
        afterWinTileY: 11,
        afterWinFacing: 'down',
        initialFacing: 'down',

        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        trainerId: 'douai:54:47:blocker',
        mapKey: 'douai',

        // Coordonnées en cases (tile)
        tileX: 54,
        tileY: 47,

        // Sprite (réutilise un sprite existant)
        spriteKey: 'npc_didier',

        // Comportement
        blocks: true,
        facePlayerOnInteract: false,

        // Dialogue / identité
        name: 'Dresseur',
        dialogue: "Interdiction d'approcher des travaux !",
        afterDialogue: 'Bon bon bah tu peux passer.',

        // Team (speciesId = id PokéAPI)
        team: [
          { speciesId: 81, level: 16 }, // Magnéti
          { speciesId: 92, level: 17 }  // Fantominus
        ],

        // Après victoire: se décale d'une tuile (laisse passer)
        afterWinTileX: 54,
        afterWinTileY: 48,
        afterWinFacing: 'up',
        initialFacing: 'up',

        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const doc of docs) {
      if (!doc.trainerId) {
        console.warn('[seedDresseurs] trainerId manquant, doc ignoré');
        continue;
      }

      const now = new Date();

      // Éviter les conflits MongoDB ($set vs $setOnInsert)
      const { createdAt, updatedAt, ...setDoc } = doc;

      await trainerNpcs.updateOne(
        { trainerId: doc.trainerId },
        {
          $set: {
            ...setDoc,
            updatedAt: now
          },
          $setOnInsert: {
            createdAt: createdAt || now
          }
        },
        { upsert: true }
      );

      console.log(`[seedDresseurs] Upsert OK: ${doc.trainerId}`);
    }

    console.log('[seedDresseurs] Terminé');
  } finally {
    if (client) {
      await client.close();
    }
  }
}

seedDresseurs().catch(err => {
  console.error('[seedDresseurs] Erreur:', err);
  process.exit(1);
});
