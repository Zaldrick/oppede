export default class MusicManager {
    static currentMusic = null;
    static currentKey = null;
    static previousMusic = null;
    static previousKey = null;

    static play(scene, key, config = { loop: true, volume: 0.5 }) {
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
        MusicManager.currentMusic = scene.sound.add(key, config);
        MusicManager.currentMusic.play();
        MusicManager.currentKey = key;
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

        MusicManager.currentMusic = scene.sound.add(key, config);
        MusicManager.currentMusic.play();
        MusicManager.currentKey = key;
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