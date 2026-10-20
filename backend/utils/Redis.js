const redis = require('redis');

// Optional cache. With REDIS_URL set (e.g. a free Upstash database) tour lists are cached;
// without it, or while Redis is unreachable, every call falls through to MongoDB.
let client = null;
let ready = false;

if (process.env.REDIS_URL) {
  client = redis.createClient({
    url: process.env.REDIS_URL,
    socket: { reconnectStrategy: (retries) => Math.min(retries * 500, 10000) },
  });
  client.on('ready', () => { ready = true; console.log('Redis client connected'); });
  client.on('end', () => { ready = false; });
  client.on('error', (err) => { ready = false; console.error('Redis error:', err.message); });
  client.connect().catch((err) => console.error('Redis connection failed:', err.message));
} else {
  console.log('REDIS_URL not set: running without the tours cache');
}

const safe = (fn, fallback) => async (...args) => {
  if (!client || !ready) return fallback;
  try {
    return await fn(...args);
  } catch (err) {
    console.error('Redis command failed:', err.message);
    return fallback;
  }
};

module.exports = {
  get: safe((key) => client.get(key), null),
  set: safe((key, value) => client.set(key, value, { EX: 3600 }), null),
  del: safe((key) => client.del(key), 0),
};
