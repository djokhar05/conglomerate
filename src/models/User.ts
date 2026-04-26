import bcrypt from 'bcryptjs';
import mongoose, { Schema, type Document } from 'mongoose';

export interface IUser extends Document {
  username: string;
  fullName: string;
  role: 'admin' | 'member';
  slots: number;
  active: boolean;
  passwordHash: string;
  comparePassword(password: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    fullName: { type: String, required: true, trim: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    slots: { type: Number, required: true, min: 1, default: 1 },
    active: { type: Boolean, default: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

userSchema.methods.comparePassword = function comparePassword(password: string) {
  return bcrypt.compare(password, this.passwordHash);
};

export const User = mongoose.model<IUser>('User', userSchema);
