import Phaser from 'phaser';
import SpriteLoader from './utils/spriteLoader';

/**
 * Scène d'animation de capture (Poké Ball)
 */
class CaptureScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CaptureScene' });
    }

    init(data) {
        this.battleScene = data.battleScene;
        this.ballType = data.ballType || 'poke-ball'; // ID de l'item
        this.wildPokemon = data.wildPokemon;
        this.startPosition = data.startPosition; // 🆕 Position exacte pour transition fluide
        this.callback = data.callback || (() => {});
    }

    preload() {
        // Charger les images des Pokéballs (avec slash initial pour chemin absolu)
        this.load.image('pokeball_1', '/assets/items/pokeball1.png');
        this.load.image('pokeball_2', '/assets/items/pokeball2.png');
        // Fallback pour les autres types si nécessaire
    }

    async create() {
        console.log('[CaptureScene] Animation de capture avec', this.ballType);

        const { width, height } = this.cameras.main;

        // Fond semi-transparent
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.3);
        overlay.setOrigin(0);

        // Position du Pokémon (utiliser position exacte si fournie)
        const pokemonX = this.startPosition ? this.startPosition.x : width * 0.7;
        const pokemonY = this.startPosition ? this.startPosition.y : height * 0.4;

        // Sprite du Pokémon (copie de la battle scene)
        let pokemonSprite;
        
        if (this.wildPokemon && this.wildPokemon.sprites && this.wildPokemon.sprites.frontCombat) {
             try {
                // Utiliser SpriteLoader pour gérer GIF/PNG comme dans BattleScene
                const result = await SpriteLoader.displaySpriteAuto(
                    this,
                    pokemonX,
                    pokemonY,
                    this.wildPokemon.sprites.frontCombat,
                    this.wildPokemon.name.substring(0, 2),
                    2.5,
                    1,
                    true // useAnimatedSprites (on force true pour l'instant ou on récupère de localStorage)
                );
                
                if (result.type === 'phaser') {
                    pokemonSprite = result.sprite;
                } else {
                    // Si c'est un GIF, on récupère le container DOM
                    // Note: Pour l'animation de capture (alpha, scale), il faudra manipuler le style du container
                    pokemonSprite = {
                        x: pokemonX,
                        y: pokemonY,
                        alpha: 1,
                        destroy: () => SpriteLoader.removeAnimatedGif(result.gifContainer),
                        setAlpha: (a) => result.gifContainer.style.opacity = a,
                        setVisible: (v) => result.gifContainer.style.display = v ? 'block' : 'none'
                    };
                    // Hack pour tweening sur objet JS qui update le DOM
                    pokemonSprite.domElement = result.gifContainer;
                }
            } catch (e) {
                console.error('Erreur chargement sprite capture:', e);
                // Fallback
                pokemonSprite = this.add.sprite(pokemonX, pokemonY, 'pokemon-sprites');
                pokemonSprite.setScale(3);
            }
        } else {
             pokemonSprite = this.add.sprite(pokemonX, pokemonY, 'pokemon-sprites');
             pokemonSprite.setScale(3);
        }

        // Créer la Poké Ball (utilise l'image chargée)
        const ball = this.createPokeBall(width * 0.2, height * 0.6);

        // Lancer l'animation
        this.animateCapture(ball, pokemonSprite, pokemonX, pokemonY);
    }

    /**
     * Créer le sprite de Poké Ball
     */
    createPokeBall(x, y) {
        // Déterminer la texture en fonction du type de ball
        let textureKey = 'pokeball_1'; // Défaut (Poké Ball classique)
        
        // Mapping des IDs d'items vers les textures
        if (this.ballType === 'great-ball' || this.ballType === 'ultra-ball' || this.ballType.includes('2')) {
            textureKey = 'pokeball_2';
        }
        
        // Créer le sprite avec l'image chargée
        const ball = this.add.sprite(x, y, textureKey);
        
        // Ajuster l'échelle (les images peuvent être grandes)
        ball.setScale(0.5); // Ajustez selon la taille réelle de vos images PNG

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
        const { width, height } = this.cameras.main;
        const flash = this.add.rectangle(0, 0, width, height, 0xFFFFFF, 1).setOrigin(0);
        flash.setDepth(100);

        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 300
        });

        // Sauvegarder l'échelle originale pour le breakout
        this.originalScale = pokemonSprite.scaleX || 1;
        if (pokemonSprite.domElement) {
            // Pour les GIFs, on essaie de deviner ou on utilise une valeur par défaut
            this.originalScale = 1; // Le scale CSS est relatif
        }

        // Disparition du Pokémon (compatible Sprite Phaser et GIF DOM)
        if (pokemonSprite.domElement) {
            // Animation manuelle pour DOM
            pokemonSprite.domElement.style.transition = 'opacity 0.3s, transform 0.3s';
            pokemonSprite.domElement.style.opacity = '0';
            pokemonSprite.domElement.style.transform = 'translate(-50%, -50%) scale(0.1)'; // Rétrécir dans la ball
        } else {
            this.tweens.add({
                targets: pokemonSprite,
                alpha: 0,
                scale: 0.1, // Rétrécir
                duration: 300
            });
        }

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
            // 🆕 Animation de libération (break out)
            await this.animateBreakOut(ball, pokemonSprite);
            await this.showCaptureFailure();
        }

        // Retourner à la scène de bataille
        await this.wait(1500);
        this.callback(result);
        // Nettoyage GIF si nécessaire
        if (pokemonSprite.destroy) pokemonSprite.destroy();
        this.scene.stop();
    }

    /**
     * Animation de libération du Pokémon (Break Out)
     */
    async animateBreakOut(ball, pokemonSprite) {
        console.log('[CaptureScene] Le Pokémon se libère !');

        // 1. Flash rouge sur la ball
        ball.setTint(0xFF0000);
        await this.wait(100);
        ball.clearTint();
        
        // 2. La ball s'ouvre (fade out ou scale up rapide)
        this.tweens.add({
            targets: ball,
            alpha: 0,
            scale: 1.5,
            duration: 200
        });

        // 3. Le Pokémon réapparaît (scale up + fade in)
        // Utiliser l'échelle originale sauvegardée ou une valeur par défaut raisonnable
        const targetScale = this.originalScale || 1;

        if (pokemonSprite.domElement) {
            pokemonSprite.domElement.style.opacity = '1';
            pokemonSprite.domElement.style.transform = 'translate(-50%, -50%) scale(1)'; // Reset scale CSS
        } else {
            this.tweens.add({
                targets: pokemonSprite,
                alpha: 1,
                scale: targetScale, // Retour taille originale
                duration: 300,
                ease: 'Back.easeOut'
            });
        }
        
        await this.wait(500);
    }

    /**
     * Animation de secousses de la Poké Ball
     */
    async animateShakes(ball, shakeCount) {
        console.log(`[CaptureScene] ${shakeCount} secousse(s)`);

        for (let i = 0; i < shakeCount; i++) {
            // Secouer (rotation + léger déplacement)
            await this.tweenPromise(
                this.tweens.add({
                    targets: ball,
                    angle: { from: -15, to: 15 }, // Oscillation plus visible
                    x: { from: ball.x - 5, to: ball.x + 5 }, // Léger tremblement horizontal
                    duration: 100,
                    yoyo: true,
                    repeat: 3 // Plus rapide et répété
                })
            );

            // Pause entre les secousses
            await this.wait(500); // Pause plus longue pour le suspense

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
        // Message supprimé à la demande de l'utilisateur
        await this.wait(500);
    }

    /**
     * Afficher le message d'échec
     */
    async showCaptureFailure() {
        // Message supprimé à la demande de l'utilisateur
        await this.wait(500);
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
                    playerId: this.battleScene.playerId,
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
