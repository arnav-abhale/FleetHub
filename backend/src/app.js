import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import apiRouter from './routes/index.js';
import errorMiddleware from './middleware/error.middleware.js';

const app = express();

// 1. CORS Configuration for cross-origin frontend requests with credentials
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://fleet-hub-amber.vercel.app',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked origin: ${origin}`));
    }
  },
  credentials: true,
}));

// 2. Core Body & Cookie Parsers
app.use(express.json());
app.use(cookieParser());

// 3. Application API Routes (mounted under /api)
app.use('/api', apiRouter);

// 4. 404 Handler for unknown routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl} - Route not found`,
    data: null,
  });
});

// 5. Centralized Error-Handling Middleware
app.use(errorMiddleware);

export default app;
