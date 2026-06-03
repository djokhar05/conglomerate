import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import { expensesRouter } from './routes/expenses.routes';
import { investmentsRouter } from './routes/investments.routes';
import { membersRouter } from './routes/members.routes';
import { paymentsRouter } from './routes/payments.routes';

export const app = express();

// Trust Vercel's reverse proxy so req.ip reflects the real client IP
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS origin not allowed'));
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(morgan('dev'));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  keyGenerator: (req) => req.ip ?? req.socket.remoteAddress ?? 'unknown',
}));

app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'conglomerate-api' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/members', membersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/investments', investmentsRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/dashboard', dashboardRouter);

app.use(notFoundHandler);
app.use(errorHandler);
