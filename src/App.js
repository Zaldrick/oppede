import { GameScene } from "./GameScene";
import { InventoryScene } from "./InventoryScene";
import { MainMenuScene } from "./MainMenuScene";
import { TripleTriadSelectScene } from './TripleTriadSelectScene';
import { TripleTriadGameScene } from './TripleTriadGameScene';
import { PhotoGalleryScene } from "./PhotoGalleryScene";
import { QuizGameScene } from "./QuizGameScene";
import { QuizLobbyScene } from "./QuizLobbyScene";
import BoosterOpeningScene from './BoosterOpeningScene';
import { TripleTriadAIConfigScene } from './TripleTriadAIConfigScene';
import { TripleTriadPvPConfigScene } from './TripleTriadPvPConfigScene';
import Phaser from "phaser";
import React, { useEffect, useRef, useState } from "react";
import VirtualJoystickPlugin from "phaser3-rex-plugins/plugins/virtualjoystick-plugin.js";
import Chat from "./Chat"; // Import the Chat component
import useChat from "./useChat"; // Import the custom hook for chat functionality

const Game = () => {
    const phaserGameRef = useRef(null);
    const { messages, sendMessage } = useChat(); // Use the chat hook to manage messages
    const [isChatVisible, setChatVisible] = useState(false); // State to control chat visibility

    useEffect(() => {
        if (phaserGameRef.current) {
            return; // Prevent recreating the game multiple times
        }

        const config = {
            type: Phaser.AUTO,
            parent: 'game-container',
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
            dom: {
                createContainer: true, // Enable DOM elements
            },
            scene: [MainMenuScene, GameScene, InventoryScene, TripleTriadSelectScene, TripleTriadGameScene, BoosterOpeningScene, PhotoGalleryScene, QuizGameScene, QuizLobbyScene, TripleTriadAIConfigScene,TripleTriadPvPConfigScene],
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

        phaserGameRef.current = new Phaser.Game(config);

        // Listen for scene changes to toggle chat visibility
        phaserGameRef.current.events.on("scene-switch", (sceneKey) => {
            setChatVisible(sceneKey !== "MainMenuScene");
        });

        return () => {
            // Clean up Phaser game instance on unmount
            if (phaserGameRef.current) {
                phaserGameRef.current.destroy(true);
                phaserGameRef.current = null;
            }
        };
    }, []);


    return (
        <div
            id="app-container"
            style={{
                backgroundImage: "url('/assets/mainMenuBackground.png')", // Path to your background image
                backgroundSize: "cover", // Ensure the image covers the entire container
                backgroundPosition: "center", // Center the image
                width: "100%",
                height: "100%",
                position: "relative", // Ensure child elements are positioned relative to this container
            }}
        >
            <div id="game-container" style={{ position: "relative", width: "100%", height: "100%" }}></div>
            {isChatVisible && <Chat messages={messages} onSendMessage={sendMessage} />}
        </div>
    );
};

export default Game;