"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { getSharedSocket, retainSharedSocket, releaseSharedSocket } from "../sharedSocket/sharedSocket";
import type { Lobby, OnlinePlayer } from "./types";

type InitPayload = {
  lobbies?: Lobby[];
  onlinePlayers?: OnlinePlayer[];
};

export function useLobbySocket(userName?: string) {
  const socketRef = useRef<Socket | null>(null);

  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);

  // Mount once: retain shared socket and wire listeners
  useEffect(() => {
    const s = retainSharedSocket(userName);
    socketRef.current = s;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onInit = (payload: InitPayload) => {
      if (Array.isArray(payload?.lobbies)) setLobbies(payload.lobbies);
      if (Array.isArray(payload?.onlinePlayers)) setOnlinePlayers(payload.onlinePlayers);
      setLoading(false);
    };

    const onPlayersUpdate = (players: OnlinePlayer[]) => {
      setOnlinePlayers(Array.isArray(players) ? players : []);
      setLoading(false);
    };

    const onLobbiesUpdate = (next: Lobby[]) => {
      setLobbies(Array.isArray(next) ? next : []);
      setLoading(false);
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("state:init", onInit);
    s.on("players:update", onPlayersUpdate);
    s.on("lobbies:update", onLobbiesUpdate);

    // Ask for a snapshot in case server doesn't push automatically
    s.emit("state:request");

    setConnected(s.connected);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("state:init", onInit);
      s.off("players:update", onPlayersUpdate);
      s.off("lobbies:update", onLobbiesUpdate);

      socketRef.current = null;
      releaseSharedSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If username changes after login loads, update auth + identify
  useEffect(() => {
    const s = getSharedSocket(userName);
    // If server supports it, identify yourself without reconnect
    if (s.connected) {
      s.emit("presence:identify", { userName });
      s.emit("state:request");
    }
  }, [userName]);

  const actions = useMemo(() => {
    return {
      requestState() {
        socketRef.current?.emit("state:request");
      },
      createLobby(name?: string) {
        socketRef.current?.emit("lobby:create", { name });
      },
      joinLobby(lobbyId: string) {
        socketRef.current?.emit("lobby:join", { lobbyId });
      },
      leaveLobby(lobbyId: string) {
        socketRef.current?.emit("lobby:leave", { lobbyId });
      },
    };
  }, []);

  return {
    connected,
    loading,
    lobbies,
    onlinePlayers,
    ...actions,
  };
}
