const express = require("express");
const { body } = require("express-validator");
const { registerUser, authUser } = require("../controllers/authController");
const validate = require("../middleware/validateMiddleware");
const { authLimiter } = require("../middleware/rateLimitMiddleware");

const router = express.Router();

// ── POST /api/auth/register ──────────────────────────────────────────────────
router.post(
  "/register",
  authLimiter,
  [
    body("name")
      .trim()
      .notEmpty().withMessage("Name is required")
      .isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),
    body("email")
      .notEmpty().withMessage("Email is required")
      .isEmail().withMessage("Please provide a valid email address")
      .normalizeEmail(),
    body("password")
      .notEmpty().withMessage("Password is required")
      .isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  validate,
  registerUser,
);

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post(
  "/login",
  authLimiter,
  [
    body("email")
      .notEmpty().withMessage("Email is required")
      .isEmail().withMessage("Please provide a valid email address"),
    body("password")
      .notEmpty().withMessage("Password is required"),
  ],
  validate,
  authUser,
);

module.exports = router;
