const fetch = require('node-fetch').default;
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://zaldrick:xtHDAM0ZFpq2iL9L@oppede.zfhlzph.mongodb.net/oppede';
const API_BASE = process.env.API_BASE || 'http://localhost:5000';

async function getPlayer(pseudo) {
    const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    const db = client.db('oppede');
    const players = db.collection('players');
    const player = await players.findOne({ pseudo });
    await client.close();
    return player;
}

async function main() {
    const player = await getPlayer('Mehdi');
    if (!player) {
        console.error('Player Mehdi not found. Please run seedPlayerPokemon.js --clear-all first');
        process.exit(1);
    }

    console.log('Using player id:', player._id.toString());

    // Start a wild battle
    const startRes = await fetch(`${API_BASE}/api/battle/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: player._id.toString(), battleType: 'wild' })
    });
    const startData = await startRes.json();
    console.log('Start response:', JSON.stringify(startData, null, 2));

    const battleId = startData.battleId;
    if (!battleId) {
        console.error('No battleId returned');
        process.exit(1);
    }

    // Loop turns until battle ends. We'll use 'tackle' repeatedly.
    let turnNum = 0;
    while (true) {
        turnNum++;
        const turnRes = await fetch(`${API_BASE}/api/battle/turn`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ battleId: battleId, moveName: 'tackle' })
        });
        const turnData = await turnRes.json();
        console.log(`Turn #${turnNum} response:`, JSON.stringify(turnData, null, 2));
        if (turnData.isOver) break;
        // Small delay
        await new Promise(r => setTimeout(r, 300));
    }
}

main().catch(e => { console.error(e); process.exit(1); });