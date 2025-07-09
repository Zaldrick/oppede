class SocketManager {
    constructor(server, corsOptions) {
        this.io = require('socket.io')(server, {
            cors: {
                origin: (origin, callback) => {
                    const allowedOrigins = [
                        process.env.FRONTEND_URL,
                        "https://warband.fr",
                        "https://www.warband.fr",
                    ];
                    if (!origin || allowedOrigins.includes(origin)) {
                        callback(null, true);
                    } else {
                        callback(new Error("Not allowed by CORS"));
                    }
                },
                methods: ["GET", "POST"],
                credentials: true,
            },
        });
        
        this.managers = {};
    }

    initialize(managers) {
        this.managers = managers;
        
        this.io.on('connection', (socket) => {
            console.log(`Nouvelle connexion: ${socket.id}`);

            socket.on('connect_error', (err) => {
                console.error('Erreur de connexion Socket.IO :', err.message);
            });

            // Setup events pour tous les managers
            Object.values(this.managers).forEach(manager => {
                if (manager.setupEvents) {
                    manager.setupEvents(socket);
                }
            });

            // Gestion de la déconnexion
            socket.on('disconnect', () => {
                Object.values(this.managers).forEach(manager => {
                    if (manager.handleDisconnect) {
                        manager.handleDisconnect(socket);
                    }
                });
            });
        });

        // Démarrer la diffusion des mises à jour des joueurs
        if (this.managers.playerManager && this.managers.playerManager.startPlayersUpdateBroadcast) {
            this.managers.playerManager.startPlayersUpdateBroadcast();
        }
    }

    getIo() {
        return this.io;
    }
}

module.exports = SocketManager;