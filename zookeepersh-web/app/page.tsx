"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type UserInfo = {
  userName?: string | null;
};

type ModalKind = null | "login" | "signup";

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 94vw)",
          borderRadius: 16,
          background: "#111",
          color: "white",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
          padding: 18,
          fontFamily: "var(--font-comfortaa)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 18 }}>{title}</div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              border: "none",
              background: "transparent",
              color: "white",
              cursor: "pointer",
              fontSize: 22,
              lineHeight: 1,
              padding: 6,
              borderRadius: 10,
            }}
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function AuthButtons({
  userInfo,
  onOpenLogin,
  onOpenSignup,
}: {
  userInfo: UserInfo;
  onOpenLogin: () => void;
  onOpenSignup: () => void;
}) {
  const btnStyle: React.CSSProperties = {
    display: "inline-block",
    padding: "10px 14px",
    background: "#231a18",
    color: "white",
    textDecoration: "none",
    fontFamily: "var(--font-comfortaa)",
    fontWeight: 600,
    lineHeight: 1,
    border: "none",
    cursor: "pointer",
  };

  return !userInfo.userName ? (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {/* LEFT: Log in */}
      <button
        type="button"
        id="signin"
        onClick={onOpenLogin}
        style={{
          ...btnStyle,
          borderTopLeftRadius: 999,
          borderBottomLeftRadius: 999,
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
          paddingRight: 18,
        }}
      >
        Log in
      </button>

      {/* RIGHT: Sign up */}
      <button
        type="button"
        id="signup"
        onClick={onOpenSignup}
        style={{
          ...btnStyle,
          borderTopRightRadius: 999,
          borderBottomRightRadius: 999,
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0,
          paddingLeft: 18,
        }}
      >
        Sign up
      </button>

      {/* OR circle separator */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "47%",
          transform: "translateX(-50%)",
          width: 30,
          height: 30,
          borderRadius: 999,
          background: "white",
          color: "black",
          display: "grid",
          placeItems: "center",
          fontFamily: "var(--font-comfortaa)",
          fontSize: 12,
          fontWeight: 900,
          border: "2px solid #231a18",
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        OR
      </div>
    </div>
  ) : (
    <Link
      href="/account"
      style={{
        display: "inline-block",
        padding: "10px 14px",
        borderRadius: 12,
        background: "#231a18",
        color: "white",
        textDecoration: "none",
        fontFamily: "var(--font-comfortaa)",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {userInfo.userName}&apos;s account
    </Link>
  );
}

export default function Home() {
  const userInfo: UserInfo = { userName: null };
  const [modal, setModal] = useState<ModalKind>(null);

  const links = [
    // { label: "Game Lobby", href: "/games" },
    { label: "Home", href: "/" },
    { label: "Rules", href: "/rules" },
    { label: "How to Play", href: "/how-to-play" },
    { label: "Roles", href: "/roles" },
    { label: "Discord", href: "https://discord.com" },
    { label: "Wiki", href: "/wiki" },
    { label: "Github", href: "https://github.com" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "black" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "lightgray",
          borderBottom: "1px solid rgba(0,0,0,0.12)",
        }}
      >
        <nav
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <Link
            href="/"
            style={{
              fontFamily: "var(--font-eskapade-fraktur)",
              fontSize: 28,
              color: "black",
              textDecoration: "none",
              marginRight: 12,
              whiteSpace: "nowrap",
            }}
          >
            ZooKeeperSH
          </Link>

          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              alignItems: "center",
              fontFamily: "var(--font-comfortaa)",
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            <Link
              href="/games"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "15px 20px",
                borderRadius: 12,
                backgroundColor: "black",
                color: "white",
                textDecoration: "none",
                fontFamily: "var(--font-comfortaa)",
                fontSize: 14,
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              Game Lobby
            </Link>

            {links.map((l) => {
              const isExternal = l.href.startsWith("http");
              const isGameLobby = l.href === "/games";
              const gameBtnStyle: React.CSSProperties = {
                display: "inline-block",
                padding: "10px 14px",
                borderRadius: 999,
                background: "black",
                color: "white",
                textDecoration: "none",
                fontFamily: "var(--font-comfortaa)",
                fontSize: 14,
                fontWeight: 800,
                lineHeight: 1,
                border: "2px solid rgba(0,0,0,0.35)", 
              };
              const commonStyle: React.CSSProperties = { // normal nav
                color: "black",
                textDecoration: "none",
                padding: "8px 10px",
                borderRadius: 10,
              };

              const style = isGameLobby ? gameBtnStyle : commonStyle;

              return isExternal ? (
                <a
                  key={l.label}
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  style={commonStyle}
                >
                  {l.label}
                </a>
              ) : (
                <Link key={l.label} href={l.href} style={commonStyle}>
                  {l.label}
                </Link>
              );
            })}
          </div>

          <div style={{ marginLeft: "auto" }}>
            <AuthButtons
              userInfo={userInfo}
              onOpenLogin={() => setModal("login")}
              onOpenSignup={() => setModal("signup")}
            />
          </div>
        </nav>
      </header>

      <main
        style={{
          minHeight: "calc(100vh - 60px)",
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-eskapade-fraktur)",
            color: "white",
            margin: 0,
            fontSize: "clamp(56px, 10vw, 120px)",
            letterSpacing: "0.02em",
          }}
        >
          ZooKeeperSH
        </h1>
      </main>

      {/* Login Modal */}
      <Modal
        open={modal === "login"}
        title="Log in"
        onClose={() => setModal(null)}
      >


        <div style={{ display: "grid", gap: 10 }}>
          <input
            placeholder="Username / Email"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#0b0b0b",
              color: "white",
              outline: "none",
            }}
          />
          <input
            placeholder="Password"
            type="password"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#0b0b0b",
              color: "white",
              outline: "none",
            }}
          />
          <button
            onClick={() => setModal(null)}
            style={{
              padding: "10px 12px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: "#231a18",
              color: "white",
              fontWeight: 800,
            }}
          >
            Log In
          </button>
        </div>
      </Modal>

      {/* Signup Modal */}
      <Modal
        open={modal === "signup"}
        title="Sign up"
        onClose={() => setModal(null)}
      >

        <div style={{ display: "grid", gap: 10 }}>
          <input
            placeholder="Email"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#0b0b0b",
              color: "white",
              outline: "none",
            }}
          />
          <input
            placeholder="Username"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#0b0b0b",
              color: "white",
              outline: "none",
            }}
          />
          <input
            placeholder="Password"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#0b0b0b",
              color: "white",
              outline: "none",
            }}
          />
          <input
            placeholder="Confirm Password"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#0b0b0b",
              color: "white",
              outline: "none",
            }}
          />
          <button
            onClick={() => setModal(null)}
            style={{
              padding: "10px 12px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: "#231a18",
              color: "white",
              fontWeight: 800,
            }}
          >
            Create account
          </button>
        </div>
      </Modal>
    </div>
  );
}
