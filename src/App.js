import { GameScene } from "./GameScene";
import { InventoryScene } from "./InventoryScene";
import { QuestScene } from "./QuestScene";
import { MainMenuScene } from "./MainMenuScene";
import { TripleTriadSelectScene } from './TripleTriadSelectScene';
import { TripleTriadGameScene } from './TripleTriadGameScene';
import { PhotoGalleryScene } from "./PhotoGalleryScene";
import { QuizGameScene } from "./QuizGameScene";
import { QuizLobbyScene } from "./QuizLobbyScene";
import BoosterOpeningScene from './BoosterOpeningScene';
import { TripleTriadAIConfigScene } from './TripleTriadAIConfigScene';
import { TripleTriadPvPConfigScene } from './TripleTriadPvPConfigScene';
import { PokemonTeamScene } from './PokemonTeamScene';
import { PokemonDetailScene } from './PokemonDetailScene';
import { PokemonBattleScene } from './PokemonBattleScene';
import { PokemonEvolutionScene } from './PokemonEvolutionScene';
import MoveLearnScene from './MoveLearnScene';
import CaptureScene from './CaptureScene';
import { PinCodeScene } from './PinCodeScene';
import Phaser from "phaser";
import React, { useEffect, useRef, useState } from "react";
import VirtualJoystickPlugin from "phaser3-rex-plugins/plugins/virtualjoystick-plugin.js";
import Chat from "./Chat"; // Import the Chat component
import useChat from "./useChat"; // Import the custom hook for chat functionality

const Game = () => {
    const phaserGameRef = useRef(null);
    const { messages, sendMessage } = useChat(); // Use the chat hook to manage messages
    const [isChatVisible, setChatVisible] = useState(false); // State to control chat visibility
    const [debugText, setDebugText] = useState("");
    const debugEnabled = (() => {
        try {
            return new URLSearchParams(window.location.search).get('debug') === '1';
        } catch (e) {
            return false;
        }
    })();

    useEffect(() => {
        if (phaserGameRef.current) {
            return; // Prevent recreating the game multiple times
        }

        const rendererOverride = (() => {
            try {
                return new URLSearchParams(window.location.search).get('renderer');
            } catch (e) {
                return null;
            }
        })();

        // Renderer selection
        // Use AUTO by default (prefers WebGL, falls back to Canvas).
        // Keep an override for debugging / forcing a renderer:
        // - ?renderer=webgl
        // - ?renderer=canvas
        let phaserRendererType = Phaser.AUTO;
        if (rendererOverride === 'webgl') phaserRendererType = Phaser.WEBGL;
        else if (rendererOverride === 'canvas') phaserRendererType = Phaser.CANVAS;

        const config = {
            type: phaserRendererType,
            parent: 'game-container',
            width: window.innerWidth,
            height: window.innerHeight,
            pixelArt: true, // Fixes texture bleeding/blurriness
            roundPixels: true, // Forces integer coordinates to prevent sub-pixel artifacts
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
            scene: [MainMenuScene, GameScene, InventoryScene, QuestScene, TripleTriadSelectScene, TripleTriadGameScene, BoosterOpeningScene, PhotoGalleryScene, QuizGameScene, QuizLobbyScene, TripleTriadAIConfigScene, TripleTriadPvPConfigScene, PokemonTeamScene, PokemonDetailScene, PokemonBattleScene, PokemonEvolutionScene, MoveLearnScene, CaptureScene, PinCodeScene],
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

        // Surface WebGL context loss on devices (otherwise it often looks like a silent black screen).
        try {
            const canvas = phaserGameRef.current?.canvas;
            if (canvas) {
                canvas.addEventListener('webglcontextlost', (e) => {
                    try { e.preventDefault(); } catch (err) {}
                    console.error('[Phaser] WebGL context lost');
                }, { passive: false });
            }
        } catch (e) {
            // ignore
        }

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

    useEffect(() => {
        if (!debugEnabled) return;

        const update = () => {
            try {
                // __phaserStatus is expected to be a multi-line rolling history.
                // Fallback to history array if needed.
                const direct = window.__phaserStatus;
                if (typeof direct === 'string') {
                    setDebugText(direct);
                    return;
                }
                const history = window.__phaserStatusHistory;
                if (Array.isArray(history)) {
                    setDebugText(history.map(v => String(v)).join('\n'));
                    return;
                }
                setDebugText(String(direct || ""));
            } catch (e) {
                setDebugText('');
            }
        };

        update();
        window.addEventListener('phaser-status', update);
        window.addEventListener('error', update);
        window.addEventListener('unhandledrejection', update);
        return () => {
            window.removeEventListener('phaser-status', update);
            window.removeEventListener('error', update);
            window.removeEventListener('unhandledrejection', update);
        };
    }, [debugEnabled]);


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
            {debugEnabled && (
                <div
                    id="phaser-debug-overlay"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 999999,
                        padding: '6px 8px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        color: '#fff',
                        background: 'rgba(0,0,0,0.65)',
                        pointerEvents: 'none',
                        whiteSpace: 'pre-wrap',
                    }}
                >
                    {debugText || 'Debug actif (aucun status)'}
                </div>
            )}
            <div id="game-container" style={{ position: "relative", width: "100%", height: "100%" }}></div>
            {isChatVisible && <Chat messages={messages} onSendMessage={sendMessage} />}
        </div>
    );
};

export default Game;