const notFound = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
};

const errorHandler = (err, req, res, next) => {
  console.error(err);
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({ message: "Not authorized, invalid token" });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid resource identifier" });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: "An account with this email already exists" });
  }
  res.status(res.statusCode >= 400 ? res.statusCode : 500).json({
    message: err.message || "Something went wrong",
  });
};

module.exports = { notFound, errorHandler };
