const Message = require("../models/message");
const Chat = require("../models/chat");

const sendMessage = async (req, res) => {
  const { content, chatId } = req.body;

if (!content || !chatId) {
  return res.status(400).json({ message: "Content and chatId are required" });
}
const chat = await Chat.findOne({ _id: chatId, users: req.user._id });
if (!chat) {
  return res.status(403).json({ message: "You are not a member of this chat" });
}

let message = await Message.create({
  sender: req.user._id,
  content,
  chat: chatId,
});
message = await message.populate("sender", "name email");
message = await message.populate("chat");
await Chat.findByIdAndUpdate(chatId, {
  latestMessage: message,
});

res.status(201).json(message);

};

const fetchMessages = async (req, res) => {
const chat = await Chat.findOne({ _id: req.params.chatId, users: req.user._id });
if (!chat) {
  return res.status(403).json({ message: "You are not a member of this chat" });
}
const messages = await Message.find({
    chat: req.params.chatId,
  })
    .populate("sender", "name email")
    .populate("chat")
    .populate("readBy", "name");

  res.json(messages);
};

const markAsRead = async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.chatId, users: req.user._id });
  if (!chat) {
    return res.status(403).json({ message: "You are not a member of this chat" });
  }

  const result = await Message.updateMany(
    {
      chat: req.params.chatId,
      sender: { $ne: req.user._id },
      readBy: { $ne: req.user._id },
    },
    { $addToSet: { readBy: req.user._id } }
  );

  if (result.modifiedCount > 0) {
    req.app.get("io").to(req.params.chatId).emit("messages read", {
      chatId: req.params.chatId,
      userId: req.user._id.toString(),
    });
  }

  res.json({ message: "Messages marked as read" });
};

const editMessage = async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) {
    return res.status(400).json({ message: "Message content is required" });
  }

  let message = await Message.findById(req.params.messageId);
  if (!message) {
    return res.status(404).json({ message: "Message not found" });
  }
  if (message.sender.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "You can only edit your own messages" });
  }
  if (message.isDeleted) {
    return res.status(400).json({ message: "Deleted messages cannot be edited" });
  }

  message.content = content.trim();
  message.editedAt = new Date();
  await message.save();
  message = await message.populate("sender", "name email");
  message = await message.populate("chat");
  message = await message.populate("readBy", "name");

  req.app.get("io").to(message.chat._id.toString()).emit("message edited", message);
  res.json(message);
};

const deleteMessage = async (req, res) => {
  let message = await Message.findById(req.params.messageId);
  if (!message) {
    return res.status(404).json({ message: "Message not found" });
  }
  if (message.sender.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "You can only delete your own messages" });
  }

  message.isDeleted = true;
  message.content = "";
  await message.save({ validateBeforeSave: false });
  message = await message.populate("sender", "name email");
  message = await message.populate("chat");
  message = await message.populate("readBy", "name");

  req.app.get("io").to(message.chat._id.toString()).emit("message deleted", message);
  res.json(message);
};

module.exports = { sendMessage, fetchMessages, markAsRead, editMessage, deleteMessage};
