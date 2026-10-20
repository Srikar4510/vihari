const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET

// Requires a traveller token as "Authorization: Bearer <token>" and puts { id } on req.user.
const auth = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, error: "Please log in to continue" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload.user?.id) {
      return res.status(401).json({ success: false, error: "Please log in with a traveller account" });
    }
    req.user = payload.user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: "Your session has expired. Please log in again." });
  }
};

module.exports = auth;
