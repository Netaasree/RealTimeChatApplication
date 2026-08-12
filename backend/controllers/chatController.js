const Chat = require("../models/chat");
const User = require("../models/user");
const Message = require("../models/message");

const populateGroupChat = async (chat) => {
  await chat.populate("users", "-password");
  await chat.populate("groupAdmin", "-password");
  return chat;
};

const accessChat = async (req, res) => {
  const { userId } = req.body;

if (!userId) {
  return res.status(400).json({ message: "UserId is required" });
}
if (userId === req.user._id.toString()) {
  return res.status(400).json({ message: "You cannot start a chat with yourself" });
}
const recipient = await User.findById(userId);
if (!recipient) {
  return res.status(404).json({ message: "User not found" });
}
let chat = await Chat.findOne({
  isGroupChat: false,
  users: {
    $all: [req.user._id, userId],
  },
}).populate("users", "-password");

if (chat) {
  return res.json(chat);
}

const newChat = await Chat.create({
  chatName: "sender",
  isGroupChat: false,
  users: [req.user._id, userId],
});

const fullChat = await Chat.findById(newChat._id).populate(
  "users",
  "-password"
);

res.status(201).json(fullChat);
};

  const fetchChats = async (req, res) => {
  const chats = await Chat.find({
    users: { $elemMatch: { $eq: req.user._id } },
  })
    .populate("users", "-password")
    .populate("groupAdmin", "-password")
    .populate({ path: "latestMessage", populate: { path: "sender", select: "name" } })
    .sort({ updatedAt: -1 });

  const chatsWithUnreadCount = await Promise.all(chats.map(async (chat) => ({
    ...chat.toObject(),
    unreadCount: await Message.countDocuments({
      chat: chat._id,
      sender: { $ne: req.user._id },
      readBy: { $ne: req.user._id },
    }),
  })));

  res.json(chatsWithUnreadCount);
};

const createGroupChat = async (req, res) => {
  const { name, users } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ message: "Group name is required" });
  }
  if (!Array.isArray(users)) {
    return res.status(400).json({ message: "Add at least two other members" });
  }

  const memberIds = [...new Set([...users.map(String), req.user._id.toString()])];
  if (memberIds.length < 3) {
    return res.status(400).json({ message: "Add at least two other members" });
  }
  const members = await User.find({ _id: { $in: memberIds } });
  if (members.length !== memberIds.length) {
    return res.status(404).json({ message: "One or more users were not found" });
  }

  let chat = await Chat.create({
    chatName: name.trim(),
    isGroupChat: true,
    users: memberIds,
    groupAdmin: req.user._id,
  });
  chat = await populateGroupChat(chat);

  chat.users.forEach((member) => {
    if (member._id.toString() !== req.user._id.toString()) {
      req.app.get("io").to(member._id.toString()).emit("new chat", chat);
    }
  });

  res.status(201).json(chat);
};

const renameGroup = async (req, res) => {
  const { chatId, name } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ message: "Group name is required" });
  }

  let chat = await Chat.findById(chatId);
  if (!chat || !chat.isGroupChat) {
    return res.status(404).json({ message: "Group chat not found" });
  }
  if (chat.groupAdmin.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Only the group admin can rename this group" });
  }

  chat.chatName = name.trim();
  await chat.save();
  chat = await populateGroupChat(chat);
  req.app.get("io").to(chat._id.toString()).emit("group updated", chat);
  res.json(chat);
};

const addToGroup = async (req, res) => {
  const { chatId, userId } = req.body;
  let chat = await Chat.findById(chatId);
  if (!chat || !chat.isGroupChat) {
    return res.status(404).json({ message: "Group chat not found" });
  }
  if (chat.groupAdmin.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Only the group admin can add members" });
  }
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  chat = await Chat.findByIdAndUpdate(chatId, { $addToSet: { users: userId } }, { new: true });
  chat = await populateGroupChat(chat);
  req.app.get("io").to(chat._id.toString()).emit("group updated", chat);
  res.json(chat);
};

const removeFromGroup = async (req, res) => {
  const { chatId, userId } = req.body;
  let chat = await Chat.findById(chatId);
  if (!chat || !chat.isGroupChat) {
    return res.status(404).json({ message: "Group chat not found" });
  }
  if (chat.groupAdmin.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Only the group admin can remove members" });
  }
  if (chat.groupAdmin.toString() === userId) {
    return res.status(400).json({ message: "Reassign admin before removing them" });
  }

  chat = await Chat.findByIdAndUpdate(chatId, { $pull: { users: userId } }, { new: true });
  chat = await populateGroupChat(chat);
  req.app.get("io").to(chat._id.toString()).emit("group updated", chat);
  res.json(chat);
};

const updateGroupAdmin = async (req, res) => {
  const { chatId, newAdminId } = req.body;

  let chat = await Chat.findById(chatId);
  if (!chat || !chat.isGroupChat) {
    return res.status(404).json({ message: "Group chat not found" });
  }
  if (chat.groupAdmin.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Only the group admin can reassign admin rights" });
  }
  if (!chat.users.some((u) => u.toString() === newAdminId)) {
    return res.status(400).json({ message: "New admin must be a member of the group" });
  }
  if (chat.groupAdmin.toString() === newAdminId) {
    return res.status(400).json({ message: "This user is already the group admin" });
  }

  // Look up old admin's name before overwriting
  const oldAdmin = await User.findById(chat.groupAdmin).select("name");
  const newAdmin = await User.findById(newAdminId).select("name");

  chat.groupAdmin = newAdminId;
  await chat.save();
  chat = await populateGroupChat(chat);

  // Create a WhatsApp-style system message
  const systemContent = `${oldAdmin.name} changed admin from ${oldAdmin.name} to ${newAdmin.name}`;
  let systemMsg = await Message.create({
    sender: req.user._id,
    content: systemContent,
    chat: chatId,
    isSystemMessage: true,
  });
  systemMsg = await systemMsg.populate("sender", "name email");
  systemMsg = await systemMsg.populate("chat");
  await Chat.findByIdAndUpdate(chatId, { latestMessage: systemMsg });

  // Broadcast the system message to every member in real time
  const io = req.app.get("io");
  chat.users.forEach((member) => {
    io.to(member._id.toString()).emit("message received", systemMsg);
  });

  io.to(chat._id.toString()).emit("group updated", chat);
  res.json(chat);
};

module.exports = { accessChat, fetchChats, createGroupChat, renameGroup, addToGroup, removeFromGroup, updateGroupAdmin };
