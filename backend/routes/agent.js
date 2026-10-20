const express = require('express');
const fileUpload = require('../middleware/fileUpload');
const { persistUpload } = require('../middleware/fileUpload');
const { agentAuth, agentOrAdmin } = require('../middleware/agentAuth');
const agent = require('../controllers/agent');

const router = express.Router();

// Runs multer for one image field and turns its errors (too large, wrong type) into JSON.
// Then stores it (Cloudinary in production, local disk in development).
const image = (field) => (req, res, next) => fileUpload.single(field)(req, res, (err) => {
  if (!err) return persistUpload('image')(req, res, next);
  const error = err.code === 'LIMIT_FILE_SIZE' ? 'Photos must be under 10 MB' : err.message || 'Upload failed';
  return res.status(400).json({ success: false, error });
});

/**
 * @swagger
 * tags:
 *   name: Agent
 *   description: Public bus/tour reads and the partner portal API
 */

// ---------- Public reads ----------

/**
 * @swagger
 * /api/agent/allbuses:
 *   get: { summary: All buses, tags: [Agent], responses: { 200: { description: "{ buses }" } } }
 * /api/agent/getbus/{busId}:
 *   get: { summary: One bus, tags: [Agent], parameters: [{ in: path, name: busId, required: true }], responses: { 200: { description: "{ bus }" } } }
 * /api/agent/alltours:
 *   get: { summary: All tours (cached in Redis), tags: [Agent], responses: { 200: { description: "{ tours }" } } }
 * /api/agent/gettour/{tourId}:
 *   get: { summary: One tour, tags: [Agent], parameters: [{ in: path, name: tourId, required: true }], responses: { 200: { description: "{ tour }" } } }
 * /api/agent/tourplaces/{tourId}:
 *   get: { summary: Places of a tour, tags: [Agent], parameters: [{ in: path, name: tourId, required: true }], responses: { 200: { description: "{ places, tour }" } } }
 */
router.get('/allbuses', agent.getBuses);
router.get('/getbus/:busId', agent.getBusDetails);
router.get('/alltours', agent.getTours);
router.get('/gettour/:tourId', agent.getTourDetails);
router.get('/tourplaces/:tourId', agent.getPlaces);

// ---------- Partner portal (partner token in the auth-token header) ----------
// Bus/tour/place management also accepts an admin token (admins can manage every partner's items).

