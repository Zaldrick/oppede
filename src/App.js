import { GameScene } from "./GameScene";
import Phaser from "phaser";
import VirtualJoystickPlugin from "phaser3-rex-plugins/plugins/virtualjoystick-plugin.js";
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const Game = () => {
    const phaserGameRef = useRef(null); // Store the Phaser game instance
    const socketRef = useRef(null); // Store the WebSocket connection
    const [messages, setMessages] = useState([]); // State to store chat messages
    const [currentMessage, setCurrentMessage] = useState(""); // State for the current input message

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

        // Initialize WebSocket connection
        socketRef.current = io("https://9771-89-82-23-250.ngrok-free.app/");

        // Debug WebSocket connection
        socketRef.current.on("connect", () => {
            console.log("Connected to WebSocket server:", socketRef.current.id);
        });

        socketRef.current.on("disconnect", () => {
            console.log("Disconnected from WebSocket server");
        });

        socketRef.current.on("connect_error", (err) => {
            console.error("Connection error:", err); // Debug connection errors
        });

        // Listen for incoming chat messages
        socketRef.current.on("chatMessage", (data) => {
            console.log("Received message from server:", data); // Debug incoming messages
            setMessages((prevMessages) => [...prevMessages, { sender: data.sender, message: data.message }]);
        });

        return () => {
            // Clean up WebSocket connection on unmount
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);

    const handleSendMessage = () => {
        if (currentMessage.trim()) {
            const messageData = { sender: "You", message: currentMessage };

            // Emit the message to the server
            socketRef.current.emit("chatMessage", messageData);

            // Debug emitted message
            console.log("Sent message:", messageData);

            // Add the message to the local state
            setMessages((prevMessages) => [...prevMessages, messageData]);
            setCurrentMessage(""); // Clear the input field
        }
    };

    return (
        <div id="app-container">
            <div id="game-container" style={{ position: "relative", width: "100%", height: "100%" }}></div>

            {/* Chat messages displayed from the top */}
            <div id="chat-messages" style={{ position: "absolute", top: "10px", left: "10px", right: "10px", zIndex: 1000 }}>
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        style={{
                            backgroundColor: "rgba(0, 0, 0, 0.7)",
                            color: "white",
                            padding: "5px 10px",
                            marginBottom: "5px",
                            borderRadius: "5px",
                            fontSize: "14px",
                        }}
                    >
                        <strong>{msg.sender}:</strong> {msg.message}
                    </div>
                ))}
            </div>

            {/* Input field at the bottom */}
            <div id="chat-input" style={{ position: "absolute", bottom: "10px", left: "10px", right: "10px", zIndex: 1000, display: "flex" }}>
                <input
                    type="text"
                    value={currentMessage}
                    placeholder="Type a message..."
                    style={{ flex: 1, marginRight: "10px", padding: "10px", border: "1px solid #ccc", borderRadius: "5px" }}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            handleSendMessage();
                        }
                    }}
                />
                <button
                    onClick={handleSendMessage}
                    style={{
                        padding: "10px 20px",
                        backgroundColor: "#007bff",
                        color: "white",
                        border: "none",
                        borderRadius: "5px",
                        cursor: "pointer",
                    }}
                >
                    Send
                </button>
            </div>
        </div>
    );
};

export default Game;
