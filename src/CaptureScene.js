import Phaser from 'phaser';

/**
 * Scène d'animation de capture (Poké Ball)
 */
class CaptureScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CaptureScene' });
    }

    init(data) {
        this.battleScene = data.battleScene;
        this.ballType = data.ballType || 'poke-ball';
        this.wildPokemon = data.wildPokemon;
        this.callback = data.callback || (() => {});
    }

    create() {
        console.log('[CaptureScene] Animation de capture avec', this.ballType);

        const { width, height } = this.cameras.main;

        // Fond semi-transparent
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.3);
        overlay.setOrigin(0);

        // Position du Pokémon (centre-droite comme dans la bataille)
        const pokemonX = width * 0.7;
        const pokemonY = height * 0.4;

        // Sprite du Pokémon (copie de la battle scene)
        const pokemonSprite = this.add.sprite(pokemonX, pokemonY, 'pokemon-sprites');
        pokemonSprite.setScale(3);

        // Créer la Poké Ball
        const ball = this.createPokeBall(width * 0.2, height * 0.6);

        // Lancer l'animation
        this.animateCapture(ball, pokemonSprite, pokemonX, pokemonY);
    }

    /**
     * Créer le sprite de Poké Ball
     */
    createPokeBall(x, y) {
        // Cercle rouge + blanc avec ligne noire au milieu
        const graphics = this.add.graphics();

        // Moitié supérieure (rouge)
        graphics.fillStyle(0xFF0000, 1);
        graphics.fillCircle(0, 0, 20);

        // Moitié inférieure (blanc)
        graphics.fillStyle(0xFFFFFF, 1);
        graphics.beginPath();
        graphics.arc(0, 0, 20, 0, Math.PI, false);
        graphics.closePath();
        graphics.fill();

        // Ligne noire au milieu
        graphics.lineStyle(3, 0x000000, 1);
        graphics.lineBetween(-20, 0, 20, 0);

        // Bouton central (blanc avec bordure noire)
        graphics.fillStyle(0xFFFFFF, 1);
        graphics.fillCircle(0, 0, 6);
        graphics.lineStyle(2, 0x000000, 1);
        graphics.strokeCircle(0, 0, 6);

        // Convertir en texture
        graphics.generateTexture('pokeball-sprite', 50, 50);
        graphics.destroy();

        const ball = this.add.sprite(x, y, 'pokeball-sprite');
        ball.setScale(1.5);

        return ball;
    }

    /**
     * Animation complète de capture
     */
    async animateCapture(ball, pokemonSprite, pokemonX, pokemonY) {
        // 1️⃣ Lancer la ball (arc parabolique)
        await this.tweenPromise(
            this.tweens.add({
                targets: ball,
                x: pokemonX,
                y: pokemonY - 50,
                duration: 800,
                ease: 'Cubic.easeOut',
                onUpdate: (tween) => {
                    // Rotation pendant le vol
                    ball.rotation = tween.progress * Math.PI * 4;
                    // Parabole
                    const progress = tween.progress;
                    ball.y = pokemonY - 50 - Math.sin(progress * Math.PI) * 100;
                }
            })
        );

        // 2️⃣ Flash blanc et disparition du Pokémon
        const flash = this.add.rectangle(pokemonX, pokemonY, 200, 200, 0xFFFFFF, 1);
        flash.setDepth(100);

        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 300
        });

        this.tweens.add({
            targets: pokemonSprite,
            alpha: 0,
            duration: 300
        });

        await this.wait(300);

        // 3️⃣ La ball tombe au sol
        await this.tweenPromise(
            this.tweens.add({
                targets: ball,
                y: pokemonY + 100,
                duration: 300,
                ease: 'Bounce.easeOut'
            })
        );

        // 4️⃣ Appel API pour calculer la capture
        const result = await this.attemptCapture();

        // 5️⃣ Animation de secousses
        await this.animateShakes(ball, result.shakes);

        // 6️⃣ Résultat
        if (result.captured) {
            await this.showCaptureSuccess(result);
        } else {
            await this.showCaptureFailure();
            // Réafficher le Pokémon
            this.tweens.add({
                targets: pokemonSprite,
                alpha: 1,
                duration: 300
            });
        }

        // Retourner à la scène de bataille
        await this.wait(1500);
        this.callback(result);
        this.scene.stop();
    }

    /**
     * Animation de secousses de la Poké Ball
     */
    async animateShakes(ball, shakeCount) {
        console.log(`[CaptureScene] ${shakeCount} secousse(s)`);

        for (let i = 0; i < shakeCount; i++) {
            // Secouer à gauche
            await this.tweenPromise(
                this.tweens.add({
                    targets: ball,
                    angle: -15,
                    duration: 150,
                    yoyo: true,
                    repeat: 1
                })
            );

            // Pause entre les secousses
            await this.wait(200);

            // Si c'est la 4ème secousse, c'est capturé !
            if (i === 3) {
                // Étoiles autour de la ball
                this.showStars(ball.x, ball.y);
            }
        }
    }

    /**
     * Afficher les étoiles de capture réussie
     */
    showStars(x, y) {
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const star = this.add.text(x, y, '⭐', {
                fontSize: '32px'
            });

            this.tweens.add({
                targets: star,
                x: x + Math.cos(angle) * 80,
                y: y + Math.sin(angle) * 80,
                alpha: 0,
                duration: 800,
                onComplete: () => star.destroy()
            });
        }
    }

    /**
     * Afficher le message de capture réussie
     */
    async showCaptureSuccess(result) {
        const { width, height } = this.cameras.main;

        const successText = this.add.text(width / 2, height / 2, 'Gotcha!\nPokémon capturé!', {
            fontSize: '48px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center',
            shadow: {
                offsetX: 3,
                offsetY: 3,
                color: '#000000',
                blur: 5,
                fill: true
            }
        });
        successText.setOrigin(0.5);
        successText.setAlpha(0);

        this.tweens.add({
            targets: successText,
            alpha: 1,
            scale: 1.2,
            duration: 500,
            yoyo: true,
            repeat: 1
        });

        // Son de victoire (si disponible)
        // this.sound.play('capture-success');

        await this.wait(2000);
    }

    /**
     * Afficher le message d'échec
     */
    async showCaptureFailure() {
        const { width, height } = this.cameras.main;

        const failText = this.add.text(width / 2, height / 2, 'Oh non!\nLe Pokémon s\'est échappé!', {
            fontSize: '40px',
            fontFamily: 'Arial',
            color: '#FF4444',
            stroke: '#000000',
            strokeThickness: 5,
            align: 'center'
        });
        failText.setOrigin(0.5);
        failText.setAlpha(0);

        this.tweens.add({
            targets: failText,
            alpha: 1,
            duration: 400
        });

        // Son d'échec (si disponible)
        // this.sound.play('capture-fail');

        await this.wait(1500);
    }

    /**
     * Appeler l'API de capture
     */
    async attemptCapture() {
        try {
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000'}/api/battle/capture`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    battleId: this.battleScene.battleId,
                    playerId: this.battleScene.currentPlayer,
                    ballType: this.ballType
                })
            });

            const result = await response.json();
            console.log('[CaptureScene] Résultat capture:', result);

            return result;

        } catch (error) {
            console.error('[CaptureScene] Erreur API capture:', error);
            return { captured: false, shakes: 0, error: error.message };
        }
    }

    /**
     * Helper: convertir un tween en Promise
     */
    tweenPromise(tween) {
        return new Promise(resolve => {
            tween.on('complete', resolve);
        });
    }

    /**
     * Helper: attendre X ms
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default CaptureScene;
