const express = require('express');
const JWT = require('jsonwebtoken');
const assistant = require('../utils/assistant');

const router = express.Router();

const MAX_LENGTH = 300;
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 30;
const hits = new Map();

// Small in-memory limit per IP so the endpoint can't be hammered.
const rateLimit = (req, res, next) => {
  const now = Date.now();
  const entry = hits.get(req.ip) || { start: now, count: 0 };
  if (now - entry.start > WINDOW_MS) { entry.start = now; entry.count = 0; }
  entry.count += 1;
  hits.set(req.ip, entry);
  if (hits.size > 5000) hits.clear();
  if (entry.count > MAX_PER_WINDOW) return res.status(429).json({ error: 'Too many messages. Please wait a moment.' });
  return next();
};

// Logged-in travellers get answers about their own bookings; everyone else can still chat.
const optionalUser = (req) => {
  const token = req.header('auth-token');
  if (!token) return null;
  try {
    return JWT.verify(token, process.env.JWT_SECRET).user?.id || null;
  } catch {
    return null;
  }
};

/**
 * @swagger
 * /api/assistant/chat:
 *   post:
 *     summary: Ask the travel assistant (rule-based, no AI service)
 *     tags: [Assistant]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message: { type: string, example: "Hyderabad to Bangalore tomorrow" }
 *               context: { type: object }
 *     responses:
 *       200: { description: "{ messages, context }" }
 */
router.post('/chat', rateLimit, async (req, res) => {
  const message = String(req.body?.message || '').slice(0, MAX_LENGTH);
  try {
    const answer = await assistant.reply(message, { userId: optionalUser(req), context: req.body?.context });
    res.json({ messages: answer.messages, context: answer.context || {} });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'The assistant is unavailable right now.' });
  }
});

module.exports = router;
