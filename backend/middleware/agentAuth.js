const JWT = require('jsonwebtoken');
const Agent = require('../models/agent');
const Admin = require('../models/admin');

const deny = (res, status, error) => res.status(status).json({ success: false, error });

const readToken = (req) => {
  const token = req.header('auth-token');
  if (!token) return { error: [401, 'Please log in to continue'] };
  try {
    return { payload: JWT.verify(token, process.env.JWT_SECRET) };
  } catch {
    return { error: [401, 'Your session has expired. Please log in again.'] };
  }
};

// The partner must still exist, be approved and not blocked (an admin can block someone who
// is already logged in). Puts the partner (without password) on req.agent.
const loadAgent = async (id) => {
  const agent = await Agent.findById(id).select('-password');
  if (!agent) return { error: [401, 'Partner account not found'] };
  if (agent.blocked) return { error: [403, 'This partner account has been blocked'] };
  if (agent.flag !== 1) return { error: [403, 'Your partner application is still under review'] };
  return { agent };
};

const loadAdmin = async (id) => {
  const admin = await Admin.findById(id).select('-password');
  return admin ? { admin } : { error: [401, 'Admin account not found'] };
};

// Factory: which kinds of accounts may call the route.
const allow = ({ agent: allowAgent = false, admin: allowAdmin = false }) => async (req, res, next) => {
  const { payload, error } = readToken(req);
  if (error) return deny(res, ...error);
  try {
    if (allowAdmin && payload.admin?.id) {
      const r = await loadAdmin(payload.admin.id);
      if (r.error) return deny(res, ...r.error);
      req.admin = r.admin;
      return next();
    }
    if (allowAgent && payload.agent?.id) {
      const r = await loadAgent(payload.agent.id);
      if (r.error) return deny(res, ...r.error);
      req.agent = r.agent;
      return next();
    }
    const who = [allowAgent && 'partner', allowAdmin && 'admin'].filter(Boolean).join(' or ');
    return deny(res, 401, `Please log in with a ${who} account`);
  } catch (err) {
    console.log(err);
    return deny(res, 500, 'Internal error');
  }
};

const agentAuth = allow({ agent: true });
module.exports = agentAuth;
module.exports.agentAuth = agentAuth;
module.exports.adminAuth = allow({ admin: true });
module.exports.agentOrAdmin = allow({ agent: true, admin: true });
