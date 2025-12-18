export default class MusicManager {
    static currentMusic = null;
    static currentKey = null;
    static previousMusic = null;
    static previousKey = null;

    static play(scene, key, config = { loop: true, volume: 0.5 }) {
        if (!scene || !scene.sound) return;

        // If audio failed to decode or failed to load, Phaser won't put it in the cache.
        // Guard to avoid crashing the whole scene.
        try {
            if (!scene.cache?.audio?.exists?.(key)) {
                console.warn(`[MusicManager] Audio key "${key}" not in cache (decode/load failure?). Skipping play.`);
                return;
            }
        } catch (e) {
            // If cache checks fail for any reason, continue but keep the try/catch around add/play.
        }

        if (MusicManager.currentMusic && MusicManager.currentKey === key) {
            if (MusicManager.currentMusic.isPaused) MusicManager.currentMusic.resume();
            return;
        }
        // If there's an existing music playing and it's a different key, stop/destroy it
        if (MusicManager.currentMusic && MusicManager.currentKey !== key) {
            try { MusicManager.currentMusic.stop(); MusicManager.currentMusic.destroy(); } catch (e) {}
            MusicManager.currentMusic = null;
            MusicManager.currentKey = null;
        }
        try {
            MusicManager.currentMusic = scene.sound.add(key, config);
            MusicManager.currentMusic.play();
            MusicManager.currentKey = key;
        } catch (e) {
            console.warn(`[MusicManager] Failed to play audio key "${key}":`, e);
            try { MusicManager.currentMusic?.destroy?.(); } catch (err) {}
            MusicManager.currentMusic = null;
            MusicManager.currentKey = null;
        }
    }

    static pause() {
        if (MusicManager.currentMusic) MusicManager.currentMusic.pause();
    }

    static resume() {
        if (MusicManager.currentMusic && MusicManager.currentMusic.isPaused) MusicManager.currentMusic.resume();
    }

    static stop() {
        if (MusicManager.currentMusic) {
            MusicManager.currentMusic.stop();
            MusicManager.currentMusic.destroy();
            MusicManager.currentMusic = null;
            MusicManager.currentKey = null;
        }
    }

    // Play a temporary overlaying music: pause current, save it, then play the new one
    static playOver(scene, key, config = { loop: true, volume: 0.5 }) {
        if (!scene || !scene.sound) return;

        try {
            if (!scene.cache?.audio?.exists?.(key)) {
                console.warn(`[MusicManager] Audio key "${key}" not in cache (decode/load failure?). Skipping playOver.`);
                return;
            }
        } catch (e) {
            // ignore
        }

        // If there's an existing currentMusic and it's a different key, save and pause it
        if (MusicManager.currentMusic && MusicManager.currentKey !== key) {
            try {
                MusicManager.previousMusic = MusicManager.currentMusic;
                MusicManager.previousKey = MusicManager.currentKey;
                MusicManager.previousMusic.pause();
            } catch (e) { /* ignore */ }
        }

        // Play the new music (stop / destroy currentMusic if it's same key)
        if (MusicManager.currentMusic && MusicManager.currentKey === key) {
            if (MusicManager.currentMusic.isPaused) MusicManager.currentMusic.resume();
            return;
        }

        if (MusicManager.currentMusic) {
            MusicManager.currentMusic.stop();
            MusicManager.currentMusic.destroy();
        }

        try {
            MusicManager.currentMusic = scene.sound.add(key, config);
            MusicManager.currentMusic.play();
            MusicManager.currentKey = key;
        } catch (e) {
            console.warn(`[MusicManager] Failed to playOver audio key "${key}":`, e);
            try { MusicManager.currentMusic?.destroy?.(); } catch (err) {}
            MusicManager.currentMusic = null;
            MusicManager.currentKey = null;
        }
    }

    // Stop the current overlay music and restore the previous music if any
    static restorePrevious() {
        // Stop current
        if (MusicManager.currentMusic) {
            try { MusicManager.currentMusic.stop(); MusicManager.currentMusic.destroy(); } catch (e) {}
            MusicManager.currentMusic = null;
            MusicManager.currentKey = null;
        }

        // Resume previous if available
        if (MusicManager.previousMusic) {
            try {
                MusicManager.currentMusic = MusicManager.previousMusic;
                MusicManager.currentKey = MusicManager.previousKey;
                MusicManager.currentMusic.resume();
            } catch (e) {
                try { if (MusicManager.previousKey && MusicManager.currentMusic?.scene) MusicManager.play(MusicManager.currentMusic.scene, MusicManager.previousKey); } catch (err) {}
            }
        }

        MusicManager.previousMusic = null;
        MusicManager.previousKey = null;
    }

    static isPlaying(key) {
        return (
            MusicManager.currentMusic &&
            MusicManager.currentMusic.isPlaying &&
            MusicManager.currentKey === key
        );
    }
}