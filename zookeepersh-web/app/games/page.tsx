"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function GameLobby() {
  const router = useRouter();
  const { data: session, status } = useSession();


  const userName =
    session?.user?.name;

  return (
    <div style={{ minHeight: "100vh", background: "#141414" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(8px)",
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-eskapade-fraktur)",
            fontSize: 28,
            color: "black",
            textDecoration: "none",
            whiteSpace: "nowrap",
            lineHeight: 1,
          }}
        >
          ZooKeeperSH
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontFamily: "var(--font-comfortaa)",
              fontWeight: 600,
              fontSize: 14,
              color: "#231a18",
              whiteSpace: "nowrap",
            }}
          >
            {status === "loading" ? "Loading..." : userName}
          </span>

          <button
            className="zk-gearBtn"
            type="button"
            aria-label="Settings"
            title="Settings"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "white",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
            onClick={() => router.push("/settings")}
          >
            <svg
              className="zk-gear"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="2" />
              <g transform="translate(0 -3)">
                <path
                  d="M19.4 15a7.9 7.9 0 0 0 .1-1l2-1.6-2-3.4-2.5 1a7.5 7.5 0 0 0-1.7-1l-.4-2.6H9.1l-.4 2.6a7.5 7.5 0 0 0-1.7 1l-2.5-1-2 3.4 2 1.6a7.9 7.9 0 0 0 .1 1 7.9 7.9 0 0 0-.1 1l-2 1.6 2 3.4 2.5-1c.5.4 1.1.7 1.7 1l.4 2.6h5.8l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.4-2-1.6a7.9 7.9 0 0 0-.1-1Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </g>
            </svg>
          </button>
        </div>
      </header>

      <main style={{ padding: 18 }}>
        <h1 style={{ fontFamily: "var(--font-comfortaa)", fontSize: 18, margin: 0 }}>
          Game Lobby
        </h1>
        <p style={{ fontFamily: "var(--font-comfortaa)", opacity: 0.75 }}>
          (content coming next)
        </p>
      </main>

      <style jsx>{`
        .zk-gear {
          color: #231a18;
          transform-origin: 50% 50%;
        }
        .zk-gearBtn:hover .zk-gear {
          animation: zk-spin 1.2s linear infinite;
        }
        @keyframes zk-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
