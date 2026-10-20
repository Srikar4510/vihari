const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const orderController = require('../controllers/order');
const fileUpload = require('../middleware/fileUpload');
const fetchuser = require('../middleware/fetchUser');
const auth = require('../middleware/auth');
const profileController = require('../controllers/profile');

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: API endpoints for user authentication and authorization
 */

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Authenticate user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *             required:
 *               - email
 *               - password
 *     responses:
 *       200:
 *         description: User authenticated successfully
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Internal server error
 */

router.post('/login', authController.verifyUser);

/**
 * @swagger
 * /signup:
 *   post:
 *     summary: Register new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: User already exists
 *       500:
 *         description: Internal server error
 */

router.post('/signup', authController.createUser);

/**
 * @swagger
 * /agentSignUp:
 *   post:
 *     summary: Register new agent
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               agentName:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               document:
 *                 type: string
 *                 format: binary
 *             required:
 *               - agentName
 *               - email
 *               - password
 *               - document
 *     responses:
 *       201:
 *         description: Agent registered successfully
 *       400:
 *         description: Agent already exists
 *       500:
 *         description: Internal server error
 */

router.post("/agentSignUp", fileUpload.single('document'), fileUpload.persistUpload('document'), authController.createAgent);

/**
 * @swagger
 * /agentLogin:
 *   post:
 *     summary: Authenticate agent
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *             required:
 *               - email
 *               - password
 *     responses:
 *       200:
 *         description: Agent authenticated successfully
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Internal server error
 */

router.post("/agentLogin", authController.verifyAgent);
router.post('/adminLogin', authController.verifyAdmin);

/**
 * @swagger
 * /order:
 *   post:
 *     summary: Create order
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               price:
 *                 type: number
 *             required:
 *               - price
 *     responses:
 *       200:
 *         description: Order created successfully
 *       500:
 *         description: Internal server error
 */

router.post('/order', orderController.createorder);

/**
 * @swagger
 * /userdetails:
 *   post:
 *     summary: Get user details
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */

router.post('/userdetails', auth, authController.getUserDetails);

/**
 * @swagger
 * /history:
 *   get:
 *     summary: Get user booking history
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User booking history retrieved successfully
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */

router.get('/history', auth, authController.getBookings);

/**
 * @swagger
 * /tourbookings:
 *   get:
 *     summary: Get user tour bookings
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User tour bookings retrieved successfully
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */

router.get('/tourbookings', auth, authController.tourBookings);

// Traveller profile, trips and saved co-travellers (auth-token header).
router.get('/profile', fetchuser, profileController.getProfile);
router.put('/profile', fetchuser, profileController.updateProfile);
router.get('/mytrips', fetchuser, profileController.myTrips);
router.get('/mytours', fetchuser, profileController.myTours);
router.get('/travellers', fetchuser, profileController.listTravellers);
router.post('/travellers', fetchuser, profileController.addTraveller);
router.put('/travellers/:id', fetchuser, profileController.updateTraveller);
router.delete('/travellers/:id', fetchuser, profileController.deleteTraveller);

module.exports = router;
