import { io } from "socket.io-client";

const ENDPOINT = import.meta.env.VITE_API_URL;

export const socket = io(ENDPOINT, {
  autoConnect: false,
  withCredentials: true,
  transports: ["websocket"],
});

export const connectSocket = (token) => {
  socket.auth = { token };
  if (!socket.connected) socket.connect();
};
