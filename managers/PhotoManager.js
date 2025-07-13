const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { ObjectId } = require('mongodb');

class PhotoManager {
    constructor(databaseManager) {
        this.db = databaseManager;
        this.storage = multer.diskStorage({
            destination: (req, file, cb) => cb(null, 'public/photos'),
            filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname)
        });
        this.upload = multer({ storage: this.storage });
    }

    setupRoutes(app) {
        // Route pour servir les photos statiques
        app.use('/public/photos', require('express').static(path.join(__dirname, '../public', 'photos'), {
            setHeaders: (res, path) => {
                res.set('Content-Disposition', 'attachment');
            }
        }));


        app.get('/api/photos/download/:filename', (req, res) => {
            const filePath = path.join(__dirname, '../public/photos', req.params.filename);
            if (fs.existsSync(filePath)) {
                res.download(filePath, req.params.filename); // <-- force le téléchargement
            } else {
                res.status(404).json({ error: "Fichier non trouvé" });
            }
        });

        // Route pour ajouter une photo
        app.post('/api/photos/upload', this.upload.single('photo'), async (req, res) => {
            if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

            const db = await this.db.connectToDatabase();
            const photosCollection = db.collection('photos');

            const { description, taggedPlayers, uploader, dateTaken } = req.body;
            const photoDoc = {
                filename: req.file.filename,
                url: `/public/photos/${req.file.filename}`,
                dateTaken: dateTaken || new Date().toISOString().slice(0, 10),
                description: description || "",
                taggedPlayers: taggedPlayers ? JSON.parse(taggedPlayers) : [],
                uploader: uploader || "Inconnu",
                votes: 0
            };
            await photosCollection.insertOne(photoDoc);

            res.json({ url: photoDoc.url });
        });

        // ✅ NOUVEAU : Route pour voter sur une photo avec attribution de points

        app.post('/api/photos/:id/vote', async (req, res) => {
            const { id } = req.params;
            const db = await this.db.connectToDatabase();
            const photosCollection = db.collection('photos');

            try {
                // Récupérer la photo pour connaître l'uploader
                const photo = await photosCollection.findOne({ _id: new ObjectId(id) });
                if (!photo) {
                    return res.status(404).json({ error: "Photo non trouvée" });
                }

                // Incrémenter le nombre de votes
                const updateResult = await photosCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $inc: { votes: 1 } }
                );

                if (updateResult.matchedCount === 0) {
                    return res.status(404).json({ error: "Photo non trouvée" });
                }

                // Attribuer 1 point au propriétaire de la photo
                if (photo.uploader && photo.uploader.trim() !== "" && photo.uploader.toLowerCase() !== "inconnu") {
                    console.log(`[PhotoManager] Attribution d'1 point pour like sur photo de ${photo.uploader}`);

                    try {
                        const playersCollection = db.collection('players');
                        const uploaderPlayer = await playersCollection.findOne({
                            pseudo: { $regex: new RegExp(`^${photo.uploader.trim()}$`, 'i') }
                        });

                        if (uploaderPlayer) {
                            // Ajoute 1 point au joueur uploader
                            const updatePlayer = await playersCollection.updateOne(
                                { _id: uploaderPlayer._id },
                                { $inc: { totalScore: 1 } }
                            );

                            if (updatePlayer.matchedCount > 0) {
                                const newTotalScore = (uploaderPlayer.totalScore || 0) + 1;
                                return res.json({
                                    success: true,
                                    newVotes: photo.votes + 1,
                                    pointsAwarded: {
                                        uploader: photo.uploader,
                                        pointsEarned: 1,
                                        newTotalScore
                                    }
                                });
                            }
                        } else {
                            console.warn(`[PhotoManager] Joueur "${photo.uploader}" non trouvé en base`);
                        }
                    } catch (pointsError) {
                        console.error('[PhotoManager] Erreur lors de l\'attribution des points:', pointsError);
                    }
                } else {
                    console.log(`[PhotoManager] Like sur photo sans uploader valide: "${photo.uploader}"`);
                }

                // Réponse générique si pas de points attribués ou joueur non trouvé
                res.json({ success: true, newVotes: photo.votes + 1 });

            } catch (error) {
                console.error('[PhotoManager] Erreur lors du vote:', error);
                res.status(500).json({ error: "Erreur lors du vote" });
            }
        });
        // Route pour ajouter des points à un joueur (par son ID)
        app.post('/api/players/add-points', async (req, res) => {
            const { playerId, points } = req.body;
            if (!playerId || typeof points !== "number") {
                return res.status(400).json({ error: "Données invalides" });
            }

            const db = await this.db.connectToDatabase();
            const playersCollection = db.collection('players');
            const player = await playersCollection.findOne({ _id: require('mongodb').ObjectId(playerId) });
            if (!player) return res.status(404).json({ error: "Joueur non trouvé" });

            await playersCollection.updateOne(
                { _id: player._id },
                { $inc: { totalScore: points } }
            );
            res.json({ success: true, newTotalScore: (player.totalScore || 0) + points });
        });

        /*app.post('/api/photos/:id/vote', async (req, res) => {
            const { id } = req.params;
            const db = await this.db.connectToDatabase();
            const photosCollection = db.collection('photos');

            try {
                // Récupérer la photo pour connaître l'uploader
                const photo = await photosCollection.findOne({ _id: new ObjectId(id) });
                if (!photo) {
                    return res.status(404).json({ error: "Photo non trouvée" });
                }

                // Incrémenter le nombre de votes
                const updateResult = await photosCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $inc: { votes: 1 } }
                );

                if (updateResult.matchedCount === 0) {
                    return res.status(404).json({ error: "Photo non trouvée" });
                }

                // ✅ NOUVEAU : Attribuer 1 point au propriétaire de la photo
                if (photo.uploader && photo.uploader.trim() !== "" && photo.uploader.toLowerCase() !== "inconnu") {
                    console.log(`[PhotoManager] Attribution d'1 point pour like sur photo de ${photo.uploader}`);

                    try {
                        // Trouver l'ID du joueur par son pseudo
                        const playersCollection = db.collection('players');
                        const uploaderPlayer = await playersCollection.findOne({
                            pseudo: { $regex: new RegExp(`^${photo.uploader.trim()}$`, 'i') }
                        });

                        if (uploaderPlayer) {
                            // Ajoute 1 point au joueur uploader
                            const updatePlayer = await playersCollection.updateOne(
                                { _id: uploaderPlayer._id },
                                { $inc: { points: 1 } }
                            );

                            if (updatePlayer.matchedCount > 0) {
                                const newTotalScore = (uploaderPlayer.points || 0) + 1;
                                res.json({
                                    success: true,
                                    newVotes: photo.votes + 1,
                                    pointsAwarded: {
                                        uploader: photo.uploader,
                                        pointsEarned: 1,
                                        newTotalScore
                                    }
                                });
                            } else {
                                res.json({ success: true, newVotes: photo.votes + 1 });
                            }

                            if (response.ok) {
                                const result = await response.json();
                                console.log(`[PhotoManager] Point attribué à ${photo.uploader}: ${result.newTotalScore} points total`);

                                res.json({
                                    success: true,
                                    newVotes: photo.votes + 1,
                                    pointsAwarded: {
                                        uploader: photo.uploader,
                                        pointsEarned: 1,
                                        newTotalScore: result.newTotalScore
                                    }
                                });
                            } else {
                                console.error(`[PhotoManager] Erreur API points: ${response.status}`);
                                res.json({ success: true, newVotes: photo.votes + 1 });
                            }
                        } else {
                            console.warn(`[PhotoManager] Joueur "${photo.uploader}" non trouvé en base`);
                            res.json({ success: true, newVotes: photo.votes + 1 });
                        }
                    } catch (pointsError) {
                        console.error('[PhotoManager] Erreur lors de l\'attribution des points:', pointsError);
                        res.json({ success: true, newVotes: photo.votes + 1 });
                    }
                } else {
                    console.log(`[PhotoManager] Like sur photo sans uploader valide: "${photo.uploader}"`);
                    res.json({ success: true, newVotes: photo.votes + 1 });
                }

            } catch (error) {
                console.error('[PhotoManager] Erreur lors du vote:', error);
                res.status(500).json({ error: "Erreur lors du vote" });
            }
        });

        */
        // Route pour récupérer les photos
        app.get('/api/photos', async (req, res) => {
            try {
                const db = await this.db.connectToDatabase();
                const photosCollection = db.collection('photos');
                const date = req.query.date;
                let filter = {};
                if (date) filter.dateTaken = date;
                const photos = await photosCollection.find(filter).toArray();
                res.json({ photos });
            } catch (err) {
                console.error("Erreur lors de la récupération des photos:", err);
                res.status(500).json({ photos: [] });
            }
        });

        // Route pour supprimer une photo
        app.delete('/api/photos/:id', async (req, res) => {
            try {
                const db = await this.db.connectToDatabase();
                const photosCollection = db.collection('photos');
                const { id } = req.params;
                const photo = await photosCollection.findOne({ _id: new ObjectId(id) });
                if (!photo) return res.status(404).json({ error: "Photo introuvable" });

                // Supprimer le fichier physique si besoin
                const filePath = path.join(__dirname, "../public", "photos", photo.filename);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

                await photosCollection.deleteOne({ _id: new ObjectId(id) });
                res.json({ success: true });
            } catch (err) {
                res.status(500).json({ error: "Erreur lors de la suppression" });
            }
        });
    }
}

module.exports = PhotoManager;