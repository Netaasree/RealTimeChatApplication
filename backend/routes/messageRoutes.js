const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { sendMessage, fetchMessages, markAsRead, editMessage, deleteMessage } = require("../controllers/messageController");

const router = express.Router();

// send a new message
router.post("/", protect, sendMessage);
router.post("/read/:chatId", protect, markAsRead);
router.get("/:chatId", protect, fetchMessages);
router.put("/:messageId", protect, editMessage);
router.delete("/:messageId", protect, deleteMessage);


module.exports = router;
