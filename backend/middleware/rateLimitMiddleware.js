const rateLimit = require("express-rate-limit");

/**
 * authLimiter — applied to /api/auth/register and /api/auth/login.
 *
 * Allows a maximum of 10 requests per IP in any 15-minute window.
 * Exceeding the limit returns a 429 JSON response instead of the
 * default HTML page, so the frontend can parse it cleanly.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // max 10 attempts per IP per window
  standardHeaders: true,     // send RateLimit-* headers (RFC 6585)
  legacyHeaders: false,      // disable X-RateLimit-* legacy headers
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many attempts, please try again later.",
    });
  },
});

module.exports = { authLimiter };
