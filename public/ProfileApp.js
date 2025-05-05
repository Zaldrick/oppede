import React from "react";
import ReactDOM from "react-dom/client";
import ProfileMenu from "../src/ProfileMenu"; // Ensure this path is correct
import io from "socket.io-client";

const socket = io("http://localhost:5000"); // Connect to the backend server

const App = () => <ProfileMenu socket={socket} />;

const root = ReactDOM.createRoot(document.getElementById("root")); // Use React 18's createRoot
root.render(<App />);
