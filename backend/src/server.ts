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

void start().catch(() => {
  console.error('nte_naadu_api_start_failed');
  process.exit(1);
});
