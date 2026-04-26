import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { User } from '../models/User';

const membersRouter = Router();

membersRouter.use(requireAuth);

membersRouter.get('/', async (_req, res) => {
  const members = await User.find().select('-passwordHash').sort({ createdAt: 1 });
  res.json(members);
});

membersRouter.post('/', requireAdmin, async (req, res) => {
  const parsed = z
    .object({
      username: z.string().min(3).max(30),
      fullName: z.string().min(2).max(150),
      role: z.enum(['admin', 'member']).default('member'),
      slots: z.number().int().min(1).max(10).default(1),
      active: z.boolean().optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.flatten() });
  }

  const { username, fullName, role, slots, active } = parsed.data;

  const existingUser = await User.findOne({ username: username.toLowerCase() });
  if (existingUser) {
    return res.status(409).json({ message: 'Username already exists' });
  }

  const temporaryPassword = randomBytes(12).toString('base64url');
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const createdUser = await User.create({
    username,
    fullName,
    role,
    slots,
    active: active ?? true,
    passwordHash,
  });

  const user = await User.findById(createdUser._id).select('-passwordHash');

  return res.status(201).json({
    member: user,
    credentials: {
      username: createdUser.username,
      temporaryPassword,
      role: createdUser.role,
    },
  });
});

membersRouter.patch('/:id', requireAdmin, async (req, res) => {
  const parsed = z
    .object({
      username: z.string().min(3).max(30).optional(),
      fullName: z.string().min(2).max(150).optional(),
      role: z.enum(['admin', 'member']).optional(),
      slots: z.number().int().min(1).max(10).optional(),
      active: z.boolean().optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.flatten() });
  }

  if (parsed.data.username) {
    const duplicate = await User.findOne({ username: parsed.data.username.toLowerCase() });
    if (duplicate && String(duplicate._id) !== req.params.id) {
      return res.status(409).json({ message: 'Username already exists' });
    }
  }

  const member = await User.findByIdAndUpdate(req.params.id, parsed.data, {
    new: true,
    runValidators: true,
  }).select('-passwordHash');
  if (!member) {
    return res.status(404).json({ message: 'Member not found' });
  }

  return res.json(member);
});

membersRouter.post('/:id/reset-password', requireAdmin, async (req, res) => {
  const member = await User.findById(req.params.id);
  if (!member) {
    return res.status(404).json({ message: 'Member not found' });
  }

  const temporaryPassword = randomBytes(12).toString('base64url');
  member.passwordHash = await bcrypt.hash(temporaryPassword, 10);
  await member.save();

  return res.json({
    member: {
      id: member._id,
      username: member.username,
      fullName: member.fullName,
    },
    credentials: {
      username: member.username,
      temporaryPassword,
    },
  });
});

export { membersRouter };
