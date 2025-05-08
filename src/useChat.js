import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const useChat = () => {
  const [messages, setMessages] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    // Initialize WebSocket connection
    socketRef.current = io(process.env.REACT_APP_SOCKET_URL);

    socketRef.current.on("connect", () => {
      console.log("Connected to WebSocket server:", socketRef.current.id);
    });

    socketRef.current.on("disconnect", () => {
      console.log("Disconnected from WebSocket server");
    });

    socketRef.current.on("connect_error", (err) => {
      console.error("Connection error:", err);
    });

    // Listen for incoming chat messages
    socketRef.current.on("chatMessage", (data) => {
      setMessages((prevMessages) => [...prevMessages, { sender: data.pseudo, message: data.message }]);
    });

    return () => {
      // Clean up WebSocket connection on unmount
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const sendMessage = (message) => {
    const playerPseudo = localStorage.getItem("playerPseudo"); // Récupère le pseudo du joueur
    const messageData = { pseudo: playerPseudo, message };
    console.log("pseudoChat:", playerPseudo);
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
