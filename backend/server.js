const cors = require("cors");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const User = require("./models/user");
const Chat = require("./models/chat");
const Message = require("./models/message");
const messageRoutes = require("./routes/messageRoutes");
const chatRoutes = require("./routes/chatRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

dotenv.config();
connectDB();

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://real-time-chat-application-gilt-nine.vercel.app",
];
const onlineUsers = new Map(); // user id -> Set of socket ids
const app = express();

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);
app.get("/", (req, res) => res.send("API is running..."));
app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
const io = new Server(server, {
  pingTimeout: 60000,
  cors: { origin: allowedOrigins, credentials: true },
});
app.set("io", io);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("_id name");
    if (!user) return next(new Error("Authentication required"));
    socket.user = user;
    next();
  } catch {
    next(new Error("Authentication required"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.user._id.toString();
  socket.join(userId);
  const sockets = onlineUsers.get(userId) || new Set();
  const wasOffline = sockets.size === 0;
  sockets.add(socket.id);
  onlineUsers.set(userId, sockets);
  socket.emit("online users", Array.from(onlineUsers.keys()));
  if (wasOffline) socket.broadcast.emit("user online", userId);

  socket.on("join chat", async (chatId) => {
    const chat = await Chat.exists({ _id: chatId, users: socket.user._id });
    if (chat) socket.join(chatId);
  });

  socket.on("new message", async (messageId) => {
    try {
      const message = await Message.findById(messageId)
        .populate("sender", "name email")
        .populate({ path: "chat", populate: { path: "users", select: "name email" } });

      if (!message || message.sender._id.toString() !== userId) return;

      message.chat.users.forEach((member) => {
        const memberId = member._id.toString();
        if (memberId !== userId) io.to(memberId).emit("message received", message);
      });

      if (!message.chat.isGroupChat) {
        message.chat.users.forEach(async (member) => {
          const memberId = member._id.toString();
          if (memberId !== userId && onlineUsers.has(memberId)) {
            await Message.findByIdAndUpdate(messageId, { $addToSet: { deliveredTo: memberId } });
            io.to(userId).emit("message delivered", {
              chatId: message.chat._id.toString(),
              messageId,
              userId: memberId,
            });
          }
        });
      }
    } catch (error) {
      console.error("Could not broadcast message:", error.message);
    }
  });

  socket.on("typing", async ({ chatId }) => {
    const chat = await Chat.exists({ _id: chatId, users: socket.user._id });
    if (chat) socket.to(chatId).emit("typing", { chatId, userName: socket.user.name });
  });

  socket.on("stop typing", async ({ chatId }) => {
    const chat = await Chat.exists({ _id: chatId, users: socket.user._id });
    if (chat) socket.to(chatId).emit("stop typing", { chatId });
  });

  socket.on("disconnect", () => {
    const userSockets = onlineUsers.get(userId);
    userSockets?.delete(socket.id);
    if (!userSockets?.size) {
      onlineUsers.delete(userId);
      socket.broadcast.emit("user offline", userId);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
