import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import kbRoutes from './routes/kb';
import reportRoutes from './routes/report';
import adminRoutes from './routes/admin';
import collectRoutes from './routes/collect';
import exfilRoutes from './routes/exfil';
import { errorHandler } from './middleware/errorHandler';
import { initDatabase } from './db';

dotenv.config();

export function createApp() {
  const app = express();

  // Middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disabled for CTF purposes
  }));
  app.use(cors({
    origin: ['http://localhost:5174', 'http://localhost:5173'],
    credentials: true
  }));
  app.use(morgan('dev'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/kb', kbRoutes);
  app.use('/api/report', reportRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/collect', collectRoutes);
  app.use('/api/exfil', exfilRoutes);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API route discovery — intentional CTF breadcrumb
  app.get('/api/routes', (_req, res) => {
    res.json({
      public: [
        'POST /api/auth/login',
        'POST /api/auth/register',
        'POST /api/exfil/capture',
      ],
      authenticated: [
        'GET  /api/auth/me',
        'GET  /api/kb/articles',
        'GET  /api/kb/articles/:id',
        'GET  /api/kb/tags',
        'POST /api/report',
        'GET  /api/report/my-reports',
        'GET  /api/exfil/my-captures',
      ],
      admin: [
        'GET  /api/admin/flag?reportId=<id>',
        'GET  /api/admin/reports',
        'GET  /api/admin/exfil-logs',
      ],
    });
  });

  // Error handling
  app.use(errorHandler);

  return app;
}

const PORT = process.env.PORT || 3000;

// Initialize database and start server
async function start() {
  try {
    await initDatabase();
    const app = createApp();
    app.listen(PORT, () => {
      console.log(`🚀 API server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

export default createApp;
