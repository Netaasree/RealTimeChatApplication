const { validationResult } = require("express-validator");

/**
 * Runs express-validator's validationResult on the request.
 * If there are validation errors, immediately responds with
 * 400 and the first human-readable error message.
 * Otherwise calls next() to continue to the route controller.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstMessage = errors.array()[0].msg;
    return res.status(400).json({
      message: firstMessage,
      errors: errors.array(),
    });
  }
  next();
};

module.exports = validate;
