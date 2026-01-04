const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { accessChat, fetchChats } = require("../controllers/chatController");

const router = express.Router();

// create or fetch one-to-one chat
router.post("/", protect, accessChat);
router.get("/", protect, fetchChats);


module.exports = router;
