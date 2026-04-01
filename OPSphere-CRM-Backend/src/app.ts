import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { errorHandler } from './middleware/errorHandler.js';
import { authenticate } from './middleware/auth.js';
import { entityScope } from './middleware/entityScope.js';

import authRoutes from './routes/auth.js';
import entityRoutes from './routes/entities.js';
import leadRoutes from './routes/leads.js';
import campaignRoutes from './routes/campaigns.js';
import prospectRoutes from './routes/prospects.js';
import messageRoutes from './routes/messages.js';
import pipelineRoutes from './routes/pipeline.js';
import brandVoiceRoutes from './routes/brand-voices.js';
import appointmentRoutes from './routes/appointments.js';

const app = express();

// ─── Global Middleware ───────────────────────────────────

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ─── Health Check ────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'opsphere-crm-backend', timestamp: new Date().toISOString() });
});

// ─── Public Routes ───────────────────────────────────────

app.use('/api/auth', authRoutes);

// ─── Protected Routes ────────────────────────────────────

app.use('/api/entities', authenticate, entityRoutes);
app.use('/api/crm/leads', authenticate, entityScope, leadRoutes);
app.use('/api/crm/campaigns', authenticate, entityScope, campaignRoutes);
app.use('/api/crm/prospects', authenticate, entityScope, prospectRoutes);
app.use('/api/crm/messages', authenticate, entityScope, messageRoutes);
app.use('/api/crm/pipeline', authenticate, entityScope, pipelineRoutes);
app.use('/api/crm/brand-voices', authenticate, entityScope, brandVoiceRoutes);
app.use('/api/crm/appointments', authenticate, entityScope, appointmentRoutes);

// ─── Error Handler (must be last) ────────────────────────

app.use(errorHandler);

export default app;
