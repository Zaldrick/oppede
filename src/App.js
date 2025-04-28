import { GameScene } from "./GameScene";
import Phaser from "phaser";
import VirtualJoystickPlugin from "phaser3-rex-plugins/plugins/virtualjoystick-plugin.js";
import React, { useEffect, useRef } from "react";

const Game = () => {
    const phaserGameRef = useRef(null); // Stocke l'instance du jeu Phaser

    useEffect(() => {
        if (phaserGameRef.current) {
            return; // Empêche de recréer le jeu plusieurs fois
        }

        const config = {
          type: Phaser.AUTO,
          parent: 'game-container',  // L'élément div qui contiendra le jeu
          width: window.innerWidth,
          height: window.innerHeight,
          scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
          },
          physics: {
            default: "arcade",
            arcade: {
              debug: false,
            },
          },
          scene: [GameScene],
          plugins: {
            global: [
              {
                key: "rexVirtualJoystick",
                plugin: VirtualJoystickPlugin,
                start: true,
              },
            ],
          },
        };

        phaserGameRef.current = new Phaser.Game(config); // Stocke l'instance du jeu

    }, []);

    return <div id="game-container"></div>;
};

export default Game;
