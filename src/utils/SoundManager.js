/**
 * SoundManager
 * 
 * Provides a small abstraction to play move-specific sounds with lazy loading and fallbacks.
 * Intended to be instantiated from a Phaser.Scene like `new SoundManager(scene)`.
 */
export default class SoundManager {
    constructor(scene) {
        this.scene = scene;
        this.loaded = new Set();
        this.loading = new Map(); // key -> Promise

        // Supported extensions to try when loading a sound file
        this.extensions = ['mp3', 'ogg', 'wav'];

        // Base path for move sounds and sfx
        this.movePath = '/assets/sounds/moves/';
        this.sfxPath = '/assets/sounds/';

        // Base path for music tracks
        this.musicPath = '/assets/musics/pkm/';
        // Path for cries
        this.criesPath = '/assets/sounds/cries/';
        this.currentMusicKey = null;

        // Generic fallback keys and mapping to existing asset names
        // The repo uses many filenames with spaces and different casing (e.g. "Hit Normal Damage.mp3").
        // To avoid decoding errors or 404s, we don't blindly preload generic keys; we map fallback keys
        // to likely existing filenames and try them on-demand.
        this.genericMoveKey = 'move_generic';
        this.criticalKey = 'move_critical';
        this.specialMappings = {
            'generic': 'Hit Normal Damage',
            'critical': 'Hit Super Effective',
            'faint': 'In-Battle Faint No Health',
            'hit': 'Hit Normal Damage'
        };
        // Additional event sounds mapping (request list)
        const eventMappings = {
            'egg_eget': 'Egg_Get',
            'egg_get': 'Egg_Get',
            'poke_caught': 'Poke_Caught',
            'pokecaught': 'Poke_Caught',
            'levelup': 'LevelUp',
            'level_up': 'LevelUp',
            'keyitem_get': 'KeyItem_Get',
            'key_item_get': 'KeyItem_Get',
            'pokecenter_heal': 'PokeCenter_Heal',
            'pokecenterheal': 'PokeCenter_Heal',
            'item_get': 'Item_Get',
            'itemget': 'Item_Get',
            'evolution_startup': 'Evolution_Startup',
            'evolution_start': 'Evolution_Startup',
            'booster_opening': 'boosterOpenning'
        };
        Object.assign(this.specialMappings, eventMappings);
    }

    // Play a Pokemon cry by species id and species name (tries to find a file starting with the padded id)
    async playPokemonCry(speciesId, speciesName, { volume = 1.0, rate = 1.0, loop = false } = {}) {
        if (!speciesId || !this.scene || !this.scene.sound) return false;
        const pad3 = String(speciesId).padStart(3, '0');
        const baseKey = `cry_${pad3}`;

        // Build candidate names using the species name if provided
        const candidates = [];
        if (speciesName) {
            const nameCandidates = this.buildCandidateNames(speciesName);
            nameCandidates.forEach(n => candidates.push(n));
        }
        // Also try plain id-only files like '007' if available
        candidates.push(pad3);

        // Prefer base id (007 - Name), then fallback to pad3X/Y if base not found
        const prefixes = [pad3, `${pad3}X`, `${pad3}Y`];

        // Try all combinations
        for (const prefix of prefixes) {
            for (const candidateName of candidates) {
                for (const ext of this.extensions) {
                    const filename = candidateName && candidateName !== pad3 ? `${prefix} - ${candidateName}` : prefix;
                    const url = `${this.criesPath}${encodeURIComponent(filename)}.${ext}`;
                    const key = `${baseKey}_${this.sanitizeName(filename)}`;
                    try {
                        await this.loadAudioForKey(key, url);
                        // Play it and return
                        this.scene.sound.play(key, { volume, rate, loop });
                        console.debug(`[SoundManager] Playing cry ${key} for species ${speciesId} (${speciesName})`);
                        return true;
                    } catch (e) {
                        // try next
                    }
                }
            }
        }

        console.debug(`[SoundManager] No cry found for species ${speciesId} (${speciesName})`);
        return false;
    }

