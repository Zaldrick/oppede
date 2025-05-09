import { GameScene } from "./GameScene";
import { InventoryScene } from "./InventoryScene"; // Import InventoryScene
import Phaser from "phaser";
import VirtualJoystickPlugin from "phaser3-rex-plugins/plugins/virtualjoystick-plugin.js";
import React, { useEffect, useRef, useState } from "react";
import Chat from "./Chat";
import useChat from "./useChat";

const Game = () => {
    const phaserGameRef = useRef(null); // Store the Phaser game instance
    const socketRef = useRef(null); // Store the WebSocket connection
    const { messages, sendMessage } = useChat();
    const [pseudo, setPseudo] = useState(""); // State for pseudo
    const [isPseudoSet, setIsPseudoSet] = useState(false); // State to check if pseudo is set
    const [pseudoError, setPseudoError] = useState(""); // State for pseudo validation error
    const [appearance, setAppearance] = useState(""); // State for player appearance

    useEffect(() => {
        if (phaserGameRef.current || !isPseudoSet) {
            return; // Prevent recreating the game multiple times or if pseudo is not set
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
            scene: [GameScene, InventoryScene], // Add InventoryScene here
            plugins: {
                global: [
                    {
                        key: "rexVirtualJoystick",
                        plugin: VirtualJoystickPlugin,
                        start: true,
                    },
                ],
            },
            callbacks: {
                preBoot: (game) => {
                    game.registry.set("playerPseudo", pseudo); // Pass pseudo to the game
                    game.registry.set("playerAppearance", appearance); // Pass appearance to the game
                },
            },
        };

        phaserGameRef.current = new Phaser.Game(config); // Store the Phaser game instance

        const socket = socketRef.current; // Copiez la valeur de socketRef.current dans une variable locale

        return () => {
            // Clean up WebSocket connection on unmount
            if (socket) {
                socket.disconnect();
            }
        };
    }, [isPseudoSet, appearance, pseudo]); // Ajoutez 'pseudo' comme dépendance

    const handlePseudoSubmit = async () => {
        if (pseudo.trim()) {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/players/${pseudo.trim()}`);
                if (response.ok) {
                    setAppearance(`/public/assets/apparences/${pseudo.trim()}.png`); // Set appearance based on pseudo
                    setIsPseudoSet(true);
                } else {
                    setPseudoError("Cette personne n'est pas en vacances ou alors tu sais pas écrire ton prénom");
                }
            } catch (error) {
                console.error("Error validating pseudo:", error);
                setPseudoError("C'est full bugué dsl");
            }
        } else {
            setPseudoError("Ecrit un truc batard");
        }
    };

    if (!isPseudoSet) {
        return (
            <div id="pseudo-container" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh" }}>
                <h1>Qui joue ?</h1>
                <input
                    type="text"
                    value={pseudo}
                    onChange={(e) => {
                        setPseudo(e.target.value);
                        setPseudoError(""); // Clear error on input change
                    }}
                    placeholder="Ton prénom"
                    style={{ padding: "10px", fontSize: "16px", marginBottom: "10px" }}
                />
                {pseudoError && <p style={{ color: "red", marginBottom: "10px" }}>{pseudoError}</p>}
                <button
                    onClick={handlePseudoSubmit}
                    style={{ padding: "10px 20px", fontSize: "16px", cursor: "pointer" }}
                >
                    Démarrer
                </button>
            </div>
        );
    }

    return (
      <div id="app-container">
        <div id="game-container" style={{ position: "relative", width: "100%", height: "100%" }}></div>
        <Chat messages={messages} onSendMessage={sendMessage} />
      </div>
    );
};

export default Game;