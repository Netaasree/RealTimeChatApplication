const User = require("../models/user");
const generateToken = require("../utils/generateToken");

/* ======================
   REGISTER USER
====================== */
const registerUser = async (req, res) => {
  // express-validator has already checked name/email/password
  // and normalizeEmail() has lowercased + trimmed req.body.email.
  const { name, email, password } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    return res.status(400).json({ message: "User already exists" });
  }

  const user = await User.create({
    name: name.trim(),
    email,
    password,
  });

  if (user) {
    return res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    });
  } else {
    return res.status(400).json({ message: "Invalid user data" });
  }
};

/* ======================
   AUTH / LOGIN USER
====================== */
const authUser = async (req, res) => {
  // express-validator has already confirmed email + password are present.
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.trim().toLowerCase() });

  if (user && (await user.matchPassword(password))) {
    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    });
  } else {
    return res.status(401).json({
      message: "Invalid email or password",
    });
  }
};

module.exports = { registerUser, authUser };
