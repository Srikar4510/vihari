const express = require('express');
const router = express.Router();
const tourControllers = require('../controllers/tour');
const fetchUser = require('../middleware/fetchUser');

/**
 * @swagger
 * tags:
 *   name: Tour
 *   description: API endpoints for tour operations
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     TourBooking:
 *       type: object
 *       properties:
 *         tour:
 *           type: string
 *         tickets:
 *           type: number
 *         price:
 *           type: number
 *       required:
 *         - tour
 *         - tickets
 *         - price
 *     TourDetails:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *       required:
 *         - id
 */

/**
 * @swagger
 * /api/tour/tourbooking:
 *   post:
 *     summary: Book a tour
 *     tags: [Tour]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TourBooking'
 *     responses:
 *       200:
 *         description: Tour booked successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */

router.post("/tourbooking", fetchUser, tourControllers.booking);

/**
 * @swagger
 * /api/tour/gettour:
 *   post:
 *     summary: Get tour details
 *     tags: [Tour]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TourDetails'
 *     responses:
 *       200:
 *         description: Tour details retrieved successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */

router.post("/gettour", fetchUser, tourControllers.getTour);

module.exports = router;
