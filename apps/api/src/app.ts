import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { router } from './routes.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.PUBLIC_ORIGIN, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Idempotency-Key', 'X-CSRF-Token'] }));
app.use(express.json({ limit: '32kb', type: 'application/json' }));
app.use(cookieParser(config.PIN_PEPPER));
app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); }, router);
app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' } }));
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = (err as { status?: number })?.status;
  if (status === 400 || status === 413) {
    res.status(status).json({ error: { code: 'INVALID_REQUEST', message: status === 413 ? 'That request is too large.' : 'That request is not valid JSON.' } });
    return;
  }
  // Never log connection values, cookies or request bodies containing PINs.
  console.error('CloudSent API request failed', { code: (err as { code?: string })?.code || 'INTERNAL_ERROR' });
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'CloudSent is temporarily unavailable.' } });
});

export default app;
