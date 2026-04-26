import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IExpense extends Document {
  title: string;
  category: 'operations' | 'bank' | 'logistics' | 'welfare' | 'loan' | 'other';
  entryType: 'expense' | 'recovery';
  amount: number;
  incurredAt: Date;
  notes?: string;
  createdBy?: Types.ObjectId;
}

const expenseSchema = new Schema<IExpense>(
  {
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    category: {
      type: String,
      enum: ['operations', 'bank', 'logistics', 'welfare', 'loan', 'other'],
      default: 'other',
      required: true,
    },
    entryType: {
      type: String,
      enum: ['expense', 'recovery'],
      default: 'expense',
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    incurredAt: { type: Date, required: true },
    notes: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

expenseSchema.index({ incurredAt: -1 });

export const Expense = mongoose.model<IExpense>('Expense', expenseSchema);
