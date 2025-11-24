import MusicManager from '../MusicManager';
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

        // Supported extensions to try when loading a sound file (prefer wav where possible)
        this.extensions = ['wav', 'mp3', 'ogg'];

        // Base path for move sounds and sfx
        this.movePath = '/assets/sounds/moves/';
        this.sfxPath = '/assets/sounds/';

        // Base path for music tracks
        this.musicPath = '/assets/musics/pkm/';
        // Path for cries
        this.criesPath = '/assets/sounds/cries/';
        this.currentMusicKey = null;
        // manifest cache for cry files
        this.criesManifest = null; // array of filenames or null if not loaded
        // Optional behaviour toggles
        this.config = {
            // If true, fallback to name-based search (EN) when manifest not found (default false)
            nameFallback: false
        };

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

    // Public: enable name-based fallback (EN) for missing manifest cases
    enableNameFallback() {
        this.config.nameFallback = true;
    }

    disableNameFallback() {
        this.config.nameFallback = false;
    }

    // Play a Pokemon cry by species id (expects files like "008 - Wartortle.wav")
    async playPokemonCry(speciesId, speciesName, { volume = 0.6, rate = 1.0, loop = false } = {}) {
        if (!speciesId || !this.scene || !this.scene.sound) return false;

        const pad3 = String(speciesId).padStart(3, '0');
        const baseKey = `cry_${pad3}`;
        try {
            const loadedMatch = Array.from(this.loaded || []).filter(k => k && k.indexOf(`cry_${pad3}_`) === 0);
            const sceneSoundMatch = (this.scene && this.scene.sound && Array.isArray(this.scene.sound.sounds)) ? this.scene.sound.sounds.filter(s => s && s.key && s.key.indexOf(`cry_${pad3}_`) === 0).map(s => s.key) : [];
            console.log(`[SoundManager] Request cry for ${pad3}. manifest=${Array.isArray(this.criesManifest) ? this.criesManifest.length : 'null'}, loadedMatch=${JSON.stringify(loadedMatch)}, sceneSoundMatch=${JSON.stringify(sceneSoundMatch)}`);
        } catch (e) {
            console.log(`[SoundManager] Request cry for ${pad3}. manifest=${Array.isArray(this.criesManifest) ? this.criesManifest.length : 'null'}`);
        }
        // Try to use the manifest if available to pick any file starting with the padded ID
        try {
                if (!this.criesManifest) {
                    try {
                        const tryPaths = [`${this.criesPath}index.json`, `/public${this.criesPath}index.json`];
                        let found = false;
                        for (const p of tryPaths) {
                            try {
                                const resp = await fetch(p);
                                const ct = resp.headers && resp.headers.get ? (resp.headers.get('content-type') || '') : '';
                                console.log(`[SoundManager] Manifest fetch attempt ${p} status=${resp.status} content-type=${ct}`);
                                if (!resp.ok) {
                                    continue; // try next path
                                }
                                // Only accept if it's JSON; avoid parsing index.html
                                if (!ct || !ct.toLowerCase().includes('application/json')) {
                                    console.warn(`[SoundManager] Manifest response at ${p} is not JSON (content-type=${ct}), skipping`);
                                    continue;
                                }
                                this.criesManifest = await resp.json();
                                found = true;
                                break;
                            } catch (fetchErr) {
                                console.warn('[SoundManager] Manifest fetch error for', p, fetchErr && fetchErr.message ? fetchErr.message : fetchErr);
                                continue;
                            }
                        }
                        if (!found) this.criesManifest = null;
                    } catch (e) {
                        // manifest not available
                        this.criesManifest = null;
                    }
                }

                if (this.criesManifest && Array.isArray(this.criesManifest)) {
                const prefixes = [pad3, `${pad3}X`, `${pad3}Y`, `${pad3}M`];
                let matchedFile = null;
                for (const prefix of prefixes) {
                    matchedFile = this.criesManifest.find(f => f && f.startsWith(prefix));
                    if (matchedFile) break;
                }
                if (!matchedFile) {
                    // final attempt: exact pad3 start
                    matchedFile = this.criesManifest.find(f => f && f.startsWith(pad3));
                }

                if (matchedFile) {
                    let url = `${this.criesPath}${encodeURIComponent(matchedFile)}`;
                    const altUrl = `/public${this.criesPath}${encodeURIComponent(matchedFile)}`;
                    // Use a unique playback key to guarantee independent playbacks
                    const uniquePlayKey = `${baseKey}_${Date.now()}_${Math.floor(Math.random()*10000)}`;
                    console.log(`[SoundManager] Matched manifest file ${matchedFile} -> uniqueKey ${uniquePlayKey}`);
                    try {
                        console.log(`[SoundManager] Trying manifest URL: ${url}`);
                        // Load under an ephemeral unique key to ensure we can play multiple times unpolluted by caching
                        try {
                            await this.loadAudioForKey(uniquePlayKey, url);
                        } catch (e) {
                            // try alternative public path
                            console.log(`[SoundManager] Manifest file failed at ${url}. Trying alternate path ${altUrl}`, e && e.message ? e.message : e);
                            await this.loadAudioForKey(uniquePlayKey, altUrl);
                        }
                        try {
                            const inst = this.scene.sound.add(uniquePlayKey);
                            inst.play({ volume, rate, loop });
                            inst.once('complete', () => { try { inst.destroy(); } catch (err) {} });
                        } catch (err) {
                            // fallback to a non-ephemeral key if add fails
                            try {
                                const key = `${baseKey}_${this.sanitizeName(matchedFile)}`;
                                await this.loadAudioForKey(key, url);
                                const inst = this.scene.sound.add(key);
                                inst.play({ volume, rate, loop });
                                inst.once('complete', () => { try { inst.destroy(); } catch (err) {} });
                            } catch (err2) {
                                // final fallback: try to play using the base key
                                try { this.scene.sound.play(baseKey, { volume, rate, loop }); } catch (e) {}
                            }
                        }
                        console.log(`[SoundManager] Playing cry ${uniquePlayKey} (mapped:${matchedFile}) for species ${speciesId} (from manifest: ${matchedFile})`);
                        return true;
                    } catch (e) {
                        // fallback to simpler attempts below if load fails
                        console.warn('[SoundManager] Manifest entry present but failed to load:', url, e);
                    }
                }
            }
        } catch (e) {
            console.warn('[SoundManager] Error attempting to use cries manifest:', e);
        }

        // If manifest is not present, log a meaningful warning to help debugging
            if (!this.criesManifest || !Array.isArray(this.criesManifest)) {
            console.warn(`[SoundManager] No cries manifest available at ${this.criesPath}index.json. Run 'npm run generate:cry-manifest' or ensure static files are served. (Tried both ${this.criesPath}index.json and /public${this.criesPath}index.json)`);
        }

        // Fallback: Try a handful of deterministic filename patterns that start with the id (without using species name)
        const candidatePrefixes = [pad3, `${pad3}X`, `${pad3}Y`, `${pad3}M`];
        for (const prefix of candidatePrefixes) {
                        // For move sounds prefer mp3 first (most assets are mp3), then ogg/wav
                        const moveExtensions = ['mp3', 'ogg', 'wav'];
                        for (const ext of moveExtensions) {
                const filename = `${prefix}.${ext}`; // e.g., 008.mp3
                const url = `${this.criesPath}${encodeURIComponent(filename)}`;
                const altUrl = `/public${this.criesPath}${encodeURIComponent(filename)}`;
                        console.log(`[SoundManager] Trying candidate URL: ${url}`);
                const key = `${baseKey}_${this.sanitizeName(filename)}`;
                    try {
                        await this.loadAudioForKey(key, url);
                        // If the normal key playback fails repeatedly, create unique ephemeral key to ensure successful playback
                        try {
                            const inst = this.scene.sound.add(key);
                            inst.play({ volume, rate, loop });
                            inst.once('complete', () => { try { inst.destroy(); } catch (err) {} });
                        } catch (err) {
                            // Fallback: create a unique ephemeral key to ensure playback works and does not rely on instance caching
                            const uniqueKey = `${key}_${Date.now()}_${Math.floor(Math.random()*10000)}`;
                            try {
                                await this.loadAudioForKey(uniqueKey, url);
                                const uniqueInst = this.scene.sound.add(uniqueKey);
                                uniqueInst.play({ volume, rate, loop });
                                    uniqueInst.once('complete', () => {
                                    try { uniqueInst.destroy(); } catch (e) {}
                                    try { if (this.scene && this.scene.cache && this.scene.cache.audio) this.scene.cache.audio.remove(uniqueKey); } catch (err) {}
                                    try { if (this.scene && this.scene.sound) this.scene.sound.removeByKey(uniqueKey); } catch (err) {}
                                    try { this.loaded.delete(uniqueKey); } catch (err) {}
                                });
                            } catch (uerr) {
                                // final fallback
                                try { this.scene.sound.play(key, { volume, rate, loop }); } catch (e) {}
                            }
                        }
                        console.log(`[SoundManager] Playing cry ${key} for species ${speciesId} (pattern fallback: ${filename})`);
                        return true;
                    } catch (e) {
                        // continue - but log the error and try alternative path
                        console.log(`[SoundManager] Candidate file failed at ${url}, trying alternative ${altUrl}`, e && e.message ? e.message : e);
                        try {
                            await this.loadAudioForKey(key, altUrl);
                        } catch (e2) {
                            // continue to next extension
                        }
                }
            }
        }
        // As a LAST resort, if nameFallback is enabled, try to use the english species name
        if (this.config && this.config.nameFallback && typeof speciesName === 'undefined' && this.pokemonManager) {
            try {
                const sp = await this.pokemonManager.getSpecies(speciesId);
                if (sp && sp.name) {
                    const nameCandidates = this.buildCandidateNames(sp.name);
                    for (const nameCandidate of nameCandidates) {
                        for (const ext of this.extensions) {
                            const filename = `${pad3} - ${nameCandidate}.${ext}`;
                            const url = `${this.criesPath}${encodeURIComponent(filename)}`;
                            const uniqueKey = `cry_names_fallback_${pad3}_${Date.now()}_${Math.floor(Math.random()*10000)}`;
                            try {
                                await this.loadAudioForKey(uniqueKey, url);
                                const inst = this.scene.sound.add(uniqueKey);
                                inst.play({ volume, rate, loop });
                                inst.once('complete', () => { try { inst.destroy(); } catch (err) {}; try { if (this.scene && this.scene.cache && this.scene.cache.audio) this.scene.cache.audio.remove(uniqueKey); } catch (err){}; try { this.loaded.delete(uniqueKey); } catch (err){} });
                                console.log(`[SoundManager] Playing cry via EN name fallback ${uniqueKey} for species ${speciesId} (candidate: ${nameCandidate})`);
                                return true;
                            } catch (e) {
                                // continue
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('[SoundManager] EN name fallback failed:', e);
            }
        }

        return false; // rien trouvé
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

        // Prefer the Title-case and hyphen variants first (asset filenames are often Title-case like 'Bite.mp3')
        const candidates = [title, titleHyphen, titleUnderscore, trimmed, lower, hyphen, underscore, nospace, titleNoSpace, sanitized];

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
                    // track loaded keys for faster subsequent checks
                    try { this.loaded.add(key); } catch (e) {}
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

            // Try movePath first (move sounds are in /moves), then sfxPath (event sounds)
            const basePaths = [this.movePath, this.sfxPath];
            for (const candidate of candidateNames) {
                for (const basePath of basePaths) {
                    // Support both explicit /assets... and /public/assets... served by express.
                    // Many environments serve static files under `/public`; try it first to avoid 404->index.html
                    const tryPaths = [`/public${basePath}`, basePath];
                    for (const tryPath of tryPaths) {
                        for (const ext of this.extensions) {
                            const url = this.buildUrl(candidate, ext, tryPath);
                            // debug: log the attempt
                            console.debug(`[SoundManager] tryLoadMoveSound attempt key=${key} url=${url}`);
                        try {
                            await this.loadAudioForKey(key, url);
                            // Mark loaded
                            this.loaded.add(key);
                            console.log(`[SoundManager] tryLoadMoveSound loaded key=${key} from ${url}`);
                            return key;
                        } catch (e) {
                            // try next extension
                        }
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

        console.debug(`[SoundManager] playMoveSound requested ${moveName} -> key ${key}`);
        try {
            // If loaded, play directly
            if (this.scene.sound.get(key)) {
                console.debug(`[SoundManager] Playing preloaded move sound key=${key}`);
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
