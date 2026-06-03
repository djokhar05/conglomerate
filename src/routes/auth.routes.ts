import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { requireAuth } from '../middleware/auth';
import { User } from '../models/User';

const authRouter = Router();

const registerSchema = z.object({
  username: z.string().min(3).max(30),
  fullName: z.string().min(2).max(120),
  password: z.string().min(8).max(128),
});

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.flatten() });
  }

  const { username, fullName, password } = parsed.data;
  const exists = await User.findOne({ username: username.toLowerCase() });
  if (exists) {
    return res.status(409).json({ message: 'Username already exists' });
  }

  const userCount = await User.countDocuments();
  const role = userCount === 0 ? 'admin' : 'member';
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({ username, fullName, role, slots: 1, active: true, passwordHash });
  return res.status(201).json({ id: user._id, username: user.username, role: user.role });
});

const loginSchema = z.object({
  username: z.string().min(3).max(30),
  password: z.string().min(8).max(128),
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.flatten() });
  }

  const { username, password } = parsed.data;
  const user = await User.findOne({ username: username.toLowerCase() });
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const isValid = await user.comparePassword(password);
  if (!isValid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user._id }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  });

  return res.json({
    token,
    user: {
      id: user._id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      slots: user.slots,
      active: user.active,
    },
  });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = req.user!;
  return res.json({
    id: user._id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    slots: user.slots,
    active: user.active,
  });
});

const updateUsernameSchema = z.object({
  newUsername: z.string().min(3).max(30),
  currentPassword: z.string().min(8).max(128),
});

authRouter.patch('/me/username', requireAuth, async (req, res) => {
  const parsed = updateUsernameSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.flatten() });
  }

  const user = req.user!;
  const { newUsername, currentPassword } = parsed.data;
  const normalizedUsername = newUsername.toLowerCase();

  const isValid = await user.comparePassword(currentPassword);
  if (!isValid) {
    return res.status(401).json({ message: 'Current password is incorrect' });
  }

  const existingUser = await User.findOne({ username: normalizedUsername });
  if (existingUser && String(existingUser._id) !== String(user._id)) {
    return res.status(409).json({ message: 'Username already exists' });
  }

  user.username = normalizedUsername;
  await user.save();

  return res.json({
    id: user._id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    slots: user.slots,
    active: user.active,
  });
});

const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(8).max(128),
    newPassword: z.string().min(8).max(128),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

authRouter.patch('/me/password', requireAuth, async (req, res) => {
  const parsed = updatePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.flatten() });
  }

  const user = req.user!;
  const { currentPassword, newPassword } = parsed.data;

  const isValid = await user.comparePassword(currentPassword);
  if (!isValid) {
    return res.status(401).json({ message: 'Current password is incorrect' });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  return res.json({ message: 'Password updated successfully' });
});

const resetAdminSchema = z.object({
  username: z.string().min(3).max(30),
  resetKey: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

authRouter.post('/reset-admin', async (req, res) => {
  const parsed = resetAdminSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.flatten() });
  }

  const { username, resetKey, newPassword } = parsed.data;

  if (!env.adminCreationKey || resetKey !== env.adminCreationKey) {
    return res.status(403).json({ message: 'Invalid reset key' });
  }

  const admin = await User.findOne({ username: username.toLowerCase(), role: 'admin' });
  if (!admin) {
    return res.status(404).json({ message: 'No admin user found with that username' });
  }

  admin.passwordHash = await bcrypt.hash(newPassword, 10);
  await admin.save();

  return res.json({ message: 'Admin password reset successfully' });
});

export { authRouter };
