const Chat = require("../models/chat");

const accessChat = async (req, res) => {
  const { userId } = req.body;

if (!userId) {
  return res.status(400).json({ message: "UserId is required" });
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
    .sort({ updatedAt: -1 });

  res.json(chats);
};


module.exports = { accessChat, fetchChats};
