"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLobby } from "../components/lobby/LobbySocketContext";

export default function SectionChatBar() {
  const { connected, chatMessages, sendChat, canChat, myName } = useLobby();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  const sorted = useMemo(() => {
    // already in order, but keep stable in case
    return [...chatMessages].sort((a, b) => a.ts - b.ts);
  }, [chatMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sorted.length]);

  const disabled = !connected || !canChat;

  const onSend = () => {
    const msg = text.trim();
    if (!msg) return;
    sendChat(msg);
    setText("");
  };

  return (
    <section
      style={{
        borderRadius: 16,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
        padding: 14,
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        gap: 10,
        height: 820,
        // height : "100%",
        //minHeight: 0,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        {/*<div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-comfortaa)" }}>
          connected={String(connected)} canChat={String(canChat)} msgs={chatMessages.length} myName={String(myName)}
        </div> 
        // debug stuff */}

        <div
          style={{
            fontFamily: "var(--font-comfortaa)",
            fontSize: 14,
            fontWeight: 900,
            color: "rgba(255,255,255,0.92)",
          }}
        >
          Chat
        </div>
        <div
          style={{
            fontFamily: "var(--font-comfortaa)",
            fontSize: 12,
            fontWeight: 900,
            color: connected ? "rgba(120,255,170,0.95)" : "rgba(255,255,255,0.55)",
          }}
          title={connected ? "Socket connected" : "Socket disconnected"}
        >
          {connected ? "LIVE" : "OFF"}
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          borderRadius: 12,
          background: "rgba(0,0,0,0.22)",
          border: "1px solid rgba(255,255,255,0.06)",
          padding: 10,
          overflowY: "auto",
          maxHeight: "95%",
          minHeight: 0,
        }}
      >
        {sorted.length === 0 ? (
          <div style={{ fontFamily: "var(--font-comfortaa)", fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
            {/* No messages yet. */}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {sorted.map((m) => (
              <div key={m.id} style={{ display: "grid", gap: 2 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <span style={{ fontFamily: "var(--font-comfortaa)", fontWeight: 900, fontSize: 12, color: "rgba(255,255,255,0.92)" }}>
                    {m.name}
                  </span>
                  <span style={{ fontFamily: "var(--font-comfortaa)", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                    {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div style={{ fontFamily: "var(--font-comfortaa)", fontSize: 13, color: "rgba(255,255,255,0.78)", whiteSpace: "pre-wrap" }}>
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!disabled) onSend();
            }
          }}
          disabled={disabled}
          placeholder={
            !connected ? "Connecting..." : !canChat ? "Sign in to chat" : `Message as ${myName}`
          }
          style={{
            width: "100%",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(0,0,0,0.25)",
            padding: "10px 12px",
            outline: "none",
            color: "rgba(255,255,255,0.92)",
            fontFamily: "var(--font-comfortaa)",
            fontSize: 13,
          }}
        />
        <button
          onClick={onSend}
          disabled={disabled || text.trim().length === 0}
          style={{
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: disabled ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.14)",
            color: "rgba(255,255,255,0.92)",
            fontFamily: "var(--font-comfortaa)",
            fontWeight: 900,
            padding: "10px 12px",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          Send
        </button>
      </div>
    </section>
  );
}
