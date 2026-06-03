import mongoose from 'mongoose';
import { env } from './env';

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(env.mongoUri);
    const dbName = mongoose.connection.db?.databaseName ?? 'unknown';
    console.log(`✅ MongoDB connected — database: "${dbName}"`);
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1);
  }
}
