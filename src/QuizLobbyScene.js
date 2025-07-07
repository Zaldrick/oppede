export class QuizLobbyScene extends Phaser.Scene {
    constructor() {
        super("QuizLobbyScene");
    }

    init(data) {
        this.playerId = data.playerId;
        this.playerName = data.playerName || "Joueur";
        this.socket = this.registry.get("socket");
    }

    create() {
        const { width, height } = this.sys.game.canvas;
        this.add.rectangle(width / 2, height / 2, width, height, 0x0f0f23, 0.95);

        this.add.text(width / 2, height * 0.1, "Quiz de Culture Générale", {
            font: "bold 36px Arial", fill: "#fff"
        }).setOrigin(0.5);

        // Créer une partie
        const createButton = this.add.text(width / 2, height * 0.4, "CRÉER UNE PARTIE", {
            font: "bold 24px Arial", fill: "#fff",
            backgroundColor: "#4CAF50", padding: { x: 20, y: 15 }
        }).setOrigin(0.5).setInteractive();

        createButton.on('pointerdown', () => {
            this.showCreateGameOptions();
        });

        // Rejoindre une partie
        const joinButton = this.add.text(width / 2, height * 0.6, "REJOINDRE UNE PARTIE", {
            font: "bold 24px Arial", fill: "#fff",
            backgroundColor: "#2196F3", padding: { x: 20, y: 15 }
        }).setOrigin(0.5).setInteractive();

        joinButton.on('pointerdown', () => {
            this.showAvailableGames();
        });

        this.setupSocketEvents();
    }

    showCreateGameOptions() {
        // Options pour créer une partie (nombre de joueurs, difficulté, etc.)
        this.children.removeAll();
        const { width, height } = this.sys.game.canvas;

        this.add.text(width / 2, height * 0.2, "Créer une partie", {
            font: "bold 28px Arial", fill: "#fff"
        }).setOrigin(0.5);

        // Sélection du nombre de joueurs
        for (let i = 2; i <= 12; i++) {
            const x = width * 0.2 + ((i - 2) % 6) * (width * 0.12);
            const y = height * 0.4 + Math.floor((i - 2) / 6) * 60;
            
            const playerButton = this.add.text(x, y, `${i}`, {
                font: "18px Arial", fill: "#fff",
                backgroundColor: "#666", padding: { x: 10, y: 5 }
            }).setOrigin(0.5).setInteractive();

            playerButton.on('pointerdown', () => {
                this.createGame(i);
            });
        }
    }

    createGame(maxPlayers) {
        const gameId = `quiz-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        
        this.socket.emit('quiz:createGame', {
            gameId,
            hostId: this.playerId,
            hostName: this.playerName,
            maxPlayers
        });

        this.scene.start("QuizGameScene", {
            gameId,
            playerId: this.playerId,
            playerName: this.playerName,
            isHost: true,
            maxPlayers
        });
    }

    setupSocketEvents() {
        this.socket.on('quiz:gamesList', (games) => {
            this.displayAvailableGames(games);
        });
    }
}