    // sanitize move name to file-friendly string
    sanitizeName(name) {
        if (!name) return '';
        return String(name)
            .toLowerCase()
            .normalize('NFD').replace(/\p{Diacritic}/gu, '')
            .replace(/[^a-z0-9 -_]/g, '')
            // preserve spaces for candidate generation and compatibility with filenames
            .replace(/\s+/g, ' ')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    buildKey(moveName) {
        return `move_${this.sanitizeName(moveName).replace(/ /g, '-')}`;
    }

    buildUrl(moveName, ext, path) {
        const filename = moveName;
        return `${path}${encodeURIComponent(filename)}.${ext}`;
    }

    // Build a list of candidate filenames to try based on common filename patterns in the assets
    buildCandidateNames(moveName) {
        if (!moveName) return [];
        const trimmed = moveName.trim();
        const lower = trimmed.toLowerCase();
        const title = trimmed.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const hyphen = lower.replace(/\s+/g, '-');
        const underscore = lower.replace(/\s+/g, '_');
        const titleUnderscore = title.replace(/\s+/g, '_');
        const titleHyphen = title.replace(/\s+/g, '-');
        const titleNoSpace = title.replace(/\s+/g, '');
        const nospace = lower.replace(/\s+/g, '');
        const sanitized = this.sanitizeName(trimmed);

        // Keep the original and titlecase forms as first candidates (matching repo files)
        const candidates = [trimmed, title, titleUnderscore, titleHyphen, titleNoSpace, lower, hyphen, underscore, nospace, sanitized];

        // Remove duplicates while preserving order
        return [...new Set(candidates.filter(Boolean))];
    }

    // Try to dynamically load a given key (returns a Promise that resolves when loaded or rejects)
    loadAudioForKey(key, url) {
        return new Promise((resolve, reject) => {
            // guard: if already loaded
            if (this.scene.sound && this.scene.sound.get(key)) return resolve(true);

            // Listen for the loader to complete the file
            const onFileComplete = (fileKey, type) => {
                if (fileKey === key) {
                    cleanup();
                    console.debug('[SoundManager] Loaded audio', key, url);
                    resolve(true);
                }
            };

            const onFileError = (fileKey) => {
                if (fileKey === key) {
                    cleanup();
                    reject(new Error('load error'));
                }
            };

            const cleanup = () => {
                this.scene.load.off('filecomplete', onFileComplete);
                this.scene.load.off('loaderror', onFileError);
            };

            try {
                // Before loading with Phaser, attempt a quick HEAD request to validate the resource exists and is likely an audio file.
                // This helps avoid loading an HTML 404 page that later fails to decode.
                (async () => {
                    try {
                        const head = await fetch(url, { method: 'HEAD' });
                        if (!head.ok) {
                            // Not found or other HTTP error -- fail early
                            console.warn('[SoundManager] HEAD check not ok for', url, head.status);
                            cleanup();
                            return reject(new Error('Not found'));
                        }
                        const ct = head.headers.get('content-type') || '';
                        if (ct && !ct.startsWith('audio/')) {
                            // Not an audio content type
                            console.warn('[SoundManager] HEAD content-type not audio for', url, ct);
                            cleanup();
                            return reject(new Error('Not audio content-type'));
                        }
                    } catch (e) {
                        // HEAD failed (some static servers/proxies don't respond to HEAD), we let Phaser try to load.
                    }

                    // Register events
                    this.scene.load.once('filecomplete', onFileComplete);
                    this.scene.load.once('loaderror', onFileError);
                    this.scene.load.audio(key, url);
                    this.scene.load.start();
                })();
            } catch (e) {
                cleanup();
                reject(e);
            }
        });
    }

    // Attempt to load move sound trying supported extensions sequentially
    async tryLoadMoveSound(moveName) {
        const key = this.buildKey(moveName);
        // already loaded
        if (this.loaded.has(key) || (this.scene.sound && this.scene.sound.get(key))) return key;
        if (this.loading.has(key)) return this.loading.get(key);

        const promise = (async () => {
            // support a special mapping (generic/critical/faint) to existing asset names
            const specialName = this.specialMappings[moveName?.toLowerCase()];
            const candidateNames = specialName ? [specialName] : this.buildCandidateNames(moveName);

            // Try sfxPath first (for event sounds), then movePath
            const basePaths = [this.sfxPath, this.movePath];
            for (const candidate of candidateNames) {
                for (const basePath of basePaths) {
                    for (const ext of this.extensions) {
                        const url = this.buildUrl(candidate, ext, basePath);
                        try {
                            await this.loadAudioForKey(key, url);
                            // Mark loaded
                            this.loaded.add(key);
                            return key;
                        } catch (e) {
                            // try next extension
                        }
                    }
                }
            }

            // If no sound file exists, reject
            console.warn(`[SoundManager] Aucune piste trouvée pour ${moveName} (candidates: ${candidateNames.join(', ')})`);
            throw new Error('No move sound found');
        })();

        this.loading.set(key, promise);
        try {
            const result = await promise;
            this.loading.delete(key);
            return result;
        } catch (e) {
            this.loading.delete(key);
            throw e;
        }
    }

    // Play a move sound with an optional volume and rate
    async playMoveSound(moveName, { volume = 1.0, rate = 1.0, loop = false } = {}) {
        // If no move provided, use generic
        const requested = moveName && String(moveName).trim() ? moveName : 'generic';
        if (!this.scene || !this.scene.sound) return false;

        const key = this.buildKey(requested);

        try {
            // If loaded, play directly
            if (this.scene.sound.get(key)) {
                this.scene.sound.play(key, { volume, rate, loop });
                return true;
            }

            // Else try to load
            await this.tryLoadMoveSound(requested);
            // Play
            this.scene.sound.play(key, { volume, rate, loop });
            return true;
        } catch (e) {
            // fallback: play generic move sound if exists
            const fallbackKey = this.genericMoveKey;
            if (this.scene.sound.get(fallbackKey)) {
                this.scene.sound.play(fallbackKey, { volume, rate, loop });
                return true;
            }
            console.warn('[SoundManager] Aucune piste sonore trouvée pour', moveName || requested);
            return false;
        }
    }

    // Play music track (looped) - similar to move sound loader but using music path
    async playMusic(trackName, { volume = 0.6, rate = 1.0, loop = true } = {}) {
        if (!trackName || !this.scene || !this.scene.sound) return false;

        const key = `music_${this.sanitizeName(trackName)}`;

        try {
            if (this.scene.sound.get(key)) {
                // Delegate to centralized MusicManager for overlay playback
                try {
                    MusicManager.playOver(this.scene, key, { loop, volume });
                    this.currentMusicKey = key;
                } catch (err) {
                    if (this.currentMusicKey && this.scene.sound.get(this.currentMusicKey)) {
                        this.scene.sound.stopByKey(this.currentMusicKey);
                    }
                    this.scene.sound.play(key, { volume, rate, loop });
                    this.currentMusicKey = key;
                }
                return true;
            }

            // Try to load with supported extensions
            for (const ext of this.extensions) {
                const url = `${this.musicPath}${this.sanitizeName(trackName)}.${ext}`;
                try {
                    await this.loadAudioForKey(key, url);
                    try {
                        MusicManager.playOver(this.scene, key, { loop, volume });
                        this.currentMusicKey = key;
                        return true;
                    } catch (err) {
                        if (this.currentMusicKey && this.scene.sound.get(this.currentMusicKey)) {
                            this.scene.sound.stopByKey(this.currentMusicKey);
                        }
                        this.scene.sound.play(key, { volume, rate, loop });
                        this.currentMusicKey = key;
                        return true;
                    }
                    return true;
                } catch (e) {
                    // try next
                }
            }

            // fallback: try generic move sound
            if (this.scene.sound.get(this.genericMoveKey)) {
                this.scene.sound.play(this.genericMoveKey, { volume, rate, loop });
                return true;
            }

            return false;
        } catch (e) {
            console.warn('[SoundManager] Erreur lors de la lecture de la musique', trackName, e);
            return false;
        }
    }

    // Stop the current playing music (if any)
    stopMusic() {
        try {
            MusicManager.restorePrevious();
            this.currentMusicKey = null;
            return;
        } catch (e) {
            // fallback
        }
        if (!this.scene || !this.scene.sound) return;
        if (this.currentMusicKey && this.scene.sound.get(this.currentMusicKey)) {
            try { this.scene.sound.stopByKey(this.currentMusicKey); } catch (e) {}
            this.currentMusicKey = null;
        }
    }
}
