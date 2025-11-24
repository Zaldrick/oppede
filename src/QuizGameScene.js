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

    preload() {
        // Exemple : charge les fichiers audio
        this.load.audio('question', 'assets/sounds/question.mp3');
        this.load.audio('wait', 'assets/sounds/wait.mp3');
        this.load.audio('answer', 'assets/sounds/answer.mp3');
    }

    create() {
 
        
        // Créer un fond global pour tout le quiz
        this.createGlobalBackground();
        
        // Toujours lancer le quiz interactif (plus de mode "développement")
        this.gameState = 'waiting';
        this.setupSocketEvents();
        this.showWaitingForStart();
    }

    createGlobalBackground() {
        const { width, height } = this.sys.game.canvas;
        
        // Fond principal avec dégradé
        this.globalBg = this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e, 0.95)
            .setOrigin(0.5)
            .setDepth(-100); // Toujours en arrière-plan
        
        // Overlay avec effet subtil
        this.globalOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x667eea, 0.08)
            .setOrigin(0.5)
            .setDepth(-99);

        // Particules d'arrière-plan animées
        this.globalParticles = [];
        for (let i = 0; i < 25; i++) {
            const particle = this.add.circle(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(0, height),
                Phaser.Math.Between(2, 8),
                0x8b5cf6,
                0.2
            ).setDepth(-98);
            
            this.globalParticles.push(particle);
            
            this.tweens.add({
                targets: particle,
                x: particle.x + Phaser.Math.Between(-200, 200),
                y: particle.y + Phaser.Math.Between(-200, 200),
                alpha: { from: 0.2, to: 0.05 },
                duration: Phaser.Math.Between(8000, 15000),
                repeat: -1,
                yoyo: true,
                ease: 'Sine.easeInOut'
            });
        }
    }

    showWaitingForStart() {
        const { width, height } = this.sys.game.canvas;
        
        // Calculs adaptatifs pour mobile
        // const baseSize = Math.min(width, height); // not used
        const subtitleSize = Math.min(baseSize * 0.06, 32);
        const textSize = Math.min(baseSize * 0.04, 24);

        // Fond avec dégradé et effets
        this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e, 0.95);
        this.add.rectangle(width / 2, height / 2, width, height, 0x667eea, 0.1);

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
            font: `bold ${textSize}px Arial`,
            fill: "#ffffff",
            align: "center"
        }).setOrigin(0.5);

        backContainer.add([backBorder, backBg, backIcon, backText]);

        // Effets d'interaction pour le bouton retour
        backBg.on('pointerover', () => {
            backContainer.setScale(1.05);
        });

        backBg.on('pointerout', () => {
            backContainer.setScale(1);
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

    }

    setupSocketEvents() {
        // Démarrage du quiz
        this.socket.on('quiz:gameStarted', (data) => {

            this.gameState = 'starting';
            this.showGameStarting(data.gameInfo);
        });

        // Nouvelle question
        this.socket.on('quiz:questionStart', (data) => {
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
            
            this.showWaitingForOthers(data.answersReceived, data.totalPlayers);
        });

        // En attente des autres joueurs
        this.socket.on('quiz:waitingForAnswers', (data) => {
            // Afficher/mettre à jour pour tous les joueurs qui ont répondu
            if (this.hasAnswered) {
                this.updateWaitingDisplay(data.answersReceived, data.totalPlayers);
            } else {
                // Si pas encore répondu, créer l'affichage d'attente au cas où
                this.showWaitingForOthers(data.answersReceived, data.totalPlayers);
            }
        });

        // Résultats de la question
        this.socket.on('quiz:roundResults', (data) => {
            console.log('[Quiz] Résultats reçus:', data);
            this.gameState = 'results';
            this.showRoundResults(data);
        });

        // Fin du Jeux
        this.socket.on('quiz:gameEnd', (data) => {
            console.log('[Quiz] Fin du Jeux:', data);
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

        // Informations du Jeux
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

        // Numéro de question et catégorie (plus de barre de progression)
        const questionHeader = this.add.text(width / 2, height * 0.12,
            `Question ${this.questionNumber}/${this.totalQuestions} • ${this.currentQuestion.category}`, {
            font: `bold ${answerSize * 1.2}px Arial`,
            fill: "#ffffff",
            stroke: "#4f46e5",
            strokeThickness: 2,
            align: "center"
        }).setOrigin(0.5);

        // Question avec fond amélioré
        const questionBg = this.add.rectangle(width / 2, height * 0.22, width * 0.95, height * 0.15, 0x2d3748, 0.95)
            .setOrigin(0.5);

        const questionBorder = this.add.rectangle(width / 2, height * 0.22, width * 0.95 + 6, height * 0.15 + 6, 0x4f46e5, 0.8)
            .setOrigin(0.5);

        const questionText = this.add.text(width / 2, height * 0.22, this.currentQuestion.question, {
            font: `bold ${questionSize}px Arial`,
            fill: "#ffffff",
            align: "center",
            wordWrap: { width: width * 0.85 },
            stroke: "#000000",
            strokeThickness: 1
        }).setOrigin(0.5);

        // Timer circulaire mis en avant (depth élevé)
        this.createTimerCircle(width * 0.9, height * 0.12);

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
            const y = height * 0.45 + row * (buttonHeight + spacing);

            const answerContainer = this.add.container(x, y);

            const answerBg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, answerColors[index], 0.9)
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });

            const answerBorder = this.add.rectangle(0, 0, buttonWidth + 4, buttonHeight + 4, 0xffffff, 0.5)
                .setOrigin(0.5);

            const answerLabel = this.add.text(-buttonWidth * 0.4, 0, String.fromCharCode(65 + index), {
                font: `bold ${answerSize * 1.2}px Arial`,
                fill: "#ffffff",
                align: "center",
                stroke: "#000000",
                strokeThickness: 3
            }).setOrigin(0.5);

            const answerTextObj = this.add.text(-buttonWidth * 0.1, 0, answer, {
                font: `${answerSize}px Arial`,
                fill: "#ffffff",
                align: "left",
                wordWrap: { width: buttonWidth * 0.6 },
                stroke: "#000000",
                strokeThickness: 2
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

        // Ajouter tous les éléments au container principal
        this.currentContainer.add([
            questionHeader,
            questionBorder,
            questionBg,
            questionText,
            ...this.answerButtons.map(a => a.container)
        ]);

        // Démarrer le timer
        MusicManager.play(this, 'question', { loop: false, volume: 0.3 });
        this.startQuestionTimer();
    }

    createTimerCircle(x, y) {
        const radius = 35; // Légèrement plus grand pour la visibilité
        
        // ✅ REMONTÉ: Position plus haute à droite
        const timerX = x;
        const timerY = y - 30; // ← Remonté de 20px
        
        // Cercle de fond
        this.timerBg = this.add.circle(timerX, timerY, radius, 0x333333, 0.9)
            .setDepth(1000); // Profondeur élevée pour être devant
        
        // Texte du timer
        this.timerText = this.add.text(timerX, timerY, this.timeLeft, {
            font: `bold 28px Arial`, // Plus gros pour la lisibilité
            fill: "#ffffff",
            align: "center",
            stroke: "#000000",
            strokeThickness: 2
        }).setOrigin(0.5)
          .setDepth(1001); // Encore plus devant

        // Cercle de progression
        this.timerCircle = this.add.graphics()
            .setPosition(timerX, timerY)
            .setDepth(1000);

        this.currentContainer.add([this.timerBg, this.timerText, this.timerCircle]);
    }

    startQuestionTimer() {
        this.timeLeft = 10; // ✅ CHANGÉ: 30 → 10 secondes
        
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
            repeat: 9 // ✅ CHANGÉ: 29 → 9 répétitions (pour 10 secondes)
        });
    }

    updateTimer() {
        if (this.timerText) {
            this.timerText.setText(this.timeLeft);
            
            // ✅ AJUSTÉ: Alertes plus rapides pour 10 secondes
            if (this.timeLeft <= 3) {
                this.timerText.setTint(0xff0000);
            } else if (this.timeLeft <= 5) {
                this.timerText.setTint(0xffa500);
            } else {
                this.timerText.clearTint();
            }
        }

        // Dessine le cercle de progression
        if (this.timerCircle) {
            // ✅ CHANGÉ: Calculer sur 10 secondes au lieu de 30
            const angle = (this.timeLeft / 10) * 360;
            this.timerCircle.clear();
            this.timerCircle.lineStyle(8, this.timeLeft <= 3 ? 0xff0000 : this.timeLeft <= 5 ? 0xffa500 : 0x10b981);
            this.timerCircle.beginPath();
            this.timerCircle.arc(0, 0, 35, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + angle), false);
            this.timerCircle.strokePath();
        }
    }

    selectAnswer(answerIndex, container, bg) {
        if (this.hasAnswered) return; // ✅ PROTECTION: Empêche le spam côté client

        this.hasAnswered = true;
        this.selectedAnswer = answerIndex;

        // Surligne la réponse sélectionnée
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
            font: `bold 18px Arial`,
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
        MusicManager.play(this, 'wait', { loop: false, volume: 0.3 });
    }

    updateWaitingDisplay(answersReceived, totalPlayers) {
        if (this.waitingText) {
            this.waitingText.setText(`⏳ En attente des autres joueurs... (${answersReceived}/${totalPlayers})`);
        }
    }

    showRoundResults(data) {
        this.clearScreen();
        MusicManager.play(this, 'answer', { loop: false, volume: 0.3 });
        const { width, height } = this.sys.game.canvas;
        const baseSize = Math.min(width, height);
        const titleSize = Math.min(baseSize * 0.06, 36);
        const textSize = Math.min(baseSize * 0.04, 24);

        this.currentContainer = this.add.container(0, 0);

        // AJOUT: Fond coloré selon la réponse du joueur
        const isCorrect = this.selectedAnswer === data.correctAnswer;
        const hasAnswered = this.selectedAnswer >= 0;
        
        let bgColor, bgAlpha;
        if (!hasAnswered) {
            // Pas de réponse = fond neutre gris
            bgColor = 0x6b7280;
            bgAlpha = 0.8;
        } else if (isCorrect) {
            // Correct = fond vert
            bgColor = 0x10b981;
            bgAlpha = 0.8;
        } else {
            // Incorrect = fond rouge
            bgColor = 0xef4444;
            bgAlpha = 0.8;
        }

        // Fond principal avec couleur selon le résultat
        const resultBackground = this.add.rectangle(width / 2, height / 2, width, height, bgColor, bgAlpha)
            .setOrigin(0.5);
        
        // Overlay avec dégradé pour un effet plus subtil
        const resultOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.3)
            .setOrigin(0.5);

        this.currentContainer.add([resultBackground, resultOverlay]);

        // Animation du fond (pulsation subtile)
        this.tweens.add({
            targets: resultBackground,
            alpha: bgAlpha - 0.2,
            duration: 1000,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut'
        });

        // Affiche d'abord la réponse du joueur
        if (this.selectedAnswer !== null) {
            this.showPlayerAnswer(data);
        }

        // Puis affiche la bonne réponse après 1.5 secondes
        this.time.delayedCall(1500, () => {
            this.showCorrectAnswer(data);
        });

        // SUPPRESSION du classement - remplacé par les points gagnés
        this.time.delayedCall(3000, () => {
            this.showPointsGained(data);
        });
    }

    showPlayerAnswer(data) {
        const { width, height } = this.sys.game.canvas;
        const baseSize = Math.min(width, height);
        const titleSize = Math.min(baseSize * 0.08, 48);

        const isCorrect = this.selectedAnswer === data.correctAnswer;
        const hasAnswered = this.selectedAnswer >= 0;

        let resultText, resultColor;
        if (!hasAnswered) {
            resultText = "⏰ TEMPS ÉCOULÉ !";
            resultColor = "#9ca3af";
            
        } else if (isCorrect) {
            resultText = "🎉 BRAVO ! CORRECT !";
            resultColor = "#ffffff";
            
        } else {
            resultText = "💥 OUPS ! INCORRECT !";
            resultColor = "#ffffff";
            
        }

        // Titre principal avec effet plus visible
        const resultTitle = this.add.text(width / 2, height * 0.25, resultText, {
            font: `bold ${titleSize}px Arial`,
            fill: resultColor,
            stroke: "#000000",
            strokeThickness: 6,
            align: "center"
        }).setOrigin(0.5);

        // Si incorrect, affiche la réponse du joueur
        if (!isCorrect && hasAnswered) {
            const playerAnswerBg = this.add.rectangle(width / 2, height * 0.4, width * 0.9, height * 0.1, 0x000000, 0.7)
                .setOrigin(0.5);
            
            const playerAnswerText = this.add.text(width / 2, height * 0.4, 
                `Votre réponse: ${this.currentQuestion.answers[this.selectedAnswer]}`, {
                font: `bold ${titleSize * 0.7}px Arial`,
                fill: "#ffffff",
                stroke: "#000000",
                strokeThickness: 3,
                align: "center",
                wordWrap: { width: width * 0.85 }
            }).setOrigin(0.5);
            
            this.currentContainer.add([playerAnswerBg, playerAnswerText]);
        }

        this.currentContainer.add(resultTitle);

        // Animation d'apparition plus spectaculaire
        resultTitle.setScale(0);
        this.tweens.add({
            targets: resultTitle,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: resultTitle,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 200,
                    ease: 'Power2'
                });
            }
        });
    }

    showCorrectAnswer(data) {
        const { width, height } = this.sys.game.canvas;
        const baseSize = Math.min(width, height);
        const titleSize = Math.min(baseSize * 0.06, 36);

        // Fond pour la bonne réponse
        const correctAnswerBg = this.add.rectangle(width / 2, height * 0.58, width * 0.95, height * 0.15, 0x000000, 0.8)
            .setOrigin(0.5);
        
        const correctAnswerBorder = this.add.rectangle(width / 2, height * 0.58, width * 0.95 + 6, height * 0.15 + 6, 0x10b981, 0.8)
            .setOrigin(0.5);

        const correctAnswerText = this.add.text(width / 2, height * 0.58, 
            `💡 Bonne réponse: ${data.correctAnswerText}`, {
            font: `bold ${titleSize * 0.9}px Arial`,
            fill: "#ffffff",
            stroke: "#000000",
            strokeThickness: 3,
            align: "center",
            wordWrap: { width: width * 0.85 }
        }).setOrigin(0.5);

        this.currentContainer.add([correctAnswerBorder, correctAnswerBg, correctAnswerText]);

        // Animation d'apparition glissante
        correctAnswerBg.setAlpha(0);
        correctAnswerBorder.setAlpha(0);
        correctAnswerText.setAlpha(0);
        correctAnswerText.setY(height * 0.65);

        this.tweens.add({
            targets: [correctAnswerBg, correctAnswerBorder, correctAnswerText],
            alpha: 1,
            duration: 500,
            ease: 'Power2'
        });

        this.tweens.add({
            targets: correctAnswerText,
            y: height * 0.58,
            duration: 500,
            ease: 'Back.easeOut'
        });
    }

    showPointsGained(data) {
        const { width, height } = this.sys.game.canvas;
        const baseSize = Math.min(width, height);
        const textSize = Math.min(baseSize * 0.06, 36);

        // Trouve le joueur actuel dans les données de points
        const currentPlayerPoints = data.pointsDistribution?.find(p => p.playerId === this.playerId);
        
        if (currentPlayerPoints && currentPlayerPoints.points > 0) {
            // Affiche les points gagnés
            const pointsText = this.add.text(width / 2, height * 0.75, 
                `+ ${currentPlayerPoints.points} points !`, {
                font: `bold ${textSize}px Arial`,
                fill: "#fbbf24",
                stroke: "#000000",
                strokeThickness: 4,
                align: "center"
            }).setOrigin(0.5);

            this.currentContainer.add(pointsText);

            // Animation d'apparition spectaculaire
            pointsText.setScale(0);
            this.tweens.add({
                targets: pointsText,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 400,
                ease: 'Back.easeOut',
                onComplete: () => {
                    this.tweens.add({
                        targets: pointsText,
                        scaleX: 1,
                        scaleY: 1,
                        duration: 200,
                        ease: 'Power2'
                    });
                }
            });

            // Animation de pulsation
            this.tweens.add({
                targets: pointsText,
                alpha: 0.8,
                duration: 800,
                yoyo: true,
                repeat: 2,
                ease: 'Sine.easeInOut'
            });
        } else {
            // Aucun point gagné
            const noPointsText = this.add.text(width / 2, height * 0.75, 
                "0 point", {
                font: `bold ${textSize * 0.8}px Arial`,
                fill: "#9ca3af",
                stroke: "#000000",
                strokeThickness: 3,
                align: "center"
            }).setOrigin(0.5);

            this.currentContainer.add(noPointsText);

            // Animation simple
            noPointsText.setAlpha(0);
            this.tweens.add({
                targets: noPointsText,
                alpha: 1,
                duration: 500,
                ease: 'Power2'
            });
        }
    }

    showFinalResults(data) {
        this.clearScreen();

        const { width, height } = this.sys.game.canvas;
        const baseSize = Math.min(width, height);
        const titleSize = Math.min(baseSize * 0.08, 48);
        const textSize = Math.min(baseSize * 0.04, 24);

        this.currentContainer = this.add.container(0, 0);

        // Fond spécial pour les résultats finaux
        const finalBg = this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e, 0.9)
            .setOrigin(0.5);

        const finalOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x8b5cf6, 0.15)
            .setOrigin(0.5);

        // Effet de confettis
        for (let i = 0; i < 20; i++) {
            const confetti = this.add.circle(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(0, height * 0.5),
                Phaser.Math.Between(3, 8),
                Phaser.Math.Between(0xff6b35, 0xfbbf24),
                0.8
            );

            this.tweens.add({
                targets: confetti,
                y: height + 50,
                rotation: Phaser.Math.Between(0, 6.28),
                duration: Phaser.Math.Between(2000, 4000),
                ease: 'Power2',
                delay: Phaser.Math.Between(0, 2000)
            });
        }

        // Titre avec effet spectaculaire
        const title = this.add.text(width / 2, height * 0.15, "🎉 QUIZ TERMINÉ !", {
            font: `bold ${titleSize}px Arial`,
            fill: "#ffffff",
            stroke: "#8b5cf6",
            strokeThickness: 6,
            align: "center"
        }).setOrigin(0.5);

        // Podium avec fond encadré
        const podiumBg = this.add.rectangle(width / 2, height * 0.5, width * 0.9, height * 0.4, 0x2d3748, 0.9)
            .setOrigin(0.5);

        const podiumBorder = this.add.rectangle(width / 2, height * 0.5, width * 0.9 + 6, height * 0.4 + 6, 0xfbbf24, 0.8)
            .setOrigin(0.5);

        const podiumTitle = this.add.text(width / 2, height * 0.32, "🏆 PODIUM", {
            font: `bold ${textSize * 1.5}px Arial`,
            fill: "#fbbf24",
            stroke: "#000000",
            strokeThickness: 3,
            align: "center"
        }).setOrigin(0.5);

        // ✅ FORCER L'AFFICHAGE DU PODIUM - NOUVELLE APPROCHE
        let playersToDisplay = [];

        if (data.podium && Array.isArray(data.podium) && data.podium.length > 0) {
 
            playersToDisplay = data.podium;

            playersToDisplay = data.finalLeaderboard.slice(0, 3).map((player, index) => ({
                ...player,
                medal: index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"
            }));
        }

        // ✅ AFFICHAGE FORCÉ - MÉTHODE DIRECTE SANS CONTAINER
        if (playersToDisplay.length > 0) {
            console.log(`[Quiz] 🎨 Affichage de ${playersToDisplay.length} joueurs`);

            playersToDisplay.forEach((player, index) => {
                const y = height * 0.4 + index * (textSize * 1.8);
                const isCurrentPlayer = player.id === this.playerId;

                console.log(`[Quiz] 🎨 Affichage joueur ${index + 1}:`, {
                    name: player.name,
                    score: player.score,
                    medal: player.medal,
                    isCurrentPlayer,
                    position: { y }
                });

                // ✅ CRÉATION DIRECTE DU TEXTE SANS CONTAINER
                this.add.text(width / 2, y,
                    `${player.medal} ${player.name}: ${player.score} points`, {
                    font: `${isCurrentPlayer ? 'bold' : ''} ${Math.max(textSize * (index === 0 ? 1.3 : index === 1 ? 1.1 : 1), 16)}px Arial`,
                    fill: isCurrentPlayer ? "#fbbf24" : index === 0 ? "#ffd700" : index === 1 ? "#c0c0c0" : "#cd7f32",
                    stroke: "#000000",
                    strokeThickness: 2,
                    align: "center"
                })
                    .setOrigin(0.5)
                    .setDepth(1000); // ✅ DEPTH ÉLEVÉ pour être sûr qu'il s'affiche

            });
        } else {
            console.error('[Quiz] ❌ ÉCHEC TOTAL: Aucun joueur à afficher');

            // ✅ MESSAGE D'ERREUR AUSSI CRÉÉ DIRECTEMENT
            this.add.text(width / 2, height * 0.45,
                "❌ Erreur: Aucune donnée de classement", {
                font: `${textSize}px Arial`,
                fill: "#ff6b6b",
                stroke: "#000000",
                strokeThickness: 2,
                align: "center"
            })
                .setOrigin(0.5)
                .setDepth(1000);
        }

        // Bouton quitter
        const quitButton = this.createQuitButton(width / 2, height * 0.85);

        // ✅ AJOUT AU CONTAINER SEULEMENT DES ÉLÉMENTS DE FOND
        this.currentContainer.add([finalBg, finalOverlay, podiumBg, podiumBorder, title, podiumTitle, quitButton]);

        // Animations spectaculaires
        this.tweens.add({
            targets: title,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Animation du podium
        this.tweens.add({
            targets: [podiumBg, podiumBorder],
            alpha: { from: 0, to: 1 },
            scaleX: { from: 0.8, to: 1 },
            scaleY: { from: 0.8, to: 1 },
            duration: 800,
            ease: 'Back.easeOut'
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

        const buttonIcon = this.add.text(-buttonWidth * 0.5, 0, "🚪", {
            font: `24px Arial`,
            align: "center"
        }).setOrigin(0.5);

        const buttonText = this.add.text(buttonWidth * 0.05, 0, "QUITTER LE QUIZ", {
            font: `bold 18px Arial`,
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

        // NE PAS détruire le fond global et les particules
        this.children.list.forEach(child => {
            if (child !== this.globalBg && 
                child !== this.globalOverlay && 
                !this.globalParticles.includes(child)) {
                child.destroy();
            }
        });
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
        MusicManager.play(this.scene.get('GameScene'), 'music1', { loop: true, volume: 0.4 });
        // Retourner directement à GameScene au lieu du lobby de quiz
        this.scene.stop();
        this.scene.resume("GameScene");
    }

    generateGameId() {
        return `quiz-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
}