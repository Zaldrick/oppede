import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const useSocketClient = (url) => {
  const socketRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [players, setPlayers] = useState({});
  const [interactionFeedback, setInteractionFeedback] = useState(null);

  useEffect(() => {
    if (!socketRef.current) {
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

      // Chat messages
      socketRef.current.on("chatMessage", (data) => {
        setMessages((prevMessages) => [...prevMessages, { sender: data.id, message: data.message }]);
      });

      socketRef.current.on("chatHistory", (history) => {
        setMessages(history.map((msg) => ({ sender: msg.id, message: msg.message })));
      });

      // Players update
      socketRef.current.on("playersUpdate", (updatedPlayers) => {
        setPlayers(updatedPlayers);
      });

      // Interaction feedback
      socketRef.current.on("interactionFeedback", (data) => {
        setInteractionFeedback(data);
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [url]);

  const sendMessage = (message) => {
    const messageData = { message };
    socketRef.current.emit("chatMessage", messageData, (ack) => {
      if (ack && ack.status === "ok") {
        console.log("Server acknowledged chatMessage:", ack);
      } else {
        console.warn("No acknowledgment received for chatMessage or error occurred:", ack);
      }
    });
  };

  const emitEvent = (event, data, callback) => {
    socketRef.current.emit(event, data, callback);
  };

  return {
    sendMessage,
    emitEvent,
    messages,
    players,
    interactionFeedback,
  };
};

export default useSocketClient;
