import app from './app';
import { connectNteDatabase } from './config/database';
import { env } from './config/env';
import { allNteModels } from './models';

async function start(): Promise<void> {
  await connectNteDatabase();
  await Promise.all(allNteModels.map((model) => model.init()));
  const server = app.listen(env.port, () => {
    console.info('nte_naadu_api_started', { port: env.port, nodeEnv: env.nodeEnv });
  });
  const shutdown = () => server.close(() => { process.exit(0); });
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

void start().catch((error: unknown) => {
  // Preserve useful startup diagnostics without ever logging connection
  // credentials if a driver includes them in an error message.
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  const safeMessage = message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, '[redacted MongoDB URI]');
  console.error('nte_naadu_api_start_failed', {
    errorName: error instanceof Error ? error.name : 'UnknownError',
    errorCode: typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined,
    message: safeMessage,
  });
  process.exit(1);
});
