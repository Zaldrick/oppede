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

    // ⚠️ Pas de drop/suppression. On fait des upserts par trainerId.
    const docs = [
      {
        trainerId: 'metroInterieur:13:7:blocker',
        mapKey: 'metroInterieur',

        // Coordonnées en cases (tile)
        tileX: 13,
        tileY: 7,

        // Sprite (par défaut: spritesheet "player")
        spriteKey: 'player',

        // Comportement
        blocks: true,
        facePlayerOnInteract: false,

        // Dialogue / identité
        name: 'Dresseur',
        dialogue: "Qui t'as dit que le métro de Lille était safe ?",

        // Team (speciesId = id PokéAPI)
        team: [
          { speciesId: 19, level: 8 }, // Rattata
          { speciesId: 16, level: 7 }  // Pidgey
        ],

        // Après victoire
        afterWinTileX: 13,
        afterWinTileY: 6,
        afterWinFacing: 'down',
        initialFacing: 'left',

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
