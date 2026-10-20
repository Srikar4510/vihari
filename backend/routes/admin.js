const express = require('express');
const { adminAuth } = require('../middleware/agentAuth');
const admin = require('../controllers/admin');

const router = express.Router();

// Every admin endpoint needs an admin token (from POST /adminLogin) in the auth-token header.
router.use(adminAuth);

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin console API (admin token in the auth-token header)
 * /api/admin/me:
 *   get: { summary: Logged-in admin, tags: [Admin], responses: { 200: { description: "{ admin, mailConfigured }" } } }
 * /api/admin/dashboard:
 *   get: { summary: Platform stats, last 14 days, recent bookings, pending partners, top partners, tags: [Admin], responses: { 200: { description: Dashboard data } } }
 * /api/admin/users:
 *   get: { summary: All travellers with booking stats, tags: [Admin], responses: { 200: { description: "{ users }" } } }
 *   post: { summary: Add a traveller (firstName, lastName, email, mobile, password), tags: [Admin], responses: { 201: { description: "{ user }" } } }
 * /api/admin/users/{userId}:
 *   put: { summary: Edit a traveller's name, email and mobile, tags: [Admin], parameters: [{ in: path, name: userId, required: true }], responses: { 200: { description: "{ user }" } } }
 *   delete: { summary: Delete a traveller with no upcoming trips, tags: [Admin], parameters: [{ in: path, name: userId, required: true }], responses: { 200: { description: Deleted }, 409: { description: Has upcoming trips } } }
 * /api/admin/agents:
 *   get: { summary: All partners with status and counts, tags: [Admin], responses: { 200: { description: "{ agents }" } } }
 * /api/admin/agents/{agentId}/approve:
 *   put: { summary: Approve a partner, tags: [Admin], parameters: [{ in: path, name: agentId, required: true }], responses: { 200: { description: "{ agent, emailSent }" } } }
 * /api/admin/agents/{agentId}:
 *   delete: { summary: Reject (remove) a pending application, tags: [Admin], parameters: [{ in: path, name: agentId, required: true }], responses: { 200: { description: "{ emailSent }" } } }
 * /api/admin/agents/{agentId}/block:
 *   put: { summary: Block a partner, tags: [Admin], parameters: [{ in: path, name: agentId, required: true }], responses: { 200: { description: "{ agent, emailSent }" } } }
 * /api/admin/agents/{agentId}/unblock:
 *   put: { summary: Unblock a partner, tags: [Admin], parameters: [{ in: path, name: agentId, required: true }], responses: { 200: { description: "{ agent, emailSent }" } } }
 * /api/admin/agents/{agentId}/document:
 *   get: { summary: A partner's registration document, tags: [Admin], parameters: [{ in: path, name: agentId, required: true }], responses: { 200: { description: The file } } }
 * /api/admin/announcements:
 *   get: { summary: Recipient counts and whether email is configured, tags: [Admin], responses: { 200: { description: "{ users, partners, mailConfigured }" } } }
 *   post: { summary: Email an announcement (subject, message, audience users|partners|all), tags: [Admin], responses: { 200: { description: "{ sent }" } } }
 */
router.get('/me', admin.me);
router.get('/dashboard', admin.dashboard);

router.get('/users', admin.listUsers);
router.post('/users', admin.addUser);
router.put('/users/:userId', admin.editUser);
router.delete('/users/:userId', admin.deleteUser);

router.get('/agents', admin.listAgents);
router.put('/agents/:agentId/approve', admin.approveAgent);
router.delete('/agents/:agentId', admin.rejectAgent);
router.put('/agents/:agentId/block', admin.blockAgent);
router.put('/agents/:agentId/unblock', admin.unblockAgent);
router.get('/agents/:agentId/document', admin.agentDocument);

router.get('/announcements', admin.recipients);
router.post('/announcements', admin.announce);

module.exports = router;
