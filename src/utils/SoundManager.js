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
            'faint': 'fainted',
            'hit': 'Hit Normal Damage'
        };
        // Additional event sounds mapping (request list)
        const eventMappings = {
            'egg_eget': 'Egg_Get',
            'egg_get': 'Egg_Get',
            'poke_caught': 'Poke_Caught',
            'pokecaught': 'Poke_Caught',
            // Simplified: only one canonical asset is expected: levelup.mp3
            'levelup': 'levelup',
            'keyitem_get': 'KeyItem_Get',
            'key_item_get': 'KeyItem_Get',
            'pokecenter_heal': 'PokeCenter_Heal',
            'pokecenterheal': 'PokeCenter_Heal',
            'item_get': 'Item_Get',
            'itemget': 'Item_Get',
            'evolution_startup': 'Evolution_Startup',
            'evolution_start': 'Evolution_Startup',
            'booster_opening': 'boosterOpenning',
            'teleport': 'tp'
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
        const filename = `${moveName}.${ext}`;
        return `${path}${encodeURIComponent(filename)}`;
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
                // Register events and ask Phaser to load the audio resource.
                // We removed the HEAD pre-check to avoid noisy fetches against static servers
                // that return HTML for missing files. Let Phaser handle the actual request.
                this.scene.load.once('filecomplete', onFileComplete);
                this.scene.load.once('loaderror', onFileError);
                this.scene.load.audio(key, url);
                this.scene.load.start();
            } catch (e) {
                cleanup();
                reject(e);
            }
        });
    }

    // Attempt to load move sound trying supported extensions sequentially
    async tryLoadMoveSound(moveName) {
        const baseKey = this.buildKey(moveName);
        // already loaded
        if (
            this.loaded.has(baseKey) ||
            (this.scene && this.scene.cache && this.scene.cache.audio && this.scene.cache.audio.exists(baseKey))
        ) {
            this.loaded.add(baseKey);
            return baseKey;
        }
        if (this.loading.has(baseKey)) return this.loading.get(baseKey);

        const promise = (async () => {
            // Simplified loading strategy: files are named with their exact English names (Nuzzle.mp3, etc.)
            const specialName = this.specialMappings[moveName?.toLowerCase()];
            
            // Build simple list of candidates: exact move name is primary
            let candidateNames = [moveName]; // ex: "nuzzle" or "levelUp"

            // Add Title-case variant (most likely match: Nuzzle or LevelUp)
            // Handle both space-separated words AND camelCase
            let titleCase;
            if (moveName.includes(' ')) {
                // Space-separated: "quick attack" → "Quick Attack"
                titleCase = moveName
                    .trim()
                    .split(' ')
                    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                    .join(' ');
            } else {
                // camelCase: "levelUp" → "LevelUp"
                titleCase = moveName.charAt(0).toUpperCase() + moveName.slice(1);
            }
            if (titleCase !== moveName) {
                candidateNames.push(titleCase); // ex: "Nuzzle" or "LevelUp"
            }
            // Add special mapping if exists
            if (specialName) {
                candidateNames.unshift(specialName);
            }

            // Default: try common audio formats.
            // For some event SFX we intentionally constrain to a single canonical file.
            let basePaths = [this.movePath, this.sfxPath];
            let tryExtensions = ['mp3', 'wav', 'ogg'];

            // Hard simplification requested: level up must be exactly levelup.mp3
            // - Only try the SFX folder
            // - Only try mp3
            // - Only try the canonical filename 'levelup'
            const isLevelUp = (String(moveName || '').toLowerCase() === 'levelup') || (String(specialName || '').toLowerCase() === 'levelup');
            if (isLevelUp) {
                basePaths = [this.sfxPath];
                tryExtensions = ['mp3'];
                candidateNames = ['levelup'];
            }

            // IMPORTANT: do not depend on fetch(HEAD)/content-type checks.
            // Some hosts/CDNs return missing/incorrect content-types for audio (e.g. application/octet-stream),
            // and some environments handle HEAD differently. Let Phaser be the source of truth:
            // attempt load; on failure, try the next candidate.
            for (const candidate of candidateNames) {
                if (!candidate) continue;
                for (const basePath of basePaths) {
                    const tryPaths = [`/public${basePath}`, basePath];
                    for (const tryPath of tryPaths) {
                        for (const ext of tryExtensions) {
                            const url = this.buildUrl(candidate, ext, tryPath);
                            try {
                                await this.loadAudioForKey(baseKey, url);
                                this.loaded.add(baseKey);
                                console.log(`[SoundManager] ✓ Loaded move sound: ${candidate} (${url})`);
                                return baseKey;
                            } catch (e) {
                                // continue to next URL candidate
                            }
                        }
                    }
                }
            }

            // If no sound file exists, warn once and fail
            console.warn(`[SoundManager] ✗ Aucune piste trouvée pour ${moveName} (candidates: ${candidateNames.join(', ')})`);
            throw new Error('No move sound found');
        })();

        this.loading.set(baseKey, promise);
        try {
            const result = await promise;
            this.loading.delete(baseKey);
            return result;
        } catch (e) {
            this.loading.delete(baseKey);
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
            // If cached, play directly. (sound.get() only returns live Sound instances, not cached audio.)
            if (this.scene.cache && this.scene.cache.audio && this.scene.cache.audio.exists(key)) {
                console.debug(`[SoundManager] Playing cached move sound key=${key}`);
                this.scene.sound.play(key, { volume, rate, loop });
                this.loaded.add(key);
                return true;
            }

            // Else try to load
            await this.tryLoadMoveSound(requested);
            // Play
            this.scene.sound.play(key, { volume, rate, loop });
            return true;
        } catch (e) {
            // fallback: play generic move sound if exists
            // Try explicit fallback: attempt to load and play 'Tackle' sound
            try {
                const tackleName = 'tackle';
                const tackleKey = this.buildKey(tackleName);
                // If already loaded, play directly
                if (this.scene.sound.get(tackleKey)) {
                    this.scene.sound.play(tackleKey, { volume, rate, loop });
                    return true;
                }
                // Try to load 'tackle' sound (will throw if not found)
                await this.tryLoadMoveSound(tackleName);
                if (this.scene.sound.get(tackleKey)) {
                    this.scene.sound.play(tackleKey, { volume, rate, loop });
                    return true;
                }
            } catch (tErr) {
                // ignore and continue to other fallbacks
                console.warn('[SoundManager] Fallback Tackle absent or failed to load:', tErr && tErr.message ? tErr.message : tErr);
            }

            // fallback: play generic move sound if exists
            // Try direct HTMLAudio fallback for 'Tackle' (most reliable last-resort)
            try {
                const exts = ['mp3', 'wav', 'ogg'];
                const nameVariants = ['Tackle', 'tackle', 'TACKLE'];
                const basePaths = [this.movePath, this.sfxPath, `/public${this.movePath}`, `/public${this.sfxPath}`];
                for (const base of basePaths) {
                    for (const name of nameVariants) {
                        for (const ext of exts) {
                            const url = `${base}${encodeURIComponent(name)}.${ext}`;
                            try {
                                const audio = new Audio(url);
                                audio.volume = Math.max(0, Math.min(1, volume));
                                const p = audio.play();
                                if (p && typeof p.then === 'function') {
                                    await p;
                                    console.warn('[SoundManager] Played fallback Tackle via HTMLAudio:', url);
                                    return true;
                                }
                            } catch (htmlErr) {
                                // try next
                                // console.debug('[SoundManager] HTMLAudio fallback failed for', url, htmlErr && htmlErr.message);
                                continue;
                            }
                        }
                    }
                }
            } catch (audioErr) {
                console.warn('[SoundManager] HTMLAudio fallback error:', audioErr && audioErr.message ? audioErr.message : audioErr);
            }

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

    /**
     * Returns the decoded audio duration in seconds if available.
     * Falls back to `fallbackSeconds` when duration cannot be determined.
     */
    getAudioDurationSecondsByKey(key, fallbackSeconds = 2.0) {
        try {
            const cache = this.scene?.cache?.audio;
            if (!cache || !cache.exists(key)) return fallbackSeconds;

            const entry = cache.get(key);

            // WebAudio: { data: AudioBuffer }
            const duration = entry?.data?.duration;
            if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
                return duration;
            }

            // Some Phaser builds may store an array of HTMLAudioElements
            if (Array.isArray(entry) && entry[0] && typeof entry[0].duration === 'number' && entry[0].duration > 0) {
                return entry[0].duration;
            }
        } catch (e) {
            // ignore
        }
        return fallbackSeconds;
    }

    /**
     * Plays a slice of an audio track (seek + duration).
     * Useful for dynamic XP-gain audio (only play the segment matching the bar movement).
     *
     * Returns the created sound instance (or null if not played).
     */
    async playMoveSoundSegment(
        moveName,
        { volume = 1.0, rate = 1.0, seek = 0.0, duration = null } = {}
    ) {
        const requested = moveName && String(moveName).trim() ? moveName : 'generic';
        if (!this.scene || !this.scene.sound) return null;

        const key = this.buildKey(requested);

        try {
            if (!(this.scene.cache && this.scene.cache.audio && this.scene.cache.audio.exists(key))) {
                await this.tryLoadMoveSound(requested);
            }

            const instance = this.scene.sound.add(key);
            if (!instance) return null;

            const safeSeek = Math.max(0, Number(seek) || 0);
            const safeRate = (Number.isFinite(Number(rate)) && Number(rate) > 0) ? Number(rate) : 1.0;

            instance.play({ volume, rate: safeRate, loop: false, seek: safeSeek });

            if (duration !== null && duration !== undefined) {
                const safeDuration = Math.max(0, Number(duration) || 0);
                const realMs = Math.max(0, (safeDuration / safeRate) * 1000);
                setTimeout(() => {
                    try { instance.stop(); } catch (e) { /* ignore */ }
                    try { instance.destroy(); } catch (e) { /* ignore */ }
                }, realMs);
            } else {
                // Auto-cleanup when it ends
                try {
                    instance.once('complete', () => {
                        try { instance.destroy(); } catch (e) { /* ignore */ }
                    });
                } catch (e) {
                    // ignore
                }
            }

            return instance;
        } catch (e) {
            console.warn('[SoundManager] playMoveSoundSegment failed for', moveName || requested, e && e.message ? e.message : e);
            return null;
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
