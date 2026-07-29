const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { accessChat, fetchChats, createGroupChat, renameGroup, addToGroup, removeFromGroup } = require("../controllers/chatController");

const router = express.Router();

// create or fetch one-to-one chat
router.post("/", protect, accessChat);
router.get("/", protect, fetchChats);
router.post("/group", protect, createGroupChat);
router.put("/rename", protect, renameGroup);
router.put("/groupadd", protect, addToGroup);
router.put("/groupremove", protect, removeFromGroup);


module.exports = router;
