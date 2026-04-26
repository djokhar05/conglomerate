import { app } from './app';
import { connectDatabase } from './config/db';
import { env, validateEnv } from './config/env';
import { Payment } from './models/Payment';

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

async function bootstrap() {
  validateEnv();
  await connectDatabase();
  await ensurePaymentIndexes();

  app.listen(env.port, () => {
    console.log(`API running on port ${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
