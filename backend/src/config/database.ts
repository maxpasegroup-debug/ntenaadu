import mongoose from 'mongoose';
import { env } from './env';

export async function connectNteDatabase(): Promise<void> {
  await mongoose.connect(env.mongoUri, {
    dbName: 'nte_naadu',
    serverSelectionTimeoutMS: 10_000,
  });
}
