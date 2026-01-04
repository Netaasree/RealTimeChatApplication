const Message = require("../models/message");
const Chat = require("../models/chat");

const sendMessage = async (req, res) => {
  const { content, chatId } = req.body;

if (!content || !chatId) {
  return res.status(400).json({ message: "Content and chatId are required" });
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
const messages = await Message.find({
    chat: req.params.chatId,
  })
    .populate("sender", "name email")
    .populate("chat");

  res.json(messages);
};

module.exports = { sendMessage, fetchMessages};
