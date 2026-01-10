const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = http.createServer(app);
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");



const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000", // Next dev server
    methods: ["GET", "POST"],
    credentials: true,
  },
  path: "/socket.io",
});

// --- In-memory presence store (socket.id -> player) ---
const online = new Map(); // { id, name, elo }
const onlineList = () => Array.from(online.values());


io.on("connection", (socket) => {
  console.log("[io] connected:", socket.id);

  // Log every event received (helps debug)
  socket.onAny((event, ...args) => {
    console.log("[io] recv:", event, args);
  });

  // Add default player presence on connect
  online.set(socket.id, { id: socket.id, name: "Guest", elo: 1600 });

  // Broadcast current online list to everyone 
  io.emit("onlinePlayers:update", onlineList());

  // Client tells server who they are
  socket.on("presence:set", ({ name, elo } = {}) => {
    const prev = online.get(socket.id) || { id: socket.id };

    online.set(socket.id, {
      ...prev,
      name: name ?? prev.name ?? "Guest",
      elo: typeof elo === "number" ? elo : (prev.elo ?? 1600),
    });

    io.emit("onlinePlayers:update", onlineList());
  });

  // Client asks for initial payload
  socket.on("init:get", () => {
    console.log("[io] init:get from", socket.id);

    socket.emit("init", {
      lobbies: [], // you can replace this with a real lobbies store later
      onlinePlayers: onlineList(),
    });
  });

  // Example createLobby handler (kept)
  socket.on("lobby:create", () => {
    const lobbyId = Math.random().toString(36).slice(2, 8).toUpperCase();
    console.log("[io] lobby:create =>", lobbyId);

    socket.emit("lobby:created", { lobbyId });

    // (Optional) if you later store lobbies, you'd io.emit("lobbies:update", ...)
  });

  socket.on("disconnect", (reason) => {
    console.log("[io] disconnected:", socket.id, reason);

    // Remove from presence and broadcast update
    online.delete(socket.id);
    io.emit("onlinePlayers:update", onlineList());
  });
});

app.get("/", (req, res) => res.send("socket server ok"));

httpServer.listen(3001, "127.0.0.1", () => {
  console.log("Socket.IO server listening on http://127.0.0.1:3001");
});
