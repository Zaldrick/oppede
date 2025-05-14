import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import PlayerService from "./services/PlayerService";

const useChat = () => {
  const [messages, setMessages] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    // Initialize WebSocket connection
    socketRef.current = io(process.env.REACT_APP_SOCKET_URL);

    socketRef.current.on("connect", () => {
    });

    socketRef.current.on("disconnect", () => {
    });

    socketRef.current.on("connect_error", (err) => {
      console.error("Connection error:", err);
    });

     socketRef.current.on('chatMessage', (data) => {
        const currentMapId =  PlayerService.getPlayerData()?.mapId;  // Récupérez l'id de la carte actuelle
        if (data.mapId === currentMapId) {
            const sender = data.pseudo || "Anonymous"; // Fallback to "Anonymous" if pseudo is not defined
            setMessages((prevMessages) => [...prevMessages, { sender, message: data.message }]);
        } else {
            console.log("(Map ",data.mapId,") ",data.pseudo, ": ",data.message);
        }
    });


    return () => {
      // Clean up WebSocket connection on unmount
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const sendMessage = (message) => {
    const playerPseudo = PlayerService.getPlayerData()?.pseudo; // Retrieve pseudo from PlayerService
    const mapId =  PlayerService.getPlayerData()?.mapId;  // Récupérez l'id de la carte actuelle
    if (!playerPseudo || mapId === undefined) {
        console.warn("Player pseudo or mapId is not available.");
        return;
    }

    const messageData = { pseudo: playerPseudo, message, mapId };
    socketRef.current.emit("chatMessage", messageData, (ack) => {
        if (ack && ack.status === "ok") {
            console.log("Server acknowledged chatMessage:", ack);
        } else {
            console.warn("No acknowledgment received for chatMessage or error occurred:", ack);
        }
    });
  };

  return { messages, sendMessage };
};

export default useChat;
