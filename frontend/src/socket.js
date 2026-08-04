import { io } from "socket.io-client";

const getEndpoint = () => {
  let url = import.meta.env.VITE_API_URL || "";
  url = url.trim().replace(/\/$/, "");
  return url || undefined;
};

export const socket = io(getEndpoint(), {
  autoConnect: false,
  withCredentials: true,
  transports: ["polling", "websocket"],
});

export const connectSocket = (token) => {
  socket.auth = { token };
  if (!socket.connected) socket.connect();
};
