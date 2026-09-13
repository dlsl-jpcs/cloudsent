import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { router } from './routes.js';
import { runMigrations } from './db/migrate.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.PUBLIC_ORIGIN, credentials: true, methods: ['GET','POST','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Idempotency-Key','X-CSRF-Token'] }));
app.use(express.json({ limit: '32kb', type: 'application/json' }));
app.use(cookieParser(config.PIN_PEPPER));
app.use((req, _res, next) => { if (config.NODE_ENV !== 'test') console.log(`${req.method} ${req.path}`); next(); });
app.use('/api', router);
app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' } }));
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { console.error(err); res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'CloudSent is temporarily unavailable.' } }); });

await runMigrations();
app.listen(config.PORT, () => console.log(`CloudSent API listening on ${config.PORT}`));
