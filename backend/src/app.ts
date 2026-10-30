import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { ApiError } from './errors';
import { errorHandler } from './middleware/error-handler';
import { requestContext } from './middleware/request-context';
import routes from './routes';

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'This origin is not allowed.'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: false,
}));
app.use('/api/v1/payments/webhooks', express.raw({ type: '*/*', limit: '64kb' }), (req, _res, next) => {
  if (Buffer.isBuffer(req.body)) req.rawBody = Buffer.from(req.body);
  next();
});
app.use(express.json({ limit: '64kb', strict: true, verify(req, _res, buffer) { req.rawBody = Buffer.from(buffer); } }));
app.use(requestContext);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'nte-naadu-api' }));
app.use('/api/v1', routes);
app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested route was not found.' } }));
app.use(errorHandler);

export default app;
