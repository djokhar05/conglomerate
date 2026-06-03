import mongoose, { Schema, type Document } from 'mongoose';

export interface IInvestmentReturn extends Document {
  investmentId: mongoose.Types.ObjectId;
  month: number;
  year: number;
  type: 'profit' | 'loss';
  amount: number;
  note?: string;
  recordedAt: Date;
  createdBy: mongoose.Types.ObjectId;
}

const investmentReturnSchema = new Schema<IInvestmentReturn>(
  {
    investmentId: { type: Schema.Types.ObjectId, ref: 'Investment', required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    type: { type: String, enum: ['profit', 'loss'], required: true },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true },
    recordedAt: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// one entry per investment per month/year
investmentReturnSchema.index({ investmentId: 1, month: 1, year: 1 }, { unique: true });

export const InvestmentReturn = mongoose.model<IInvestmentReturn>('InvestmentReturn', investmentReturnSchema);
