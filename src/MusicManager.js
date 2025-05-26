export default class MusicManager {
    static currentMusic = null;
    static currentKey = null;

    static play(scene, key, config = { loop: true, volume: 0.5 }) {
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

    static isPlaying(key) {
        return (
            MusicManager.currentMusic &&
            MusicManager.currentMusic.isPlaying &&
            MusicManager.currentKey === key
        );
    }
}