import mongoose from 'mongoose';
import { connectDatabase } from '../config/db';
import { env, validateEnv } from '../config/env';
import { Payment, type PaymentStatus } from '../models/Payment';

const TARGET_MONTHS = [1, 2, 3];

function buildPaidAtUtc(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 27));
}

function buildDueDateLocal(year: number, month: number) {
  return new Date(year, month, 7, 23, 59, 59, 999);
}

function isLateByRule(year: number, month: number, day: number) {
  const paidAtDayUtc = Date.UTC(year, month - 1, day);
  const lateStartDayUtc = Date.UTC(year, month, 8);
  return paidAtDayUtc >= lateStartDayUtc;
}

async function normalizeQ1PaymentDates() {
  validateEnv();
  await connectDatabase();

  const payments = await Payment.find({ month: { $in: TARGET_MONTHS } }).select(
    '_id year month paidAt dueDate status penaltyAmount',
  );

  if (payments.length === 0) {
    console.log('No January-February-March payments found.');
    return;
  }

  const operations = payments.map((payment) => {
    const paidAt = buildPaidAtUtc(payment.year, payment.month);
    const dueDate = buildDueDateLocal(payment.year, payment.month);
    const isLate = isLateByRule(payment.year, payment.month, 27);
    const status: PaymentStatus = isLate ? 'late' : 'on_time';

    return {
      updateOne: {
        filter: { _id: payment._id },
        update: {
          $set: {
            paidAt,
            dueDate,
            status,
            penaltyAmount: isLate ? env.latePaymentPenalty : 0,
          },
        },
      },
    };
  });

  const result = await Payment.bulkWrite(operations);

  console.log(`Found: ${payments.length} payment(s)`);
  console.log(`Updated: ${result.modifiedCount} payment(s)`);
}

normalizeQ1PaymentDates()
  .catch((error) => {
    console.error('Normalization failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
