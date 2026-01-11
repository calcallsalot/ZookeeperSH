"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io, type Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { Lobby, OnlinePlayer } from "./types";


// not technically needed but here
// export type Lobby = { id: string; code: string }; 
//export type OnlinePlayer = { id: string; name: string; elo?: number }; 

type InitPayload = {
  lobbies?: Lobby[];
  onlinePlayers?: OnlinePlayer[];
};

/*export type LobbySocketValue = { 
  connected: boolean;
  loading: boolean;
  lobbies: Lobby[];
  onlinePlayers: OnlinePlayer[];
  loadingOnlinePlayers: boolean;
  createLobby: () => void;
  // no chat supported here
};*/ 

// im not sure if I can just use the same chat for the game and the lobby but this is mainly for lobby 

export type ChatMessage = {
  id: string;
  name: string;
  text: string;
  ts: number;
};

export type LobbySocketValue = {
  connected: boolean;
  loading: boolean;
  lobbies: Lobby[];
  onlinePlayers: OnlinePlayer[];
  loadingOnlinePlayers: boolean;

  // chat
  chatMessages: ChatMessage[];
  canChat: boolean;
  myName: string;


  // lobby shit

  myLobbyId: string | null;

  createLobby: () => void;

  joinLobby: (lobbyId: string) => void;

  sendChat: (text: string) => void;
};

const LobbySocketCtx = createContext<LobbySocketValue | null>(null);

export function LobbySocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const socketRef = useRef<Socket | null>(null);
  const [loadingOnlinePlayers, setLoadingOnlinePlayers] = useState(true);

  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  // lobby stuff
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [myLobbyId, setMyLobbyId] = useState<string | null>(null);


  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);

  // all chat lobby variables
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const myName = session?.user?.name ?? session?.user?.email ?? "Guest";
  const canChat = status === "authenticated";

  useEffect(() => {
    if (!myLobbyId) return;
    router.push(`/games/table/${myLobbyId}`);
  }, [myLobbyId, router]);

  const sendChat = useCallback((text: string) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    socket.emit("chat:send", { text });
  }, []);


  // 1) Create socket ONCE
  useEffect(() => {
    const socket: Socket = io("http://127.0.0.1:3001", {
      transports: ["websocket", "polling"],
      path: "/socket.io",
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      console.log("[socket] connected", socket.id);

      // Ask server for initial state (must exist server-side)
      socket.emit("init:get");
    });

    socket.on("disconnect", (reason) => {
      setConnected(false);
      console.log("[socket] disconnected", reason);
    });

    socket.on("connect_error", (err) => {
      console.error("[socket] connect_error", err);
      setConnected(false);
      setLoading(false); // don't hang forever
      setLoadingOnlinePlayers(false);
    });

    // Debug: see what events actually arrive
    socket.onAny((event, ...args) => {
      console.log("[socket] event:", event, args);
    });

    // Init payload handler (match event name to your server)
    socket.on("init", (p: InitPayload) => {
      setLobbies(p.lobbies ?? []);
      setOnlinePlayers(p.onlinePlayers ?? []);
      setLoading(false);
      setLoadingOnlinePlayers(false);
    });


    // more lobby stuff
    socket.on("me:lobby", ({ lobbyId } = {}) => {
      setMyLobbyId(lobbyId ?? null);
    });

    socket.on("lobbies:update", (list: Lobby[]) => setLobbies(list));

    socket.on("lobby:created", (payload: { lobbyId: string }) => {
      console.log("[socket] lobby:created received:", payload);

      // Re-fetch latest lobby list from server
      socket.emit("init:get");
    });

    socket.on("onlinePlayers:update", (list: OnlinePlayer[]) => {
      console.log("[socket] onlinePlayers:update received:", list);
      setOnlinePlayers(list);
      setLoadingOnlinePlayers(false);
    });

    // all chat lobby messagers handler
    socket.on("chat:history", (msgs: ChatMessage[]) => setChatMessages(msgs ?? []));
    socket.on("chat:message", (msg: ChatMessage) =>
      setChatMessages((prev) => [...prev, msg])
    );


    return () => {
      socket.off();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // 2) Whenever we are connected AND we have a username (or Guest), identify to server
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    const name = session?.user?.name ?? session?.user?.email ?? "Guest";
    const authed = status === "authenticated";

    socket.emit("presence:set", { name, authed});
    console.log("[presence:set] sent", { name, authed });
  }, [connected, session, status]);

  // 3) createLobby action exposed to components
  const createLobby = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      console.warn("[createLobby] socket not connected");
      return;
    }
    socket.emit("lobby:create");
  }, []);

  
  const joinLobby = useCallback((lobbyId: string) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      console.warn("[joinLobby] socket not connected");
      return;
    }
    socket.emit("lobby:join", { lobbyId });
  }, []);


  /*const value = useMemo<LobbySocketValue>(
    () => ({
      connected,
      loading,
      lobbies,
      onlinePlayers,
      loadingOnlinePlayers,
      createLobby,
    }),
    [connected, loading, lobbies, onlinePlayers, loadingOnlinePlayers,createLobby]
    // old no chat features
  );*/
  const value = useMemo<LobbySocketValue>(
    () => ({
      connected,
      loading,
      lobbies,
      onlinePlayers,
      loadingOnlinePlayers,

      chatMessages,
      canChat,
      myName,
      
      // lobby stuff again

      myLobbyId,

      sendChat,
      joinLobby,
      createLobby,
    }),
    [
      connected,
      loading,
      lobbies,
      onlinePlayers,
      loadingOnlinePlayers,
      chatMessages,
      canChat,
      myName,

      // lobby stuff again
      myLobbyId,


      sendChat,
      joinLobby,
      createLobby,
    ]
  );

  return (
    <LobbySocketCtx.Provider value={value}>
      {children}
    </LobbySocketCtx.Provider>
  );
}

export function useLobby() {
  const v = useContext(LobbySocketCtx);
  if (!v) throw new Error("useLobby must be used within <LobbySocketProvider>");
  return v;
}
