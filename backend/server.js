const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const messageRoutes = require("./routes/messageRoutes");
const chatRoutes = require("./routes/chatRoutes");
const authRoutes = require("./routes/authRoutes");
const connectDB = require("./config/db");
const express = require("express");
const dotenv = require("dotenv");
const userRoutes = require("./routes/userRoutes");

const onlineUsers = new Map();

dotenv.config();
connectDB();

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

app.get("/", (req, res) => {
  res.send("API is running...");
});

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
  pingTimeout: 60000,
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // 🔌 SETUP
  socket.on("setup", (userData) => {
    socket.join(userData._id);

    onlineUsers.set(userData._id, socket.id);

    // send current online users to this client
    socket.emit("online users", Array.from(onlineUsers.keys()));

    // notify others
    socket.broadcast.emit("user online", userData._id);

    socket.emit("connected");
  });

  // 💬 JOIN CHAT
  socket.on("join chat", (chatId) => {
    socket.join(chatId);
  });

  // 📩 NEW MESSAGE
  socket.on("new message", (newMessageReceived) => {
    const chat = newMessageReceived.chat;
    if (!chat.users) return;

    socket.to(chat._id).emit("message received", newMessageReceived);
  });

  // ✍️ TYPING
  socket.on("typing", ({ chatId, userName }) => {
    socket.to(chatId).emit("typing", { chatId, userName });
  });

  socket.on("stop typing", ({ chatId }) => {
    socket.to(chatId).emit("stop typing", { chatId });
  });

  // 🚪 LOGOUT (IMPORTANT)
  socket.on("logout", (userId) => {
    if (onlineUsers.has(userId)) {
      onlineUsers.delete(userId);
      socket.broadcast.emit("user offline", userId);
    }
    socket.leave(userId);
  });

  // ❌ DISCONNECT
  socket.on("disconnect", () => {
    for (let [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        socket.broadcast.emit("user offline", userId);
        break;
      }
    }
    console.log("Client disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
