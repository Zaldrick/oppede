const { Server } = require("socket.io");

let players = {};

function setupWebSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: ["http://localhost:3000","http://localhost:5000"], 
//                "https://fc15-89-82-23-250.ngrok-free.app", "https://a1ff-89-82-23-250.ngrok-free.app"],
            methods: ["GET", "POST"],
        },
    });

    io.on("connection", (socket) => {
        console.log(`Player connected: ${socket.id}`);

        // Handle new player joining
        socket.on("newPlayer", (data) => {
            players[socket.id] = { x: data.x, y: data.y, character: data.character };
            console.log(`New player: ${socket.id}`);
        });

        // Handle player movement
        socket.on("playerMove", (data) => {
            if (players[socket.id]) {
                players[socket.id].x = data.x;
                players[socket.id].y = data.y;
                players[socket.id].anim = data.anim;
            }
        });

        // Handle interactions
        socket.on("interaction", (data) => {
            console.log(`Interaction from ${data.from} to ${data.to}: ${data.message}`);
            socket.emit("interactionFeedback", { ...data, type: "emitter" });
            socket.to(data.to).emit("interactionFeedback", { ...data, type: "receiver" });
        });

        // Handle chat messages
        socket.on("chatMessage", (data, callback) => {
            console.log(`Received chatMessage from ${socket.id}:`, data);

            // Broadcast the message to all connected clients
            io.emit("chatMessage", data);

            // Send acknowledgment back to the sender
            if (callback) {
                callback({ status: "ok", received: true });
            }
        });

        // Handle player challenges
        socket.on("challengePlayer", ({ from, to }, callback) => {
            if (!players[to]) {
                callback({ status: "error", message: "Player not found" });
                return;
            }

            // Notify the challenged player
            io.to(to).emit("challengeReceived", { from });

            // Set a timeout for the response
            const timeout = setTimeout(() => {
                io.to(from).emit("challengeResponse", { to, accepted: false, reason: "timeout" });
            }, 10000); // 10 seconds

            // Listen for the response
            socket.on("challengeResponse", ({ accepted }) => {
                clearTimeout(timeout); // Clear the timeout
                io.to(from).emit("challengeResponse", { to, accepted });
            });
        });

        // Handle player disconnect
        socket.on("disconnect", () => {
            console.log(`Player disconnected: ${socket.id}`);
            delete players[socket.id];
        });
    });

    // Broadcast player updates
    setInterval(() => {
        io.emit("playersUpdate", players);
    }, 50);
}

module.exports = { setupWebSocket };
