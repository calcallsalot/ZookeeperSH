const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000", // Next dev server
    methods: ["GET", "POST"],
    credentials: true,
  },
  path: "/socket.io",
});

io.on("connection", (socket) => {
  console.log("[io] connected:", socket.id);

  // Example createLobby handler
  socket.on("lobby:create", () => {
    const lobbyId = Math.random().toString(36).slice(2, 8).toUpperCase();
    console.log("[io] lobby:create =>", lobbyId);
    socket.emit("lobby:created", { lobbyId });
  });

  socket.on("disconnect", (reason) => {
    console.log("[io] disconnected:", socket.id, reason);
  });
});

app.get("/", (req, res) => res.send("socket server ok"));

httpServer.listen(3001, "127.0.0.1", () => {
  console.log("Socket.IO server listening on http://127.0.0.1:3001");
});
