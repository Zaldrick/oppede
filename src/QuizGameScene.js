import Phaser from 'phaser';
import MusicManager from './MusicManager.js';

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
        this.hasAnswered = false;
        this.selectedAnswer = null;
        this.gameState = 'waiting'; // waiting, question, results, finished
        this.currentContainer = null;
    }

    init(data) {
        this.isHost = data.isHost || false;
        this.gameId = data.gameId || this.generateGameId();
        this.playerId = data.playerId;
        this.playerName = data.playerName;
        this.gameData = data.gameData || {};
        this.players = this.gameData.players || [];
        this.socket = this.registry.get("socket");
        this.questions = [];
        this.currentRound = 1;
        this.totalRounds = 10;
    }

    create() {
        console.log('[Quiz Game] Données reçues:', this.gameData);
        console.log('[Quiz Game] Mode de jeu:', this.gameData?.gameMode);
        
        // Toujours lancer le quiz interactif (plus de mode "développement")
        this.gameState = 'waiting';
        this.setupSocketEvents();
        this.showWaitingForStart();
    }

    showWaitingForStart() {
        const { width, height } = this.sys.game.canvas;
        
        // Calculs adaptatifs pour mobile
        const baseSize = Math.min(width, height);
        const titleSize = Math.min(baseSize * 0.1, 60);
        const subtitleSize = Math.min(baseSize * 0.06, 32);
        const textSize = Math.min(baseSize * 0.04, 24);

        // Fond avec dégradé et effets
        const bgMain = this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e, 0.95);
        const bgOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x667eea, 0.1);

        // Particules d'arrière-plan
        for (let i = 0; i < 15; i++) {
            const particle = this.add.circle(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(0, height),
                Phaser.Math.Between(3, 12),
                0x8b5cf6,
                0.4
            );
            
            this.tweens.add({
                targets: particle,
                x: particle.x + Phaser.Math.Between(-100, 100),
                y: particle.y + Phaser.Math.Between(-100, 100),
                alpha: 0.1,
                duration: Phaser.Math.Between(3000, 8000),
                repeat: -1,
                yoyo: true,
                ease: 'Sine.easeInOut'
            });
        }

        // Titre principal avec effet brillant
        const mainTitle = this.add.text(width / 2, height * 0.2, "🧠 QUIZ READY!", {
            font: `bold ${titleSize}px Arial`,
            fill: "#ffffff",
            stroke: "#8b5cf6",
            strokeThickness: 4,
            align: "center"
        }).setOrigin(0.5);

        // Animation pulsante du titre
        this.tweens.add({
            targets: mainTitle,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Message d'attente
        const waitingText = this.add.text(width / 2, height * 0.5, "🚀 Le quiz va commencer...\nPréparez-vous !", {
            font: `${subtitleSize}px Arial`,
            fill: "#fbbf24",
            align: "center"
        }).setOrigin(0.5);

        // Animation de pulsation
        this.tweens.add({
            targets: waitingText,
            alpha: 0.6,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Bouton retour
        const backContainer = this.add.container(width / 2, height * 0.88);
        
        const backBg = this.add.rectangle(0, 0, width * 0.6, height * 0.08, 0x6b7280, 0.9)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
        
        const backBorder = this.add.rectangle(0, 0, width * 0.6 + 4, height * 0.08 + 4, 0x9ca3af, 0.5)
            .setOrigin(0.5);

        const backIcon = this.add.text(-width * 0.2, 0, "🚪", {
            font: `${textSize}px Arial`,
            align: "center"
        }).setOrigin(0.5);

        const backText = this.add.text(width * 0.05, 0, "RETOUR AU LOBBY", {
            font: `bold ${textSize}px Arial`, showQuestion
            fill: "#ffffff",
            align: "center"
        }).setOrigin(0.5);

        backContainer.add([backBorder, backBg, backIcon, backText]);

        // Effets d'interaction pour le bouton retour
        backBg.on('pointerover', () => {
            backContainer.setScale(1.05);
            // backBg.setTint(0x9ca3af); // ← Retirer cette ligne
        });

        backBg.on('pointerout', () => {
            backContainer.setScale(1);
            // backBg.clearTint(); // ← Retirer cette ligne
        });

        backBg.on('pointerdown', () => {
            this.tweens.add({
                targets: backContainer,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 100,
                yoyo: true,
                ease: 'Power2',
                onComplete: () => {
                    this.returnToLobby();
                }
            });
        });

        // Musique de quiz
        MusicManager.play(this, 'music1', { loop: true, volume: 0.3 });
    }

    setupSocketEvents() {
        // Démarrage du quiz
        this.socket.on('quiz:gameStarted', (data) => {
            console.log('[Quiz] Jeu démarré avec', data.gameInfo);
            this.gameState = 'starting';
            this.showGameStarting(data.gameInfo);
        });

        // Nouvelle question
        this.socket.on('quiz:questionStart', (data) => {
            console.log('[Quiz] Nouvelle question:', data.question.question);
            this.currentQuestion = data.question;
            this.questionNumber = data.questionNumber;
            this.totalQuestions = data.totalQuestions;
            this.timeLeft = data.timeLimit || 30;
            this.hasAnswered = false;
            this.selectedAnswer = null;
            this.gameState = 'question';
            this.showQuestion();
        });

        // Réponse reçue par le serveur
        this.socket.on('quiz:answerReceived', (data) => {
            console.log('[Quiz] Réponse enregistrée');
            this.showWaitingForOthers(data.answersReceived, data.totalPlayers);
        });

        // En attente des autres joueurs
        this.socket.on('quiz:waitingForAnswers', (data) => {
            if (this.hasAnswered) {
                this.updateWaitingDisplay(data.answersReceived, data.totalPlayers);
            }
        });

        // Résultats de la question
        this.socket.on('quiz:roundResults', (data) => {
            console.log('[Quiz] Résultats reçus:', data);
            this.gameState = 'results';
            this.showRoundResults(data);
        });

        // Fin du jeu
        this.socket.on('quiz:gameEnd', (data) => {
            console.log('[Quiz] Fin du jeu:', data);
            this.gameState = 'finished';
            this.gameEnded = true;
            this.showFinalResults(data);
        });

        // Si la partie est annulée ou un joueur quitte
        this.socket.on('quiz:gameAborted', () => {
            this.returnToLobby();
        });
    }

    showGameStarting(gameInfo) {
        this.clearScreen();
        
        const { width, height } = this.sys.game.canvas;
        const baseSize = Math.min(width, height);
        const titleSize = Math.min(baseSize * 0.08, 48);
        const textSize = Math.min(baseSize * 0.04, 24);

        // Container principal
        this.currentContainer = this.add.container(width / 2, height / 2);

        // Titre du quiz
        const title = this.add.text(0, -height * 0.2, "🧠 QUIZ COMMENCE !", {
            font: `bold ${titleSize}px Arial`,
            fill: "#ffffff",
            stroke: "#8b5cf6",
            strokeThickness: 4,
            align: "center"
        }).setOrigin(0.5);

        // Informations du jeu
        const infos = [
            `📚 Catégories: ${gameInfo.categories.join(', ')}`,
            `🎯 Difficulté: ${gameInfo.difficulty}`,
            `❓ Questions: ${gameInfo.totalQuestions}`,
            `👥 Joueurs: ${this.players.length}`
        ];

        infos.forEach((info, index) => {
            const infoText = this.add.text(0, -height * 0.05 + index * (textSize * 1.5), info, {
                font: `${textSize}px Arial`,
                fill: "#a78bfa",
                align: "center"
            }).setOrigin(0.5);
            this.currentContainer.add(infoText);
        });

        // Compte à rebours
        let countdown = 3;
        const countdownText = this.add.text(0, height * 0.15, countdown, {
            font: `bold ${titleSize * 2}px Arial`,
            fill: "#fbbf24",
            stroke: "#000000",
            strokeThickness: 6,
            align: "center"
        }).setOrigin(0.5);

        this.currentContainer.add([title, countdownText]);

        // Animation du compte à rebours
        const countdownTimer = this.time.addEvent({
            delay: 1000,
            callback: () => {
                countdown--;
                if (countdown > 0) {
                    countdownText.setText(countdown);
                    this.tweens.add({
                        targets: countdownText,
                        scaleX: 1.2,
                        scaleY: 1.2,
                        duration: 200,
                        yoyo: true,
                        ease: 'Power2'
                    });
                } else {
                    countdownText.setText("GO !");
                    this.tweens.add({
                        targets: countdownText,
                        scaleX: 1.5,
                        scaleY: 1.5,
                        alpha: 0,
                        duration: 500,
                        ease: 'Power2'
                    });
                    countdownTimer.destroy();
                }
            },
            repeat: 3
        });
    }
    showQuestion() {
        this.clearScreen();

        const { width, height } = this.sys.game.canvas;
        const baseSize = Math.min(width, height);
        const questionSize = Math.min(baseSize * 0.05, 30);
        const answerSize = Math.min(baseSize * 0.04, 24);

        // Container principal
        this.currentContainer = this.add.container(0, 0);

        // Ajouter un fond opaque pour améliorer la lisibilité
        const backgroundOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
            .setOrigin(0.5);

        // Barre de progression
        const progressBg = this.add.rectangle(width / 2, height * 0.08, width * 0.8, 8, 0x333333)
            .setOrigin(0.5);
        const progressBar = this.add.rectangle(width / 2, height * 0.08, 0, 8, 0x10b981)
            .setOrigin(0.5);

        const progressWidth = (this.questionNumber / this.totalQuestions) * width * 0.8;
        this.tweens.add({
            targets: progressBar,
            width: progressWidth,
            duration: 500,
            ease: 'Power2'
        });

        // Numéro de question et catégorie
        const questionHeader = this.add.text(width / 2, height * 0.15,
            `Question ${this.questionNumber}/${this.totalQuestions} • ${this.currentQuestion.category}`, {
            font: `bold ${answerSize}px Arial`,
            fill: "#a78bfa",
            align: "center"
        }).setOrigin(0.5);

        // Question avec fond semi-transparent pour plus de lisibilité
        const questionBg = this.add.rectangle(width / 2, height * 0.25, width * 0.95, height * 0.15, 0x2d3748, 0.9)
            .setOrigin(0.5);

        const questionBorder = this.add.rectangle(width / 2, height * 0.25, width * 0.95 + 4, height * 0.15 + 4, 0x4f46e5, 0.6)
            .setOrigin(0.5);

        const questionText = this.add.text(width / 2, height * 0.25, this.currentQuestion.question, {
            font: `bold ${questionSize}px Arial`,
            fill: "#ffffff",
            align: "center",
            wordWrap: { width: width * 0.85 }
        }).setOrigin(0.5);

        // Timer circulaire
        this.createTimerCircle(width * 0.9, height * 0.15);

        // Réponses
        this.answerButtons = [];
        const answerColors = [0x3b82f6, 0x10b981, 0xf59e0b, 0xef4444]; // Bleu, Vert, Orange, Rouge
        const buttonWidth = width * 0.42;
        const buttonHeight = height * 0.08;
        const spacing = 20;

        this.currentQuestion.answers.forEach((answer, index) => {
            const row = Math.floor(index / 2);
            const col = index % 2;
            const x = width / 2 + (col === 0 ? -buttonWidth / 2 - spacing / 2 : buttonWidth / 2 + spacing / 2);
            const y = height * 0.5 + row * (buttonHeight + spacing);

            const answerContainer = this.add.container(x, y);

            const answerBg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, answerColors[index], 0.9)
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });

            const answerBorder = this.add.rectangle(0, 0, buttonWidth + 4, buttonHeight + 4, 0xffffff, 0.4)
                .setOrigin(0.5);

            const answerLabel = this.add.text(-buttonWidth * 0.4, 0, String.fromCharCode(65 + index), {
                font: `bold ${answerSize * 1.2}px Arial`,
                fill: "#ffffff",
                align: "center",
                stroke: "#000000",
                strokeThickness: 2
            }).setOrigin(0.5);

            const answerTextObj = this.add.text(-buttonWidth * 0.1, 0, answer, {
                font: `${answerSize}px Arial`,
                fill: "#ffffff",
                align: "left",
                wordWrap: { width: buttonWidth * 0.6 },
                stroke: "#000000",
                strokeThickness: 1
            }).setOrigin(0, 0.5);

            answerContainer.add([answerBorder, answerBg, answerLabel, answerTextObj]);

            // Interaction
            answerBg.on('pointerover', () => {
                if (!this.hasAnswered) {
                    answerContainer.setScale(1.05);
                }
            });

            answerBg.on('pointerout', () => {
                if (!this.hasAnswered) {
                    answerContainer.setScale(1);
                }
            });

            answerBg.on('pointerdown', () => {
                if (!this.hasAnswered) {
                    this.selectAnswer(index, answerContainer, answerBg);
                }
            });

            this.answerButtons.push({ container: answerContainer, bg: answerBg, index });
        });

        // Ajouter tous les éléments au container principal avec le fond en premier
        this.currentContainer.add([
            backgroundOverlay, // Fond opaque en premier
            progressBg,
            progressBar,
            questionHeader,
            questionBorder,
            questionBg,
            questionText,
            ...this.answerButtons.map(a => a.container)
        ]);

        // Démarrer le timer
        this.startQuestionTimer();
    }

    createTimerCircle(x, y) {
        const radius = 30;
        
        // Cercle de fond
        this.timerBg = this.add.circle(x, y, radius, 0x333333, 0.8);
        
        // Texte du timer
        this.timerText = this.add.text(x, y, this.timeLeft, {
            font: `bold 24px Arial`,
            fill: "#ffffff",
            align: "center"
        }).setOrigin(0.5);

        // Cercle de progression
        this.timerCircle = this.add.graphics()
            .setPosition(x, y);

        this.currentContainer.add([this.timerBg, this.timerText, this.timerCircle]);
    }

    startQuestionTimer() {
        this.timeLeft = 30;
        
        if (this.timer) {
            this.timer.destroy();
        }

        this.timer = this.time.addEvent({
            delay: 1000,
            callback: () => {
                this.timeLeft--;
                this.updateTimer();
                
                if (this.timeLeft <= 0 && !this.hasAnswered) {
                    this.timer.destroy();
                    // Temps écoulé, soumission automatique avec réponse -1 (pas de réponse)
                    this.submitAnswer(-1);
                }
            },
            repeat: 29
        });
    }

    updateTimer() {
        if (this.timerText) {
            this.timerText.setText(this.timeLeft);
            
            // Change la couleur selon le temps restant
            if (this.timeLeft <= 5) {
                this.timerText.setTint(0xff0000);
            } else if (this.timeLeft <= 10) {
                this.timerText.setTint(0xffa500);
            }
        }

        // Dessine le cercle de progression
        if (this.timerCircle) {
            const angle = (this.timeLeft / 30) * 360;
            this.timerCircle.clear();
            this.timerCircle.lineStyle(6, this.timeLeft <= 5 ? 0xff0000 : this.timeLeft <= 10 ? 0xffa500 : 0x10b981);
            this.timerCircle.beginPath();
            this.timerCircle.arc(0, 0, 30, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + angle), false);
            this.timerCircle.strokePath();
        }
    }

    selectAnswer(answerIndex, container, bg) {
        if (this.hasAnswered) return;

        this.hasAnswered = true;
        this.selectedAnswer = answerIndex;

        // Surligne la réponse sélectionnée - SANS setTint
        // bg.setTint(0xffff00); // ← Retirer cette ligne
        container.setScale(1.1);

        // Désactive les autres boutons
        this.answerButtons.forEach(({ container: otherContainer, bg: otherBg }) => {
            if (otherContainer !== container) {
                otherContainer.setAlpha(0.5);
                otherBg.disableInteractive();
            }
        });

        // Arrête le timer
        if (this.timer) {
            this.timer.destroy();
        }

        // Envoie la réponse au serveur
        this.submitAnswer(answerIndex);
    }

    submitAnswer(answerIndex) {
        console.log(`[Quiz] Soumission réponse: ${answerIndex}`);
        
        this.socket.emit('quiz:submitAnswer', {
            gameId: this.gameId,
            playerId: this.playerId,
            answer: answerIndex,
            timeRemaining: this.timeLeft
        });
    }

    showWaitingForOthers(answersReceived, totalPlayers) {
        // Ajoute un message d'attente
        const { width, height } = this.sys.game.canvas;
        
        if (this.waitingText) {
            this.waitingText.destroy();
        }

        this.waitingText = this.add.text(width / 2, height * 0.75, 
            `⏳ En attente des autres joueurs... (${answersReceived}/${totalPlayers})`, {
            font: `bold 24px Arial`,
            fill: "#fbbf24",
            align: "center"
        }).setOrigin(0.5);

        this.currentContainer.add(this.waitingText);

        // Animation de pulsation
        this.tweens.add({
            targets: this.waitingText,
            alpha: 0.6,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    updateWaitingDisplay(answersReceived, totalPlayers) {
        if (this.waitingText) {
            this.waitingText.setText(`⏳ En attente des autres joueurs... (${answersReceived}/${totalPlayers})`);
        }
    }

    showRoundResults(data) {
        this.clearScreen();
        
        const { width, height } = this.sys.game.canvas;
        const baseSize = Math.min(width, height);
        const titleSize = Math.min(baseSize * 0.06, 36);
        const textSize = Math.min(baseSize * 0.04, 24);

        this.currentContainer = this.add.container(0, 0);

        // Affiche d'abord la réponse du joueur
        if (this.selectedAnswer !== null) {
            this.showPlayerAnswer(data);
        }

        // Puis affiche la bonne réponse après 1.5 secondes
        this.time.delayedCall(1500, () => {
            this.showCorrectAnswer(data);
        });

        // Enfin affiche le classement après 3 secondes
        this.time.delayedCall(3000, () => {
            this.showLeaderboard(data.leaderboard);
        });
    }

    showPlayerAnswer(data) {
        const { width, height } = this.sys.game.canvas;
        const baseSize = Math.min(width, height);
        const titleSize = Math.min(baseSize * 0.06, 36);

        const isCorrect = this.selectedAnswer === data.correctAnswer;
        const resultText = isCorrect ? "✅ CORRECT !" : "❌ INCORRECT !";
        const resultColor = isCorrect ? "#10b981" : "#ef4444";

        const resultTitle = this.add.text(width / 2, height * 0.3, resultText, {
            font: `bold ${titleSize}px Arial`,
            fill: resultColor,
            stroke: "#000000",
            strokeThickness: 4,
            align: "center"
        }).setOrigin(0.5);

        // Si incorrect, affiche la réponse du joueur en rouge
        if (!isCorrect && this.selectedAnswer >= 0) {
            const playerAnswerText = this.add.text(width / 2, height * 0.4, 
                `Votre réponse: ${this.currentQuestion.answers[this.selectedAnswer]}`, {
                font: `${titleSize * 0.7}px Arial`,
                fill: "#ef4444",
                align: "center"
            }).setOrigin(0.5);
            this.currentContainer.add(playerAnswerText);
        } else if (this.selectedAnswer < 0) {
            const noAnswerText = this.add.text(width / 2, height * 0.4, "Temps écoulé !", {
                font: `${titleSize * 0.7}px Arial`,
                fill: "#6b7280",
                align: "center"
            }).setOrigin(0.5);
            this.currentContainer.add(noAnswerText);
        }

        this.currentContainer.add(resultTitle);

        // Animation d'apparition
        this.tweens.add({
            targets: resultTitle,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 300,
            yoyo: true,
            ease: 'Power2'
        });
    }

    showCorrectAnswer(data) {
        const { width, height } = this.sys.game.canvas;
        const baseSize = Math.min(width, height);
        const titleSize = Math.min(baseSize * 0.06, 36);

        const correctAnswerText = this.add.text(width / 2, height * 0.55, 
            `💡 Bonne réponse: ${data.correctAnswerText}`, {
            font: `bold ${titleSize * 0.8}px Arial`,
            fill: "#10b981",
            stroke: "#000000",
            strokeThickness: 3,
            align: "center",
            wordWrap: { width: width * 0.9 }
        }).setOrigin(0.5);

        this.currentContainer.add(correctAnswerText);

        // Animation d'apparition
        this.tweens.add({
            targets: correctAnswerText,
            alpha: { from: 0, to: 1 },
            y: { from: height * 0.6, to: height * 0.55 },
            duration: 500,
            ease: 'Power2'
        });
    }

    showLeaderboard(leaderboard) {
        const { width, height } = this.sys.game.canvas;
        const baseSize = Math.min(width, height);
        const textSize = Math.min(baseSize * 0.035, 20);

        const leaderTitle = this.add.text(width / 2, height * 0.7, "🏆 CLASSEMENT", {
            font: `bold ${textSize * 1.5}px Arial`,
            fill: "#fbbf24",
            align: "center"
        }).setOrigin(0.5);

        const maxVisible = Math.min(5, leaderboard.length);
        leaderboard.slice(0, maxVisible).forEach((player, index) => {
            const y = height * 0.75 + index * (textSize * 1.3);
            const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
            const isCurrentPlayer = player.id === this.playerId;
            
            const playerText = this.add.text(width / 2, y, 
                `${medal} ${player.name}: ${player.score} pts`, {
                font: `${isCurrentPlayer ? 'bold' : ''} ${textSize}px Arial`,
                fill: isCurrentPlayer ? "#fbbf24" : "#ffffff",
                align: "center"
            }).setOrigin(0.5);

            this.currentContainer.add(playerText);

            // Animation d'apparition
            this.tweens.add({
                targets: playerText,
                alpha: { from: 0, to: 1 },
                x: { from: width * 0.3, to: width / 2 },
                duration: 300,
                delay: index * 100,
                ease: 'Power2'
            });
        });

        this.currentContainer.add(leaderTitle);
    }

    showFinalResults(data) {
        this.clearScreen();
        
        const { width, height } = this.sys.game.canvas;
        const baseSize = Math.min(width, height);
        const titleSize = Math.min(baseSize * 0.08, 48);
        const textSize = Math.min(baseSize * 0.04, 24);

        this.currentContainer = this.add.container(0, 0);

        // Titre
        const title = this.add.text(width / 2, height * 0.15, "🎉 QUIZ TERMINÉ !", {
            font: `bold ${titleSize}px Arial`,
            fill: "#ffffff",
            stroke: "#8b5cf6",
            strokeThickness: 4,
            align: "center"
        }).setOrigin(0.5);

        // Podium
        const podiumTitle = this.add.text(width / 2, height * 0.25, "🏆 PODIUM", {
            font: `bold ${textSize * 1.3}px Arial`,
            fill: "#fbbf24",
            align: "center"
        }).setOrigin(0.5);

        // Affiche le top 3
        data.podium.forEach((player, index) => {
            const y = height * 0.35 + index * (textSize * 1.8);
            const isCurrentPlayer = player.id === this.playerId;
            
            const podiumText = this.add.text(width / 2, y, 
                `${player.medal} ${player.name}: ${player.score} points`, {
                font: `${isCurrentPlayer ? 'bold' : ''} ${textSize * (index === 0 ? 1.3 : index === 1 ? 1.1 : 1)}px Arial`,
                fill: isCurrentPlayer ? "#fbbf24" : index === 0 ? "#ffd700" : index === 1 ? "#c0c0c0" : "#cd7f32",
                stroke: "#000000",
                strokeThickness: 2,
                align: "center"
            }).setOrigin(0.5);

            this.currentContainer.add(podiumText);
        });

        // Bouton quitter
        const quitButton = this.createQuitButton(width / 2, height * 0.85);

        this.currentContainer.add([title, podiumTitle, quitButton]);

        // Animation finale
        this.tweens.add({
            targets: title,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    createQuitButton(x, y) {
        const { width, height } = this.sys.game.canvas;
        const buttonWidth = width * 0.5;
        const buttonHeight = height * 0.08;

        const buttonContainer = this.add.container(x, y);

        const buttonBg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x6b7280, 0.9)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        const buttonBorder = this.add.rectangle(0, 0, buttonWidth + 4, buttonHeight + 4, 0x9ca3af, 0.5)
            .setOrigin(0.5);

        const buttonIcon = this.add.text(-buttonWidth * 0.2, 0, "🚪", {
            font: `24px Arial`,
            align: "center"
        }).setOrigin(0.5);

        const buttonText = this.add.text(buttonWidth * 0.05, 0, "QUITTER LE QUIZ", {
            font: `bold 24px Arial`,
            fill: "#ffffff",
            align: "center"
        }).setOrigin(0.5);

        buttonContainer.add([buttonBorder, buttonBg, buttonIcon, buttonText]);

        // Interaction
        buttonBg.on('pointerover', () => {
            buttonContainer.setScale(1.05);
        });

        buttonBg.on('pointerout', () => {
            buttonContainer.setScale(1);
        });

        buttonBg.on('pointerdown', () => {
            this.tweens.add({
                targets: buttonContainer,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 100,
                yoyo: true,
                ease: 'Power2',
                onComplete: () => {
                    this.returnToLobby();
                }
            });
        });

        return buttonContainer;
    }

    clearScreen() {
        if (this.currentContainer) {
            this.currentContainer.destroy(true);
            this.currentContainer = null;
        }
        
        if (this.waitingText) {
            this.waitingText.destroy();
            this.waitingText = null;
        }

        if (this.timer) {
            this.timer.destroy();
            this.timer = null;
        }

        this.children.removeAll();
    }

    returnToLobby() {
        // Nettoyer les événements socket
        if (this.socket) {
            this.socket.off('quiz:gameStarted');
            this.socket.off('quiz:questionStart');
            this.socket.off('quiz:answerReceived');
            this.socket.off('quiz:waitingForAnswers');
            this.socket.off('quiz:roundResults');
            this.socket.off('quiz:gameEnd');
            this.socket.off('quiz:gameAborted');
        }

        // Arrêter la musique
        MusicManager.stop();
        
        // Retourner directement à GameScene au lieu du lobby de quiz
        this.scene.stop();
        this.scene.resume("GameScene");
    }

    generateGameId() {
        return `quiz-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
}