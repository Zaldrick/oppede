import Phaser from 'phaser';
import getPokemonDisplayName from './utils/getDisplayName';
import SoundManager from './utils/SoundManager';

export class PokemonEvolutionScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PokemonEvolutionScene' });
    }

    init(data) {
        this.pokemon = data.pokemon;
        this.evolution = data.evolution;
        this.returnSceneKey = data.returnSceneKey || 'GameScene';
        this.onComplete = data.onComplete;
        
        console.log('[EvolutionScene] Init:', {
            pokemon: getPokemonDisplayName(this.pokemon),
            target: this.evolution.targetSpeciesName
        });
    }

    preload() {
        // Charger les sprites si nécessaire
        // On suppose que le sprite actuel est déjà chargé ou en cache
        // On doit charger le nouveau sprite
        
        const targetId = this.evolution.targetSpeciesId;
        this.load.image(`pokemon_${targetId}`, `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${targetId}.png`);
        
        // Charger aussi le sprite actuel si pas en cache (sécurité)
        const currentId = this.pokemon.species_id;
        this.load.image(`pokemon_${currentId}`, `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${currentId}.png`);
    }

    create() {
        // Fond noir
        this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x000000).setOrigin(0);

        // Particules d'ambiance
        this.createParticles();

        // Sprite du Pokémon actuel
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;
        
        this.pokemonSprite = this.add.image(centerX, centerY, `pokemon_${this.pokemon.species_id}`)
            .setScale(0)
            .setAlpha(0);

        // Texte
        this.messageBox = this.add.rectangle(centerX, this.cameras.main.height - 100, this.cameras.main.width - 40, 150, 0x333333)
            .setStrokeStyle(4, 0xffffff);
        
        this.messageText = this.add.text(centerX, this.cameras.main.height - 100, '', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: this.cameras.main.width - 80 }
        }).setOrigin(0.5);

        // Lancer la séquence
        // Local SoundManager for evolution audio cues
        try { this.soundManager = new SoundManager(this); } catch (e) { this.soundManager = null; }
        this.startEvolutionSequence();
    }

    createParticles() {
        // Créer une texture de sphère blanche si elle n'existe pas
        if (!this.textures.exists('white_sphere')) {
            const graphics = this.make.graphics({ x: 0, y: 0, add: false });
            graphics.fillStyle(0xffffff, 1);
            graphics.fillCircle(6, 6, 6);
            graphics.generateTexture('white_sphere', 12, 12);
        }
    }

    explodeParticles(x, y) {
        // Phaser 3.60+ : add.particles crée directement un émetteur
        this.add.particles(x, y, 'white_sphere', {
            speed: { min: 50, max: 500 },
            angle: { min: 0, max: 360 },
            scale: { start: 1, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 2000,
            blendMode: 'ADD',
            emitting: false
        }).explode(150);
    }

    async startEvolutionSequence() {
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        // 1. Préparation des sprites
        // Sprite blanc pour l'effet de brillance progressive (Phase 1)
        const whiteSprite = this.add.image(centerX, centerY, `pokemon_${this.pokemon.species_id}`)
            .setTintFill(0xffffff)
            .setAlpha(0)
            .setScale(0); // Commence petit comme l'original

        // Sprite cible blanc pour la phase 2
        const targetWhiteSprite = this.add.image(centerX, centerY, `pokemon_${this.evolution.targetSpeciesId}`)
            .setTintFill(0xffffff)
            .setAlpha(0)
            .setScale(0.7)
            .setVisible(false);

        this.messageText.setText(`Quoi ? ${getPokemonDisplayName(this.pokemon)} évolue !`);
        // Jouer le cri du Pokémon au début de l'évolution (si disponible)
        try {
            if (this.soundManager) {
                const speciesId = this.pokemon.species_id || (this.pokemon.speciesData && this.pokemon.speciesData.id);
                const speciesName = (this.pokemon.speciesData && this.pokemon.speciesData.name) || this.pokemon.species_name || this.pokemon.nickname || '';
                if (speciesId) await this.soundManager.playPokemonCry(speciesId, speciesName, { volume: 0.9 });
            }
        } catch (e) { /* ignore */ }
        // Play evolution startup SFX (generic)
        try { if (this.soundManager) await this.soundManager.playMoveSound('evolution_startup', { volume: 0.9 }); } catch (e) { /* ignore */ }
        
        // Apparition initiale
        await Promise.all([
            this.tweens.add({
                targets: this.pokemonSprite,
                scale: 0.7,
                alpha: 1,
                duration: 1000,
                ease: 'Power2'
            }),
            this.tweens.add({
                targets: whiteSprite,
                scale: 0.7,
                duration: 1000,
                ease: 'Power2'
            })
        ]);

        await this.wait(500);

        // === PHASE 1: Déformation et Blanchiment (2.5s) ===
        // Le Pokémon se déforme de plus en plus et devient blanc
        
        const phase1Duration = 4000; // Un peu plus long pour bien profiter

        // Animation de blanchiment
        this.tweens.add({
            targets: whiteSprite,
            alpha: 1,
            duration: phase1Duration,
            ease: 'Power1' // Accélération progressive
        });

        // Animation de déformation chaotique croissante
        await new Promise(resolve => {
            this.tweens.addCounter({
                from: 0,
                to: 1,
                duration: phase1Duration,
                onUpdate: (tween) => {
                    const intensity = tween.getValue(); // 0 -> 1
                    
                    // Fréquence et amplitude augmentent avec l'intensité
                    const wobble = Math.sin(this.time.now / (60 - intensity * 30)) * (0.3 * intensity); 
                    const shake = Math.sin(this.time.now / (30 - intensity * 15)) * (15 * intensity);
                    
                    const scaleBase = 0.7;
                    // Stretch and squash
                    this.pokemonSprite.setScale(scaleBase + wobble, scaleBase - wobble);
                    whiteSprite.setScale(scaleBase + wobble, scaleBase - wobble);
                    
                    this.pokemonSprite.setAngle(shake);
                    whiteSprite.setAngle(shake);
                },
                onComplete: resolve
            });
        });

        // === TRANSITION: GROS FLASH ===
        this.cameras.main.flash(800, 255, 255, 255);
        
        // Switch des sprites pendant le flash (invisible pour l'utilisateur)
        this.pokemonSprite.setVisible(false);
        whiteSprite.setVisible(false);

        // Préparer la cible
        this.pokemonSprite.setTexture(`pokemon_${this.evolution.targetSpeciesId}`);
        this.pokemonSprite.setVisible(true);
        this.pokemonSprite.setAlpha(1);
        
        targetWhiteSprite.setAlpha(1); // Commence tout blanc
        targetWhiteSprite.setVisible(true);

        // === PHASE 2: Stabilisation (2.5s) ===
        // Le nouveau Pokémon (blanc) se stabilise et reprend ses couleurs
        
        const phase2Duration = 2500;

        // Animation de retour à la couleur normale
        this.tweens.add({
            targets: targetWhiteSprite,
            alpha: 0,
            duration: phase2Duration,
            ease: 'Power2'
        });

        // Animation de déformation décroissante
        await new Promise(resolve => {
            this.tweens.addCounter({
                from: 1,
                to: 0,
                duration: phase2Duration,
                onUpdate: (tween) => {
                    const intensity = tween.getValue(); // 1 -> 0
                    
                    const wobble = Math.sin(this.time.now / 50) * (0.3 * intensity);
                    const shake = Math.sin(this.time.now / 30) * (15 * intensity);
                    
                    const scaleBase = 0.7;
                    this.pokemonSprite.setScale(scaleBase + wobble, scaleBase - wobble);
                    targetWhiteSprite.setScale(scaleBase + wobble, scaleBase - wobble);
                    
                    this.pokemonSprite.setAngle(shake);
                    targetWhiteSprite.setAngle(shake);
                },
                onComplete: () => {
                    // Reset propre à la fin
                    this.pokemonSprite.setScale(0.7);
                    this.pokemonSprite.setAngle(0);
                    targetWhiteSprite.destroy();
                    resolve();
                }
            });
        });

        // === FINAL: EXPLOSION ===
        this.cameras.main.flash(1000, 255, 255, 255);
        this.explodeParticles(centerX, centerY);

        // Message de succès
        const newName = this.evolution.targetSpeciesName.charAt(0).toUpperCase() + this.evolution.targetSpeciesName.slice(1);
        this.messageText.setText(`Félicitations ! Votre ${getPokemonDisplayName(this.pokemon)} a évolué en ${newName} !`);

        // 4. Appel API pour confirmer
        try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
            // Utilisation du nouveau endpoint géré par PokemonEvolutionManager
            const response = await fetch(`${apiUrl}/api/evolution/perform`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pokemonId: this.pokemon._id,
                    targetSpeciesId: this.evolution.targetSpeciesId
                })
            });

            if (!response.ok) throw new Error('Erreur serveur');
            
            const result = await response.json();
            console.log('[Evolution] Confirmée serveur:', result);
            
            // Mettre à jour l'objet pokemon local avec les nouvelles données
            if (result.success) {
                this.pokemon.species_id = result.newId;
                this.pokemon.species_name = result.newSpecies;
                if (result.newNickname) {
                    this.pokemon.nickname = result.newNickname;
                }
                if (result.species_name_fr) {
                    this.pokemon.species_name_fr = result.species_name_fr;
                }
                this.pokemon.maxHP = result.maxHP;
                // On ne met pas à jour currentHP ici car on veut garder l'état visuel

                // Mettre à jour speciesData si existant
                if (this.pokemon.speciesData) {
                    this.pokemon.speciesData.name = result.newSpecies;
                    if (result.species_name_fr) this.pokemon.speciesData.name_fr = result.species_name_fr;
                }
            }

        } catch (error) {
            console.error('[Evolution] Erreur API:', error);
            this.messageText.setText('Erreur lors de la sauvegarde de l\'évolution...');
        }

        await this.wait(4000);

        // 5. Retour
        if (this.onComplete) {
            // Passer les données mises à jour au callback
            this.onComplete(this.pokemon);
        } else {
            this.scene.start(this.returnSceneKey);
        }
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
