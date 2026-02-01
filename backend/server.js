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

/* =======================
   API CORS
======================= */
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://real-time-chat-application-gilt-nine.vercel.app",
    ],
    credentials: true,
  })
);

app.use(express.json());

/* =======================
   ROUTES
======================= */
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

app.get("/", (req, res) => {
  res.send("API is running...");
});

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

/* =======================
   SOCKET.IO
======================= */
const io = new Server(server, {
  pingTimeout: 60000,
  cors: {
    origin: [
      "http://localhost:5173",
      "https://real-time-chat-application-gilt-nine.vercel.app",
    ],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  /* 🔌 SETUP */
  socket.on("setup", (userData) => {
    socket.join(userData._id);
    onlineUsers.set(userData._id, socket.id);

    socket.emit("online users", Array.from(onlineUsers.keys()));
    socket.broadcast.emit("user online", userData._id);
  });

  /* 💬 JOIN CHAT */
  socket.on("join chat", (chatId) => {
    socket.join(chatId);
  });

  /* 📩 NEW MESSAGE (FIXED & SAFE) */
  socket.on("new message", (newMessage) => {
    const chat = newMessage.chat;
    if (!chat || !chat.users) return;

    chat.users.forEach((u) => {
      // handle both populated objects & ObjectIds
      const userId =
        typeof u === "object" && u._id
          ? u._id.toString()
          : u.toString();

      if (userId === newMessage.sender._id.toString()) return;

      socket.to(userId).emit("message received", newMessage);
    });
  });

  /* ✍️ TYPING */
  socket.on("typing", ({ chatId, userName }) => {
    socket.to(chatId).emit("typing", { chatId, userName });
  });

  socket.on("stop typing", ({ chatId }) => {
    socket.to(chatId).emit("stop typing", { chatId });
  });

  /* 🚪 LOGOUT */
  socket.on("logout", (userId) => {
    onlineUsers.delete(userId);
    socket.broadcast.emit("user offline", userId);
  });

  /* ❌ DISCONNECT */
  socket.on("disconnect", () => {
    for (let [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        socket.broadcast.emit("user offline", userId);
        break;
      }
    }
    console.log("Socket disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
