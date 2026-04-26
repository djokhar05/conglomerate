import mongoose from 'mongoose';
import { connectDatabase } from '../config/db';
import { env, validateEnv } from '../config/env';
import { Payment } from '../models/Payment';

async function backfillPaymentSlots() {
  validateEnv();

  if (env.monthlyContribution <= 0) {
    throw new Error('MONTHLY_CONTRIBUTION must be greater than 0');
  }

  await connectDatabase();

  const paymentsToFix = await Payment.find({
    $or: [
      { slots: { $exists: false } },
      { slots: null },
      { slots: { $lte: 0 } },
    ],
  }).select('_id amount slots');

  if (paymentsToFix.length === 0) {
    console.log('No payment records require slot backfill.');
    return;
  }

  const operations = paymentsToFix.map((payment) => {
    const derived = Math.max(1, Math.round(payment.amount / env.monthlyContribution));

    return {
      updateOne: {
        filter: { _id: payment._id },
        update: { $set: { slots: derived } },
      },
    };
  });

  const result = await Payment.bulkWrite(operations);

  console.log(`Checked: ${paymentsToFix.length} payment(s)`);
  console.log(`Updated: ${result.modifiedCount} payment(s)`);
}

backfillPaymentSlots()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
