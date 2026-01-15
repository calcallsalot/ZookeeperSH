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
// well i figured it out you need a different one XD so that's what GameChatMessage is for 

export type GameChatMessage = {
  id?: string;
  lobbyId: string;
  kind: "user" | "system";
  text: string;
  userName?: string | null;
  seat?: number | null;
  elo?: number | null;
  observer?: | boolean;
  ts: number;
};

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

  // game chat
  gameChatMessages: GameChatMessage[];
  joinGameChat: (lobbyId: string) => void;
  sendGameChat: (
    lobbyId: string,
    text: string,
    seat?: number | null,
    elo?: number | null
  ) => void;


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
  // game chat variables
  const [gameChatMessages, setGameChatMessages] = useState<GameChatMessage[]>([]);

  const guestId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const storageKey = "zk_guest_id";
    const existing = window.localStorage.getItem(storageKey);
    if (existing) return existing;
    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(storageKey, generated);
    return generated;
  }, []);


  useEffect(() => {
    if (!myLobbyId) return;
    router.push(`/games/table/${myLobbyId}`);
  }, [myLobbyId, router]);

  const sendChat = useCallback((text: string) => { // for lobby chat
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    socket.emit("chat:send", { text });
  }, []);

  const joinGameChat = useCallback((lobbyId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit("game_chat:join", { lobbyId });
  }, []);

  const sendGameChat = useCallback(
    (lobbyId: string, text: string) => { // seat?: number | null, elo?: number | null
      if (!socketRef.current) return;
      socketRef.current.emit("game_chat:send", {
        lobbyId,
        text,
      });
      {/* seat: seat ?? null,
        elo: elo ?? null,
        userName: myName ?? null, // reuses same myName i'm pretty sure it's fine*/}
    },
    [myName]
  );

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


    // game chat lobby messengers handler
    socket.on("game_chat:history", ({ lobbyId, messages }: { lobbyId: string; messages: GameChatMessage[] }) => {
      // per-lobby isolation, stored by lobbyId
      setGameChatMessages(messages);
    });

    socket.on("game_chat:new", (msg: GameChatMessage) => {
      setGameChatMessages((prev) => [...prev, msg]);
    });



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
    const sessionUser = session?.user as { elo?: number } | undefined;
    const elo = authed // very confusing you're gonna have to edit this later
      ? typeof sessionUser?.elo === "number"
        ? sessionUser.elo
        : 1600
      : null;

    socket.emit("presence:set", {
       name, 
       authed,
       elo,
       guestId: authed ? undefined : guestId ?? undefined,
    });
    console.log("[presence:set] sent", { name, authed, elo });
  }, [connected, session, status, guestId]);

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
      // lobby chat
      chatMessages,
      canChat,
      myName,

      // game chat 
      gameChatMessages,
      joinGameChat,
      sendGameChat,
      
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

      // lobby chat
      chatMessages,
      canChat,
      myName,

      // game chat 
      gameChatMessages,
      joinGameChat,
      sendGameChat,

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
