import React, { useState, useEffect } from "react";

const Chat = ({ messages, onSendMessage }) => {
  const [currentMessage, setCurrentMessage] = useState("");
  const [messageQueue, setMessageQueue] = useState([]); // FIFO queue for messages

  useEffect(() => {
    if (messages.length > 0) {
      const newMessage = messages[messages.length - 1];
      setMessageQueue((prev) => [...prev, newMessage]); // Add new message to the queue
    }
  }, [messages]);

  useEffect(() => {
    if (messageQueue.length > 0) {
      // Remove the oldest message every 5 seconds
      const interval = setInterval(() => {
        setMessageQueue((prev) => prev.slice(1)); // Remove the first message (FIFO)
      }, 5000);

      return () => clearInterval(interval); // Cleanup interval on unmount
    }
  }, [messageQueue]);

  const handleSendMessage = () => {
    if (currentMessage.trim()) {
      onSendMessage(currentMessage);
      setCurrentMessage(""); // Clear the input field
    }
  };

  return (
    <div id="chat-container">
      {/* Chat messages displayed from the top */}
      <div id="chat-messages" style={{ position: "absolute", top: "10px", left: "10px", right: "10px", zIndex: 1000 }}>
        {messageQueue.map((msg, index) => (
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
            <strong>{msg.sender} :</strong> {msg.message}
          </div>
        ))}
      </div>

      {/* Input field at the bottom */}
      <div id="chat-input" style={{ position: "absolute", bottom: "10px", left: "10px", right: "10px", zIndex: 1000, display: "flex" }}>
        <input
          type="text"
          value={currentMessage}
          placeholder="Écrire un message..."
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
          Envoyer
        </button>
      </div>
    </div>
  );
};

export default Chat;
