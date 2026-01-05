"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;
let refCount = 0;

function socketUrl() {
  // Set NEXT_PUBLIC_SOCKET_URL in production/dev if socket server is separate.
  // If "", socket.io-client uses same-origin.
  return process.env.NEXT_PUBLIC_SOCKET_URL ?? "";
}

export function getSharedSocket(userName?: string) {
  if (!socket) {
    socket = io(socketUrl(), {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: false,
    });
  }

  // Update auth before (re)connect
  socket.auth = { userName };

  if (!socket.connected) socket.connect();
  return socket;
}

export function retainSharedSocket(userName?: string) {
  refCount += 1;
  return getSharedSocket(userName);
}

export function releaseSharedSocket() {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && socket) {
    socket.disconnect();
  }
}