/**
 * @swagger
 * /api/agent/me:
 *   get: { summary: Logged-in partner profile, tags: [Agent], parameters: [{ in: header, name: auth-token, required: true }], responses: { 200: { description: "{ agent, stats }" } } }
 *   put: { summary: Update agency name and email, tags: [Agent], parameters: [{ in: header, name: auth-token, required: true }], responses: { 200: { description: "{ agent }" } } }
 * /api/agent/dashboard:
 *   get: { summary: Partner dashboard (stats, last 14 days, recent bookings, top routes), tags: [Agent], parameters: [{ in: header, name: auth-token, required: true }], responses: { 200: { description: Dashboard data } } }
 * /api/agent/buses:
 *   get: { summary: The partner's buses with booking stats, tags: [Agent], parameters: [{ in: header, name: auth-token, required: true }], responses: { 200: { description: "{ buses, busTypes }" } } }
 *   post: { summary: "Add a bus (multipart: srcname, destname, trname, btype, deptime, duration, tktprice, image)", tags: [Agent], parameters: [{ in: header, name: auth-token, required: true }], responses: { 201: { description: "{ bus }" } } }
 * /api/agent/buses/{busId}:
 *   get: { summary: One of the partner's buses, tags: [Agent], parameters: [{ in: header, name: auth-token, required: true }, { in: path, name: busId, required: true }], responses: { 200: { description: "{ bus }" } } }
 *   put: { summary: Edit a bus (image optional), tags: [Agent], parameters: [{ in: header, name: auth-token, required: true }, { in: path, name: busId, required: true }], responses: { 200: { description: "{ bus }" } } }
 *   delete: { summary: Delete a bus with no upcoming bookings, tags: [Agent], parameters: [{ in: header, name: auth-token, required: true }, { in: path, name: busId, required: true }], responses: { 200: { description: Deleted }, 409: { description: Has upcoming bookings } } }
 * /api/agent/buses/{busId}/bookings:
 *   get: { summary: Passenger list for a bus, tags: [Agent], parameters: [{ in: header, name: auth-token, required: true }, { in: path, name: busId, required: true }], responses: { 200: { description: "{ bus, bookings }" } } }
 * /api/agent/tours:
 *   get: { summary: The partner's tours with booking stats, tags: [Agent], parameters: [{ in: header, name: auth-token, required: true }], responses: { 200: { description: "{ tours }" } } }
 *   post: { summary: "Add a tour (multipart: tname, tprice, duration, highlight, features, tourImage)", tags: [Agent], parameters: [{ in: header, name: auth-token, required: true }], responses: { 201: { description: "{ tour }" } } }
 * /api/agent/tours/{tourId}:
 *   get: { summary: One of the partner's tours with its places, tags: [Agent], parameters: [{ in: header, name: auth-token, required: true }, { in: path, name: tourId, required: true }], responses: { 200: { description: "{ tour, places }" } } }
 *   put: { summary: Edit a tour (image optional), tags: [Agent], parameters: [{ in: header, name: auth-token, required: true }, { in: path, name: tourId, required: true }], responses: { 200: { description: "{ tour }" } } }
 *   delete: { summary: Delete a tour with no bookings, tags: [Agent], parameters: [{ in: header, name: auth-token, required: true }, { in: path, name: tourId, required: true }], responses: { 200: { description: Deleted }, 409: { description: Has bookings } } }
 * /api/agent/tours/{tourId}/bookings:
 *   get: { summary: Bookings for a tour, tags: [Agent], parameters: [{ in: header, name: auth-token, required: true }, { in: path, name: tourId, required: true }], responses: { 200: { description: "{ tour, bookings }" } } }
 * /api/agent/tours/{tourId}/places:
 *   post: { summary: "Add a place (multipart: name, description, placeImage)", tags: [Agent], parameters: [{ in: header, name: auth-token, required: true }, { in: path, name: tourId, required: true }], responses: { 201: { description: "{ place }" } } }
 * /api/agent/places/{placeId}:
 *   put: { summary: Edit a place (image optional), tags: [Agent], parameters: [{ in: header, name: auth-token, required: true }, { in: path, name: placeId, required: true }], responses: { 200: { description: "{ place }" } } }
 *   delete: { summary: Delete a place, tags: [Agent], parameters: [{ in: header, name: auth-token, required: true }, { in: path, name: placeId, required: true }], responses: { 200: { description: Deleted } } }
 */
router.get('/me', agentAuth, agent.me);
router.put('/me', agentAuth, agent.updateMe);
router.get('/dashboard', agentAuth, agent.dashboard);

router.get('/bustypes', agentOrAdmin, agent.busTypes);
router.get('/buses', agentOrAdmin, agent.myBuses);
router.post('/buses', agentAuth, image('image'), agent.addBus);
router.get('/buses/:busId', agentOrAdmin, agent.getMyBus);
router.put('/buses/:busId', agentOrAdmin, image('image'), agent.editBus);
router.delete('/buses/:busId', agentOrAdmin, agent.deleteBus);
router.get('/buses/:busId/bookings', agentOrAdmin, agent.busBookings);

router.get('/tours', agentOrAdmin, agent.myTours);
router.post('/tours', agentAuth, image('tourImage'), agent.addTour);
router.get('/tours/:tourId', agentOrAdmin, agent.getMyTour);
router.put('/tours/:tourId', agentOrAdmin, image('tourImage'), agent.editTour);
router.delete('/tours/:tourId', agentOrAdmin, agent.deleteTour);
router.get('/tours/:tourId/bookings', agentOrAdmin, agent.tourBookings);

router.post('/tours/:tourId/places', agentOrAdmin, image('placeImage'), agent.addPlace);
router.put('/places/:placeId', agentOrAdmin, image('placeImage'), agent.editPlace);
router.delete('/places/:placeId', agentOrAdmin, agent.deletePlace);

module.exports = router;
