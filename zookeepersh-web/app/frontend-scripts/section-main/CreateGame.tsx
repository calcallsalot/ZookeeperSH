/*"use client";

import { useMemo } from "react";
import { useLobby } from "../components/lobby/LobbySocketContext";

export default function CreateGame() {
  const { connected, createLobby } = useLobby();

  //const label = useMemo(() => (connected ? "Create Game" : "Connecting…"), [connected]);
  const label = connected ? "Create Game" : "Create Game (offline)";

  return (
    <button
      type="button"
      onClick={() => createLobby()}
      disabled={!connected}
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.16)",
        background: connected ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.92)",
        cursor: connected ? "pointer" : "not-allowed",
        fontFamily: "var(--font-comfortaa)",
        fontWeight: 800,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
      title={connected ? "Create a new lobby" : "Waiting for socket connection"}
    >
      {label}
    </button>
    
  );
}*/
"use client";

import { useLobby } from "../components/lobby/LobbySocketContext";

export default function CreateGame() {
  const { connected, createLobby } = useLobby();

  const label = connected ? "Create Game" : "Create Game (offline)";

  return (
    <button
      type="button"
      onClick={() =>  {
        if (!connected) {
          console.log("[CreateGame] clicked when offline");
          return;
        }
        createLobby();
      }}
      //disabled={!connected}
      style={{
        padding: "20px 14px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.16)",
        background: connected ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.92)",
        cursor: "pointer", // for prod: connected ? "pointer" : "not-allowed",
        fontFamily: "var(--font-comfortaa)",
        fontWeight: 800,
        fontSize: 13,
        whiteSpace: "nowrap",
        opacity: connected ? 1 : 0.8,
      }}
      title={connected ? "Create a new lobby" : "(Offline) Socket not connected yet"}
    >
      {label}
    </button>
  );
}
