"use client";

import { signIn, signOut, useSession } from "next-auth/react";
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!open) {
      setMounted(false);
      return;
    }

    setMounted(false);
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => setMounted(true));
      (window as any).__raf2 = raf2;
    });

    return () => {
      cancelAnimationFrame(raf1);
      const raf2 = (window as any).__raf2;
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [open]);

  // ESC closes
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
      onMouseDown={(e) => {
        // only close when the backdrop itself is clicked
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        perspective: "1200px",
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

          transform: mounted
            ? "translateY(0) rotateY(0deg) scale(1)"
            : "translateY(10px) rotateY(85deg) scale(0.96)",
          opacity: mounted ? 1 : 0,
          transition:
            "transform 1000ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity 220ms ease",
          transformOrigin: "50% 50%",
          backfaceVisibility: "hidden",
          willChange: "transform, opacity",
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
        flex: "0 0 auto",
      }}
    >
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
      href="/profile"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "10px 14px",
        borderRadius: 12,
        background: "#231a18",
        color: "white",
        textDecoration: "none",
        fontFamily: "var(--font-comfortaa)",
        fontWeight: 700,
        whiteSpace: "nowrap",
        maxWidth: 180,
        overflow: "hidden",
        textOverflow: "ellipsis",
        flex: "0 0 auto",
      }}
    >
      {userInfo.userName}&apos;s account
    </Link>
  );
}

export default function Home() {
  const { data: session } = useSession();

  const userInfo: UserInfo = {
    userName: session?.user?.name ?? session?.user?.email ?? null,
  };

  const [modal, setModal] = useState<ModalKind>(null);

  // login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // signup state
  const [signupEmail, setSignupEmail] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");

  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  async function handleLogin() {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await signIn("credentials", {
        email: loginEmail,
        password: loginPassword,
        redirect: false,
      });

      if (!res || res.error) {
        setAuthError("Invalid email or password.");
        return;
      }

      setModal(null);
      setLoginPassword("");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignup() {
    setAuthError(null);

    if (signupPassword.length < 8) {
      setAuthError("Password must be at least 8 characters.");
      return;
    }
    if (signupPassword !== signupConfirm) {
      setAuthError("Passwords do not match.");
      return;
    }

    setAuthLoading(true);
    try {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: signupEmail,
          password: signupPassword,
          name: signupUsername,
        }),
      });

      const data = await r.json();
      if (!r.ok) {
        setAuthError(data?.error ?? "Could not create account.");
        return;
      }

      const res = await signIn("credentials", {
        email: signupEmail,
        password: signupPassword,
        redirect: false,
      });

      if (!res || res.error) {
        setAuthError("Account created, but login failed. Try logging in.");
        return;
      }

      setModal(null);
      setSignupPassword("");
      setSignupConfirm("");
    } finally {
      setAuthLoading(false);
    }
  }

  const gameLobbyNavBtn: React.CSSProperties = {
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
    border: "none",
    cursor: "pointer",
    flex: "0 0 auto",
    whiteSpace: "nowrap",
  };
  const primaryNavBtn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "15px 20px",
    borderRadius: 12,
    backgroundColor: "#231a18",
    color: "white",
    textDecoration: "none",
    fontFamily: "var(--font-comfortaa)",
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1,
    border: "none",
    cursor: "pointer",
    flex: "0 0 auto",
    whiteSpace: "nowrap",
  };
  const links = [
    { label: "Home", href: "/" },
    { label: "Rules", href: "/rules" },
    { label: "How to Play", href: "/how-to-play" },
    { label: "Roles", href: "/roles" },
    { label: "Discord", href: "" },
    { label: "Wiki", href: "/wiki" },
    { label: "Github", href: "https://github.com/calcallsalot/ZookeeperSH" },
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
        {/* NAVBAR: grid layout that never wraps */}
        <nav
          style={{
            maxWidth: 2000,
            margin: "0 auto",
            padding: "10px 16px",
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            alignItems: "center",
            columnGap: 16,
          }}
        >
          {/* LEFT: logo */}
          <div
            style={{
              fontFamily: "var(--font-eskapade-fraktur)",
              fontSize: 28,
              color: "black",
              whiteSpace: "nowrap",
            }}
          >
            ZooKeeperSH
          </div>

          {/* MIDDLE: links */}
          <div style={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                minWidth: 0,
                flexWrap: "nowrap",
                overflowX: "auto",
                overflowY: "hidden",
                whiteSpace: "nowrap",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <Link href="/games" style={gameLobbyNavBtn}>
                Game Lobby
              </Link>

              {links.map((l) => {
                const isExternal = l.href.startsWith("http");
                const commonStyle: React.CSSProperties = {
                  display: "inline-flex",
                  alignItems: "center",
                  fontFamily: "var(--font-comfortaa)",
                  fontSize: 14,
                  fontWeight: 800,
                  color: "black",
                  textDecoration: "none",
                  padding: "8px 10px",
                  borderRadius: 10,
                  whiteSpace: "nowrap",
                  flex: "0 0 auto",
                };

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
          </div>


          {/* RIGHT: auth (pinned right; never wraps) */}
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              justifySelf: "end",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            <AuthButtons
              userInfo={userInfo}
              onOpenLogin={() => {
                setAuthError(null);
                setModal("login");
              }}
              onOpenSignup={() => {
                setAuthError(null);
                setModal("signup");
              }}
            />

            {session && (
              <button onClick={() => signOut()} style={primaryNavBtn}>
                Log Out
              </button>
            )}
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
            placeholder="Email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
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
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#0b0b0b",
              color: "white",
              outline: "none",
            }}
          />

          {authError && (
            <div style={{ color: "#ffb4b4", fontSize: 13 }}>{authError}</div>
          )}

          <button
            onClick={handleLogin}
            disabled={authLoading}
            style={{
              padding: "10px 12px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: "#231a18",
              color: "white",
              fontWeight: 800,
              opacity: authLoading ? 0.7 : 1,
            }}
          >
            {authLoading ? "Logging in..." : "Log In"}
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
            value={signupEmail}
            onChange={(e) => setSignupEmail(e.target.value)}
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
            value={signupUsername}
            onChange={(e) => setSignupUsername(e.target.value)}
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
            value={signupPassword}
            onChange={(e) => setSignupPassword(e.target.value)}
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
            type="password"
            value={signupConfirm}
            onChange={(e) => setSignupConfirm(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#0b0b0b",
              color: "white",
              outline: "none",
            }}
          />

          {authError && (
            <div style={{ color: "#ffb4b4", fontSize: 13 }}>{authError}</div>
          )}

          <button
            onClick={handleSignup}
            disabled={authLoading}
            style={{
              padding: "10px 12px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: "#231a18",
              color: "white",
              fontWeight: 800,
              opacity: authLoading ? 0.7 : 1,
            }}
          >
            {authLoading ? "Creating..." : "Create account"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
