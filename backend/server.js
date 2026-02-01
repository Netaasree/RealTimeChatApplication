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

/* API CORS */
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

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

app.get("/", (req, res) => {
  res.send("API is running...");
});

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

/* SOCKET.IO */
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

  socket.on("setup", (userData) => {
    socket.join(userData._id);
    onlineUsers.set(userData._id, socket.id);

    socket.emit("online users", Array.from(onlineUsers.keys()));
    socket.broadcast.emit("user online", userData._id);
  });

  socket.on("join chat", (chatId) => {
    socket.join(chatId);
  });

  socket.on("new message", (newMessage) => {
    const chat = newMessage.chat;
    if (!chat.users) return;

    chat.users.forEach((user) => {
      if (user._id.toString() === newMessage.sender._id.toString())
        return;

      socket.to(user._id).emit("message received", newMessage);
    });
  });

  socket.on("typing", ({ chatId, userName }) => {
    socket.to(chatId).emit("typing", { chatId, userName });
  });

  socket.on("stop typing", ({ chatId }) => {
    socket.to(chatId).emit("stop typing", { chatId });
  });

  socket.on("logout", (userId) => {
    onlineUsers.delete(userId);
    socket.broadcast.emit("user offline", userId);
  });

  socket.on("disconnect", () => {
    for (let [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        socket.broadcast.emit("user offline", userId);
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
