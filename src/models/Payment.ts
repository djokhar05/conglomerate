import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type PaymentStatus = 'on_time' | 'late';

export interface IPayment extends Document {
  user: Types.ObjectId;
  slots: number;
  amount: number;
  paidAt: Date;
  month: number;
  year: number;
  dueDate: Date;
  status: PaymentStatus;
  penaltyAmount: number;
}

const paymentSchema = new Schema<IPayment>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    slots: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ['on_time', 'late'], required: true },
    penaltyAmount: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);

paymentSchema.index({ user: 1, month: 1, year: 1 }, { unique: true });

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
