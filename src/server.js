import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateRouter, requireAuthMiddleware } from './sso.js';
import { createDatabasePool, ensureSchema } from './storage.js';
import { apiRouter } from './tickets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change_this_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, sameSite: 'lax' }
  })
);

// Database pool
const dbPool = await createDatabasePool();
await ensureSchema(dbPool);

// Attach db to request
app.use((req, _res, next) => {
  req.db = dbPool;
  next();
});

// Auth routes
app.use('/auth', authenticateRouter);

// API routes (protected)
app.use('/api', requireAuthMiddleware, apiRouter);

// Static files
const rootDir = path.resolve(__dirname, '..');
app.use(express.static(rootDir));

// SPA entry
app.get('*', (_req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${port}`);
});

