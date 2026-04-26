import { app } from './app';
import { connectDatabase } from './config/db';
import { validateEnv } from './config/env';
import { Payment } from './models/Payment';

let initPromise: Promise<void> | null = null;

async function ensurePaymentIndexes() {
  const legacyIndexName = 'member_1_month_1_year_1';
  const indexes = await Payment.collection.indexes();
  const hasLegacyIndex = indexes.some((index) => index.name === legacyIndexName);

  if (hasLegacyIndex) {
    await Payment.collection.dropIndex(legacyIndexName);
    console.log('Dropped legacy index: member_1_month_1_year_1');
  }

  await Payment.syncIndexes();
}

async function initialize() {
  validateEnv();
  await connectDatabase();
  await ensurePaymentIndexes();
}

export default async function handler(req: any, res: any) {
  if (!initPromise) {
    initPromise = initialize();
  }

  await initPromise;
  return app(req, res);
}
