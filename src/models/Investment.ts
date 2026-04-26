import mongoose, { Schema, type Document } from 'mongoose';

export interface IInvestment extends Document {
  title: string;
  amountInvested: number;
  currentValue: number;
  investedAt: Date;
  notes?: string;
}

const investmentSchema = new Schema<IInvestment>(
  {
    title: { type: String, required: true, trim: true },
    amountInvested: { type: Number, required: true, min: 0 },
    currentValue: { type: Number, required: true, min: 0 },
    investedAt: { type: Date, required: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

export const Investment = mongoose.model<IInvestment>('Investment', investmentSchema);
