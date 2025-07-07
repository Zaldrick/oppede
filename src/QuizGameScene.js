import { MusicManager } from './managers/MusicManager.js';

export class QuizGameScene extends Phaser.Scene {
    constructor() {
        super("QuizGameScene");
        this.players = [];
        this.currentQuestion = null;
        this.questionIndex = 0;
        this.gameEnded = false;
        this.playerAnswers = {};
        this.timeLeft = 30;
        this.timer = null;
    }

    init(data) {
        this.isHost = data.isHost || false;
        this.gameId = data.gameId || this.generateGameId();
        this.playerId = data.playerId;
        this.playerName = data.playerName;
        this.maxPlayers = data.maxPlayers || 6;
        this.socket = this.registry.get("socket");
        this.questions = [];
        this.currentRound = 1;
        this.totalRounds = 10;
    }

    create() {
        const { width, height } = this.sys.game.canvas;
        this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e, 0.95);

        if (this.isHost) {
            this.setupHostEvents();
        } else {
            this.setupPlayerEvents();
        }

        this.setupSocketEvents();
        MusicManager.play(this, 'quizMusic', { loop: true, volume: 0.3 });
    }

    setupSocketEvents() {
        this.socket.on('quiz:gameReady', (data) => {
            this.players = data.players;
            this.drawWaitingRoom();
        });

        this.socket.on('quiz:questionStart', (data) => {
            this.currentQuestion = data.question;
            this.timeLeft = data.timeLimit || 30;
            this.showQuestion();
            this.startTimer();
        });

        this.socket.on('quiz:roundResults', (data) => {
            this.showRoundResults(data.results, data.correctAnswer);
        });

        this.socket.on('quiz:gameEnd', (data) => {
            this.showFinalResults(data.finalScores);
        });
    }

    drawWaitingRoom() {
        const { width, height } = this.sys.game.canvas;
        
        this.add.text(width / 2, height * 0.1, `Quiz de Culture Générale`, {
            font: "bold 32px Arial", fill: "#fff"
        }).setOrigin(0.5);

        this.add.text(width / 2, height * 0.2, `Salle d'attente (${this.players.length}/${this.maxPlayers})`, {
            font: "24px Arial", fill: "#ffd700"
        }).setOrigin(0.5);

        // Affichage des joueurs
        this.players.forEach((player, index) => {
            const y = height * 0.3 + (index * 40);
            this.add.text(width / 2, y, `${player.name} - Score: ${player.score || 0}`, {
                font: "18px Arial", fill: "#fff"
            }).setOrigin(0.5);
        });

        if (this.isHost && this.players.length >= 2) {
            const startButton = this.add.text(width / 2, height * 0.8, "COMMENCER LA PARTIE", {
                font: "bold 24px Arial", fill: "#00ff00",
                backgroundColor: "#333", padding: { x: 20, y: 10 }
            }).setOrigin(0.5).setInteractive();

            startButton.on('pointerdown', () => {
                this.socket.emit('quiz:startGame', { gameId: this.gameId });
            });
        }
    }

    showQuestion() {
        this.children.removeAll();
        const { width, height } = this.sys.game.canvas;

        // Fond de question
        this.add.rectangle(width / 2, height / 2, width * 0.9, height * 0.8, 0x2c2c54, 0.9)
            .setStrokeStyle(4, 0x4CAF50);

        // Timer
        this.timerText = this.add.text(width * 0.9, height * 0.1, `${this.timeLeft}s`, {
            font: "bold 24px Arial", fill: "#ff4444"
        }).setOrigin(1, 0.5);

        // Question
        this.add.text(width / 2, height * 0.25, this.currentQuestion.question, {
            font: "bold 20px Arial", fill: "#fff",
            wordWrap: { width: width * 0.8 }
        }).setOrigin(0.5);

        // Réponses
        this.currentQuestion.answers.forEach((answer, index) => {
            const x = width / 2;
            const y = height * 0.4 + (index * 60);
            
            const answerButton = this.add.text(x, y, `${String.fromCharCode(65 + index)}. ${answer}`, {
                font: "18px Arial", fill: "#fff",
                backgroundColor: "#444", padding: { x: 15, y: 10 }
            }).setOrigin(0.5).setInteractive();

            answerButton.on('pointerdown', () => {
                this.submitAnswer(index);
            });
        });
    }

    submitAnswer(answerIndex) {
        if (this.playerAnswers[this.playerId]) return; // Déjà répondu

        this.playerAnswers[this.playerId] = answerIndex;
        this.socket.emit('quiz:submitAnswer', {
            gameId: this.gameId,
            playerId: this.playerId,
            answer: answerIndex,
            timeRemaining: this.timeLeft
        });

        // Feedback visuel
        this.add.text(this.sys.game.canvas.width / 2, this.sys.game.canvas.height * 0.8, 
            "Réponse envoyée !", {
            font: "bold 18px Arial", fill: "#00ff00"
        }).setOrigin(0.5);
    }

    startTimer() {
        this.timer = this.time.addEvent({
            delay: 1000,
            callback: () => {
                this.timeLeft--;
                this.timerText.setText(`${this.timeLeft}s`);
                
                if (this.timeLeft <= 0) {
                    this.timer.destroy();
                    if (!this.playerAnswers[this.playerId]) {
                        this.submitAnswer(-1); // Pas de réponse
                    }
                }
            },
            repeat: this.timeLeft - 1
        });
    }

    showRoundResults(results, correctAnswer) {
        this.children.removeAll();
        const { width, height } = this.sys.game.canvas;

        this.add.text(width / 2, height * 0.2, "Résultats du round", {
            font: "bold 28px Arial", fill: "#ffd700"
        }).setOrigin(0.5);

        this.add.text(width / 2, height * 0.3, 
            `Bonne réponse: ${String.fromCharCode(65 + correctAnswer)}`, {
            font: "20px Arial", fill: "#00ff00"
        }).setOrigin(0.5);

        // Classement
        results.forEach((player, index) => {
            const y = height * 0.4 + (index * 30);
            const color = index === 0 ? "#ffd700" : "#fff";
            this.add.text(width / 2, y, 
                `${index + 1}. ${player.name} - ${player.score} pts`, {
                font: "18px Arial", fill: color
            }).setOrigin(0.5);
        });

        this.time.delayedCall(3000, () => {
            if (this.currentRound < this.totalRounds) {
                this.currentRound++;
                // Attendre la prochaine question
            }
        });
    }

    generateGameId() {
        return `quiz-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
}