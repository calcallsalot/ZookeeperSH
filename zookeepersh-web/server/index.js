require("dotenv").config({ path: ".env.local" }); // for .env.local support hosted on 3001 rn

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = http.createServer(app);
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { MongoClient, ObjectId } = require("mongodb");



const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000", // Next dev server
    methods: ["GET", "POST"],
    credentials: true,
  },
  path: "/socket.io",
});

const MONGODB_URI = process.env.MONGODB_URI; 
if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI env var");
}

const client = new MongoClient(MONGODB_URI);
let chatCol;

async function initMongo() {
  await client.connect();
  const db = client.db(); // uses db name from URI; or client.db("zookeeper")
  chatCol = db.collection("chat_messages");

  const TTL_SECONDS = 60 * 60 * 24; // TTL is 24 hours just do * 7 for 7 days
 
  await chatCol.createIndex({ createdAt: 1 }, { expireAfterSeconds: TTL_SECONDS });

  await chatCol.createIndex({ createdAt: 1 });

  console.log("[mongo] connected and indexes ensured");
}

function canPlayOrChat(socket) {
  const p = online.get(socket.id);
  return !!p && p.authed
}

// --- In-memory presence store (socket.id -> player) ---
const online = new Map(); // { id, name, elo }
const onlineList = () => Array.from(online.values());


io.on("connection", (socket) => {
  console.log("[io] connected:", socket.id);

  // Log every event received (helps debug)
  socket.onAny((event, ...args) => {
    console.log("[io] recv:", event, args);
  });

  // default presence
  online.set(socket.id, { id: socket.id, name: "Guest", elo: null, authed: false });

  // Broadcast current online list to everyone 
  io.emit("onlinePlayers:update", onlineList());

  // Client tells server who they are
  socket.on("presence:set", ({ name, elo } = {}) => {

    const prev = online.get(socket.id) || { id: socket.id };
    const isGuest = !null || name === "Guest";


    online.set(socket.id, {
      ...prev,
      name: name ?? prev.name ?? "Guest",
      elo: typeof elo === "number" ? elo : (prev.elo ?? 1600),
    });

    io.emit("onlinePlayers:update", onlineList());
  });

  
  /*socket.on("init:get", () => {
    console.log("[io] init:get from", socket.id);

    socket.emit("init", {
      lobbies: [], 
      onlinePlayers: onlineList(),
    });
  });*/

  socket.on("init:get", async () => {
    socket.emit("init", {
      lobbies: [],
      onlinePlayers: onlineList(),
    });

    try {
      if (!chatCol) {
        socket.emit("chat:history", []);
        return;
      }
      const since = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // TTL is 24 hours so if you want 7 days change from 1 * to 7 * 
      const msgs = await chatCol
        .find({ createdAt: { $gte: since } })
        .sort({ createdAt: 1 })
        .limit(200)
        .toArray();

      
      socket.emit(
        "chat:history",
        msgs.map((m) => ({
          id: String(m._id),
          name: m.name,
          text: m.text,
          ts: m.ts ?? m.createdAt.getTime(),
        }))
      );
    } catch (e) {
      console.error("[chat] history error:", e);
      socket.emit("chat:history", []);
    }
  });

  // chat sending 
  socket.on("chat:send", async ({ text } = {}) => {
    if (!canPlayOrChat(socket)) {
      socket.emit("error:auth", { message: "Sign in required to chat." });
      return;
    }

    const msg = String(text ?? "").trim();
    if (!msg) return;
    if (msg.length > 300) {
      socket.emit("error:chat", { message: "Message too long (max 300 chars)." });
      return;
    }

    const player = online.get(socket.id);
    const doc = {
      name: player?.name ?? "Unknown",
      text: msg,
      ts: Date.now(),
      createdAt: new Date(), // TTL uses this
    };

    try {
      if (!chatCol) {
        socket.emit("error:chat", { message: "Chat DB not ready." });
        return;
      }

      const r = await chatCol.insertOne(doc);

      const payload = {
        id: String(r.insertedId),
        name: doc.name,
        text: doc.text,
        ts: doc.ts,
      };

      io.emit("chat:message", payload);
    } catch (e) {
      console.error("[chat] insert error:", e);
      socket.emit("error:chat", { message: "Failed to send message." });
    }
  });
  // Example createLobby handler (kept)
  socket.on("lobby:create", () => {
    if (!canPlayOrChat(socket)) {
      socket.emit("error:auth", { message: "Sign in required to create or join games." });
      return; // exists lobby:create handler
    }
    const lobbyId = Math.random().toString(36).slice(2, 8).toUpperCase();
    console.log("[io] lobby:create =>", lobbyId);

    socket.emit("lobby:created", { lobbyId });

    // (Optional) if later store lobbies, you'd io.emit("lobbies:update", ...)
    // will be needed to add replays like the main site does but for rn who gaf abt replays
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
