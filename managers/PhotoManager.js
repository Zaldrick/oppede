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

        // Route pour voter sur une photo
        app.post('/api/photos/:id/vote', async (req, res) => {
            const { id } = req.params;
            const db = await this.db.connectToDatabase();
            const photosCollection = db.collection('photos');

            const updateResult = await photosCollection.updateOne(
                { _id: new ObjectId(id) },
                { $inc: { votes: 1 } }
            );
            if (updateResult.matchedCount === 0) {
                return res.status(404).json({ error: "Photo not found" });
            }
            res.sendStatus(200);
        });

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