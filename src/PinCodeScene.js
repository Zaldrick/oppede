import Phaser from 'phaser';

export class PinCodeScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PinCodeScene' });
    }

    init(data) {
        this.targetCode = data.targetCode || '0000';
        this.onSuccess = data.onSuccess;
        this.onFailure = data.onFailure; // Called on "Retour" or max attempts if implemented
        this.maxAttempts = data.maxAttempts || Infinity;
        this.currentCode = '';
        this.attempts = 0;
    }

    preload() {
        // Load sounds if not already loaded
        if (!this.cache.audio.exists('digit')) this.load.audio('digit', '/assets/sounds/digit.wav');
        if (!this.cache.audio.exists('effacer')) this.load.audio('effacer', '/assets/sounds/effacer.wav');
        if (!this.cache.audio.exists('error')) this.load.audio('error', '/assets/sounds/error.wav');
        if (!this.cache.audio.exists('succes')) this.load.audio('succes', '/assets/sounds/succes.wav');
    }

    create() {
        // Background overlay
        this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.8).setOrigin(0);

        // Calculate dimensions for 9:16 ratio
        const { width, height } = this.scale;
        const targetRatio = 9 / 16;
        
        let containerWidth = width;
        let containerHeight = height;

        if (width / height > targetRatio) {
            // Screen is wider than 9:16 (e.g. PC), constrain width
            containerWidth = height * targetRatio;
        } else {
            // Screen is taller or equal to 9:16 (e.g. Mobile), use full width
            // (or constrain height if needed, but usually full screen on mobile is fine)
        }

        const centerX = width / 2;
        const centerY = height / 2;

        // Main Container
        this.container = this.add.container(centerX, centerY);

        // Background for the PIN pad area
        const bg = this.add.rectangle(0, 0, containerWidth, containerHeight, 0x222222).setOrigin(0.5);
        this.container.add(bg);

        // --- Display Screen ---
        const screenY = -containerHeight * 0.3;
        const screenBg = this.add.rectangle(0, screenY, containerWidth * 0.8, containerHeight * 0.15, 0x000000).setOrigin(0.5);
        screenBg.setStrokeStyle(2, 0x00ff00);
        this.container.add(screenBg);

        this.codeText = this.add.text(0, screenY, '', {
            fontFamily: 'Arial',
            fontSize: `${containerHeight * 0.08}px`,
            color: '#00ff00',
            align: 'center'
        }).setOrigin(0.5);
        this.container.add(this.codeText);

        // --- Keypad ---
        const keypadStartY = -containerHeight * 0.13;
        const buttonSize = containerWidth * 0.2;
        const gap = containerWidth * 0.02;

        const keys = [
            '1', '2', '3',
            '4', '5', '6',
            '7', '8', '9',
            '', '0', '' // Empty strings for layout alignment
        ];

        keys.forEach((key, index) => {
            if (key === '') return;

            const row = Math.floor(index / 3);
            const col = index % 3;
            
            const x = (col - 1) * (buttonSize + gap);
            const y = keypadStartY + row * (buttonSize + gap);

            this.createKeypadButton(x, y, buttonSize, key);
        });

        // --- Control Buttons ---
        const controlsY = containerHeight * 0.35;
        const controlBtnWidth = containerWidth * 0.25;
        const controlBtnHeight = containerHeight * 0.08;

        // Retour
        const doReturn = () => {
            try { if (this.onFailure) this.onFailure(); } catch (e) {}
            this.scene.stop();
        };

        this.createControlButton(-containerWidth * 0.3, controlsY, controlBtnWidth, controlBtnHeight, 'Retour', 0xff0000, () => {
            doReturn();
        });

        // Effacer
        this.createControlButton(0, controlsY, controlBtnWidth, controlBtnHeight, 'Effacer', 0xffaa00, () => {
            this.handleDelete();
        });

        // Valider
        this.createControlButton(containerWidth * 0.3, controlsY, controlBtnWidth, controlBtnHeight, 'Valider', 0x00aa00, () => {
            this.handleValidate();
        });

        // --- Keyboard controls ---
        // ESC = Retour, Backspace/Delete = Effacer, Enter = Valider,
        // Digits: top row + numpad.
        const KeyCodes = Phaser.Input.Keyboard.KeyCodes;

        const escKey = this.input.keyboard.addKey(KeyCodes.ESC);
        const enterKey = this.input.keyboard.addKey(KeyCodes.ENTER);
        const backspaceKey = this.input.keyboard.addKey(KeyCodes.BACKSPACE);
        const deleteKey = this.input.keyboard.addKey(KeyCodes.DELETE);

        const digitKeyCodes = [
            KeyCodes.ZERO, KeyCodes.ONE, KeyCodes.TWO, KeyCodes.THREE, KeyCodes.FOUR,
            KeyCodes.FIVE, KeyCodes.SIX, KeyCodes.SEVEN, KeyCodes.EIGHT, KeyCodes.NINE,
            KeyCodes.NUMPAD_ZERO, KeyCodes.NUMPAD_ONE, KeyCodes.NUMPAD_TWO, KeyCodes.NUMPAD_THREE, KeyCodes.NUMPAD_FOUR,
            KeyCodes.NUMPAD_FIVE, KeyCodes.NUMPAD_SIX, KeyCodes.NUMPAD_SEVEN, KeyCodes.NUMPAD_EIGHT, KeyCodes.NUMPAD_NINE
        ];

        const digitKeys = digitKeyCodes.map((kc) => this.input.keyboard.addKey(kc));

        const consume = (evt) => {
            try { if (evt && typeof evt.preventDefault === 'function') evt.preventDefault(); } catch (e) {}
            try { if (evt && typeof evt.stopPropagation === 'function') evt.stopPropagation(); } catch (e) {}
        };

        escKey.on('down', (evt) => {
            consume(evt);
            doReturn();
        });

        enterKey.on('down', (evt) => {
            consume(evt);
            this.handleValidate();
        });

        backspaceKey.on('down', (evt) => {
            consume(evt);
            this.handleDelete();
        });

        deleteKey.on('down', (evt) => {
            consume(evt);
            this.handleDelete();
        });

        digitKeys.forEach((k) => {
            k.on('down', (evt) => {
                consume(evt);
                // Phaser key provides the keyCode; convert to digit.
                const code = k.keyCode;
                let digit = null;

                if (code >= KeyCodes.ZERO && code <= KeyCodes.NINE) {
                    digit = String(code - KeyCodes.ZERO);
                } else if (code >= KeyCodes.NUMPAD_ZERO && code <= KeyCodes.NUMPAD_NINE) {
                    digit = String(code - KeyCodes.NUMPAD_ZERO);
                }

                if (digit !== null) {
                    this.handleInput(digit);
                }
            });
        });

        // Cleanup to avoid duplicate handlers if the scene is reopened.
        this.events.once('shutdown', () => {
            try { escKey?.removeAllListeners?.(); } catch (e) {}
            try { enterKey?.removeAllListeners?.(); } catch (e) {}
            try { backspaceKey?.removeAllListeners?.(); } catch (e) {}
            try { deleteKey?.removeAllListeners?.(); } catch (e) {}
            try { digitKeys?.forEach?.((k) => { try { k?.removeAllListeners?.(); } catch (e) {} }); } catch (e) {}
        });
    }

    createKeypadButton(x, y, size, label) {
        const btn = this.add.rectangle(x, y, size, size, 0x444444).setOrigin(0.5).setInteractive();
        const text = this.add.text(x, y, label, {
            fontFamily: 'Arial',
            fontSize: `${size * 0.5}px`,
            color: '#ffffff'
        }).setOrigin(0.5);

        btn.on('pointerdown', () => {
            btn.setFillStyle(0x666666);
        });

        btn.on('pointerup', () => {
            btn.setFillStyle(0x444444);
            this.handleInput(label);
        });

        btn.on('pointerout', () => {
            btn.setFillStyle(0x444444);
        });

        this.container.add([btn, text]);
    }

    createControlButton(x, y, width, height, label, color, callback) {
        const btn = this.add.rectangle(x, y, width, height, color).setOrigin(0.5).setInteractive();
        const text = this.add.text(x, y, label, {
            fontFamily: 'Arial',
            fontSize: `${height * 0.4}px`,
            color: '#ffffff'
        }).setOrigin(0.5);

        btn.on('pointerdown', () => {
            btn.setAlpha(0.8);
        });

        btn.on('pointerup', () => {
            btn.setAlpha(1);
            callback();
        });

        btn.on('pointerout', () => {
            btn.setAlpha(1);
        });

        this.container.add([btn, text]);
    }

    handleInput(digit) {
        if (this.currentCode.length < 8) { // Max length limit
            this.currentCode += digit;
            this.updateDisplay();
            this.sound.play('digit');
        }
    }

    handleDelete() {
        if (this.currentCode.length > 0) {
            this.currentCode = this.currentCode.slice(0, -1);
            this.updateDisplay();
            this.sound.play('effacer');
        }
    }

    handleValidate() {
        if (this.currentCode === this.targetCode) {
            this.sound.play('succes');
            this.time.delayedCall(500, () => {
                if (this.onSuccess) this.onSuccess();
                this.scene.stop();
            });
        } else {
            this.sound.play('error');
            this.shakeScreen();
            this.currentCode = '';
            this.updateDisplay();
        }
    }

    updateDisplay() {
        // Show asterisks or the actual numbers? Usually PINs are hidden, but user said "affichant les codes entrés"
        // Let's show the numbers for now as per "Un petit écran affichant les codes entrés"
        this.codeText.setText(this.currentCode);
    }

    shakeScreen() {
        this.cameras.main.shake(200, 0.01);
    }
}
