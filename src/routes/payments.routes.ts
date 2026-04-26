import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { Payment } from '../models/Payment';
import { User } from '../models/User';

const paymentsRouter = Router();

paymentsRouter.use(requireAuth);

function parseIsoDateParts(dateValue: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

paymentsRouter.get('/', async (req, res) => {
  const parsed = z
    .object({
      year: z.coerce.number().int().min(2026).optional(),
      memberId: z.string().min(1).optional(),
      month: z.coerce.number().int().min(1).max(12).optional(),
      status: z.enum(['on_time', 'late']).optional(),
      minAmount: z.coerce.number().min(0).optional(),
      maxAmount: z.coerce.number().min(0).optional(),
      paidFrom: z.string().optional(),
      paidTo: z.string().optional(),
      q: z.string().trim().min(1).max(80).optional(),
      sortBy: z
        .enum(['paidAt', 'amount', 'month', 'penaltyAmount', 'status'])
        .optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
    })
    .safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.flatten() });
  }

  const {
    year,
    memberId,
    month,
    status,
    minAmount,
    maxAmount,
    paidFrom,
    paidTo,
    q,
    sortBy,
    sortOrder,
  } = parsed.data;

  if (minAmount !== undefined && maxAmount !== undefined && minAmount > maxAmount) {
    return res.status(400).json({ message: 'minAmount cannot be greater than maxAmount' });
  }

  const filter: Record<string, any> = {};

  if (year !== undefined) {
    filter.year = year;
  }

  if (memberId) {
    filter.user = memberId;
  }

  if (month !== undefined) {
    filter.month = month;
  }

  if (status) {
    filter.status = status;
  }

  if (minAmount !== undefined || maxAmount !== undefined) {
    filter.amount = {};
    if (minAmount !== undefined) {
      filter.amount.$gte = minAmount;
    }
    if (maxAmount !== undefined) {
      filter.amount.$lte = maxAmount;
    }
  }

  if (paidFrom || paidTo) {
    const paidAtRange: Record<string, Date> = {};

    if (paidFrom) {
      const fromParts = parseIsoDateParts(paidFrom);
      if (!fromParts) {
        return res.status(400).json({ message: 'paidFrom must be a valid date (YYYY-MM-DD)' });
      }
      paidAtRange.$gte = new Date(Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day));
    }

    if (paidTo) {
      const toParts = parseIsoDateParts(paidTo);
      if (!toParts) {
        return res.status(400).json({ message: 'paidTo must be a valid date (YYYY-MM-DD)' });
      }
      paidAtRange.$lte = new Date(Date.UTC(toParts.year, toParts.month - 1, toParts.day, 23, 59, 59, 999));
    }

    filter.paidAt = paidAtRange;
  }

  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(escaped, 'i');
    const users = await User.find({
      $or: [{ fullName: expression }, { username: expression }],
    }).select('_id');

    if (users.length === 0) {
      return res.json([]);
    }

    const userIds = users.map((user) => user._id);
    if (filter.user) {
      filter.user = { $in: userIds.filter((id) => String(id) === String(filter.user)) };
      if (filter.user.$in.length === 0) {
        return res.json([]);
      }
    } else {
      filter.user = { $in: userIds };
    }
  }

  const finalSortBy = sortBy ?? 'paidAt';
  const finalSortOrder = sortOrder === 'asc' ? 1 : -1;

  const payments = await Payment.find(filter)
    .populate('user', 'username fullName role slots active')
    .sort({ [finalSortBy]: finalSortOrder, _id: -1 });

  res.json(payments);
});

paymentsRouter.post('/', requireAdmin, async (req, res) => {
  const parsed = z
    .object({
      memberId: z.string().min(1).optional(),
      userId: z.string().min(1).optional(),
      slots: z.number().int().min(1),
      paidAt: z.string().min(1),
      month: z.number().int().min(1).max(12),
      year: z.number().int().min(2026),
    })
    .refine((data) => Boolean(data.userId || data.memberId), {
      message: 'userId is required',
      path: ['userId'],
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.flatten() });
  }

  const { slots, paidAt: paidAtRaw, month, year } = parsed.data;
  const userId = parsed.data.userId ?? parsed.data.memberId!;
  const user = await User.findById(userId);

  if (!user || !user.active) {
    return res.status(404).json({ message: 'Member not found' });
  }

  if (slots > user.slots) {
    return res.status(400).json({
      message: `Selected slots (${slots}) cannot exceed member slots (${user.slots})`,
    });
  }

  const amount = slots * env.monthlyContribution;

  const paidAtParts = parseIsoDateParts(paidAtRaw);
  if (!paidAtParts) {
    return res.status(400).json({ message: 'paidAt must be a valid date (YYYY-MM-DD)' });
  }

  const paidAt = new Date(Date.UTC(paidAtParts.year, paidAtParts.month - 1, paidAtParts.day));

  // Rule: payment becomes late after the 7th day of the next month.
  const dueDate = new Date(year, month, 7, 23, 59, 59, 999);
  const paidAtDayUtc = Date.UTC(paidAtParts.year, paidAtParts.month - 1, paidAtParts.day);
  const lateStartDayUtc = Date.UTC(year, month, 8);
  const isLate = paidAtDayUtc >= lateStartDayUtc;
  const penaltyAmount = isLate ? env.latePaymentPenalty : 0;

  try {
    const payment = await Payment.create({
      user: user._id,
      slots,
      amount,
      paidAt,
      dueDate,
      month,
      year,
      status: isLate ? 'late' : 'on_time',
      penaltyAmount,
    });

    return res.status(201).json(payment);
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({
        message: 'A payment already exists for this member and month.',
      });
    }

    return res.status(500).json({
      message: 'Failed to save payment.',
    });
  }
});

export { paymentsRouter };
