import { GameScene } from "./GameScene";
import Phaser from "phaser";
import VirtualJoystickPlugin from "phaser3-rex-plugins/plugins/virtualjoystick-plugin.js";
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Chat from "./Chat";
import useChat from "./useChat";

const Game = () => {
    const phaserGameRef = useRef(null); // Store the Phaser game instance
    const socketRef = useRef(null); // Store the WebSocket connection
    const { messages, sendMessage } = useChat();
    useEffect(() => {
        if (phaserGameRef.current) {
            return; // Prevent recreating the game multiple times
        }

        const config = {
            type: Phaser.AUTO,
            parent: 'game-container', // The div element to contain the game
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

        phaserGameRef.current = new Phaser.Game(config); // Store the Phaser game instance

        return () => {
            // Clean up WebSocket connection on unmount
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);

    return (
      <div id="app-container">
        <div id="game-container" style={{ position: "relative", width: "100%", height: "100%" }}></div>
        <Chat messages={messages} onSendMessage={sendMessage} />
      </div>
    );
  };
  
export default Game;