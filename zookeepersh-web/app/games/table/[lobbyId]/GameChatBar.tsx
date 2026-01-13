"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLobby } from "../../../frontend-scripts/components/lobby/LobbySocketContext";

function nameColorFromElo(elo?: number | null) {
  if (elo == null) return "rgba(255,255,255,0.9)";
  if (elo >= 1500 && elo <= 1600) return "#2ecc71";
  if (elo >= 1601 && elo <= 1700) return "#f1c40f";
  return "rgba(255,255,255,0.9)";
}

export default function GameChatBar({
  lobbyId,
  mySeat,
  myElo,
}: {
  lobbyId: string;
  mySeat?: number | null;
  myElo?: number | null;
}) {
  const { connected, canChat, gameChatMessages, joinGameChat, sendGameChat } =
    useLobby() as any;

  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    joinGameChat?.(lobbyId);
  }, [joinGameChat, lobbyId]);

  const sorted = useMemo(() => {
    return [...(gameChatMessages ?? [])]
      .filter((m) => m?.lobbyId === lobbyId) // safety
      .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
  }, [gameChatMessages, lobbyId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sorted.length]);

  const disabled = !connected || !canChat;

  const onSend = () => {
    const msg = text.trim();
    if (!msg) return;
    sendGameChat?.(lobbyId, msg, mySeat ?? null, myElo ?? null);
    setText("");
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <section
      style={{
        height: "58%",          // IMPORTANT: fill the right panel area
        minHeight: 0,            // IMPORTANT: allow scrolling children
        display: "flex",
        flexDirection: "column",
        background: "transparent",
        borderLeft: "1px solid rgba(255,255,255,0.08)", // like the screenshot divider
      }}
    >
      {/* Messages */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "8px 10px",
          fontSize: 14,
          lineHeight: 1.25,
        }}
      >
        {sorted.map((m, idx) => {
          const key = m.id ?? `${m.ts}-${idx}`;

          if (m.kind === "system") {
            return (
              <div
                key={key}
                style={{
                  color: "rgba(255,255,255,0.55)",
                  padding: "2px 0",
                }}
              >
                {m.text}
              </div>
            );
          }

          const seatStr = m.seat == null ? "" : ` {${m.seat}}`;

          return (
            <div key={key} style={{ padding: "2px 0" }}>
              <span style={{ color: nameColorFromElo(m.elo), fontWeight: 800 }}>
                {m.userName ?? "anon"}
                {seatStr}
              </span>
              <span style={{ color: "rgba(255,255,255,0.85)" }}>:</span>
              <span style={{ color: "white" }}> {`"${m.text}"`}</span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Bottom input bar (thin, like screenshot) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 10px",
          borderTop: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(0,0,0,0.25)",
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder={disabled ? "Chat disabled" : "Type a message…"}
          style={{
            flex: 1,
            height: 34,
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(0,0,0,0.15)",
            color: "white",
            padding: "0 10px",
            outline: "none",
          }}
        />

        <button
          onClick={onSend}
          disabled={disabled}
          style={{
            height: 34,
            padding: "0 14px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.12)",
            background: disabled ? "rgba(255,255,255,0.10)" : "#2d5bff",
            color: "white",
            fontWeight: 800,
            cursor: disabled ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Chat
        </button>
      </div>
    </section>
  );
}
