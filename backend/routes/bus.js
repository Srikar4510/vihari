const express = require('express');
const router = express.Router();
const busController = require('../controllers/bus');
const fetchUser = require('../middleware/fetchUser');

/**
 * @swagger
 * tags:
 *   name: Bus
 *   description: API endpoints for bus operations
 */

/**
 * @swagger
 * /buslist:
 *   post:
 *     summary: Get list of buses
 *     tags: [Bus]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               srcname:
 *                 type: string
 *               destname:
 *                 type: string
 *             required:
 *               - srcname
 *               - destname
 *     responses:
 *       200:
 *         description: List of buses retrieved successfully
 *       500:
 *         description: Internal server error
 */

router.post('/buslist', busController.busList);
router.get('/routes', busController.routes);

/**
 * @swagger
 * /booking:
 *   post:
 *     summary: Book seats on a bus
 *     tags: [Bus]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bus:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *               seats:
 *                 type: number
 *               date:
 *                 type: string
 *             required:
 *               - bus
 *               - seats
 *               - date
 *     responses:
 *       200:
 *         description: Seats booked successfully
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */

router.post('/booking', fetchUser, busController.booking);

/**
 * @swagger
 * /busdetails:
 *   post:
 *     summary: Get details of a bus
 *     tags: [Bus]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *             required:
 *               - id
 *     responses:
 *       200:
 *         description: Bus details retrieved successfully
 *       500:
 *         description: Internal server error
 */

router.post('/busdetails', busController.getBusDetails);

/**
 * @swagger
 * /bookedseats:
 *   post:
 *     summary: Get booked seats on a bus
 *     tags: [Bus]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               date:
 *                 type: string
 *             required:
 *               - id
 *               - date
 *     responses:
 *       200:
 *         description: Booked seats retrieved successfully
 *       500:
 *         description: Internal server error
 */

router.post('/bookedseats', busController.booked);

module.exports = router;
