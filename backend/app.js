// Local development reads backend/.env; on a host (Render etc.) the variables come from its dashboard.
try { process.loadEnvFile(require('path').join(__dirname, '.env')); } catch { /* no .env file */ }

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require("fs"); 
const morgan = require('morgan');
// const HttpError = require('./models/http-error');
const rfs = require('rotating-file-stream');
const app = express()
const swaggerUI = require("swagger-ui-express");
const swaggerJsDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "VIHARI API",
      version: "1.0.0",
      description: "This is Vihari API application made with express and documented with swaggerAPI"
    },
    servers: [
      {
        url: process.env.PUBLIC_API_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 4000}`,
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          value: "Bearer <JWT token here>"
        }
      }
    },
  },
  apis: [path.join(__dirname, 'routes', '*.js'), path.join(__dirname, 'app.js')],
};

const specs = swaggerJsDoc(options);

app.use(
  "/api-docs",
  swaggerUI.serve,
  swaggerUI.setup(specs)
)

app.get('/', (req, res) => {
  res.send('API is running');
});

// app.use((req, res, next) => {
//   const error = new HttpError('Could not find this route.', 404);
//   throw error;
// });

app.use(express.json())

// app.use(helmet())
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));

// FRONTEND_URL: the website's address(es), comma-separated, e.g. https://vihari.vercel.app.
// When it is not set (local development) any origin is allowed.
const allowedOrigins = (process.env.FRONTEND_URL || '').split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);
app.use(cors(allowedOrigins.length ? {
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
} : undefined));

const accessLogStream = rfs.createStream("access.log", {
  interval: '1d',
  path: path.join(__dirname, 'logs')
})
app.use(morgan('combined', { stream: accessLogStream }))
// Routing..

const agentRoutes = require('./routes/agent');
const adminRoutes = require('./routes/admin');
const tourRoutes = require('./routes/tour');
// Passenger details now come from the partner API (/api/agent/buses/:id/bookings), which checks ownership.
app.use(require('./routes/bus'))

app.use(require('./routes/auth'))
app.use('/api/agent', agentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tour', tourRoutes);
app.use('/api/assistant', require('./routes/assistant'));


// app.get('/',(req,res)=>{
//   res.send("Hello World!")
// })

// inbuilt middleware
// app.use('/uploads',express.static(__dirname+'/uploads'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/images', express.static(__dirname + '/public/Images'));

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(error.stack);
  if (req.file?.path) fs.unlink(req.file.path, () => {});
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error.status) ? error.status : 500;
  res.status(status).json({ message: status === 500 ? 'An unknown error occurred!' : error.message });
});


mongoose
  .connect(process.env.MONGO_URI)
  .then((result) => {
    app.listen(process.env.PORT || 4000, () => {
      console.log("listening to port " + (process.env.PORT || 4000));
    });
    console.log("Mongodb connected");
  })
  .catch((err) => {
    console.log("MongoDB connection error:", err.message);
    process.exit(1);
  });
module.exports=app;