import { io } from "socket.io-client";

const ENDPOINT = import.meta.env.VITE_API_URL;

export const socket = io(ENDPOINT, {
  autoConnect: false,
  withCredentials: true,
  transports: ["websocket"],
});
