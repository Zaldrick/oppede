import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema({
    pseudo: { type: String, required: true, unique: true },
    dailyTeam: { type: Number, default: 0 }, // Équipe quotidienne
    dailyScore: { type: Number, default: 0 }, // Score quotidien
    totalScore: { type: Number, default: 0 }, // Score total
    posX: { type: Number, default: 0 },
    posY: { type: Number, default: 0 },
    mapId: { type: Number, default: 0 }, // ID de la carte   
    isActif { type: Boolean, default: true },
    character: { type: String, default: 'default' },
});

const Player = mongoose.model('Player', playerSchema);

export default Player;
