import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { Expense } from '../models/Expense';

const expensesRouter = Router();

expensesRouter.use(requireAuth);

expensesRouter.get('/', async (req, res) => {
  const year = Number(req.query.year ?? new Date().getFullYear());
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const expenses = await Expense.find({
    incurredAt: { $gte: start, $lt: end },
  })
    .populate('createdBy', 'fullName username')
    .sort({ incurredAt: -1 });

  return res.json(expenses);
});

expensesRouter.post('/', requireAdmin, async (req, res) => {
  const parsed = z
    .object({
      title: z.string().min(2).max(120),
      category: z.enum(['operations', 'bank', 'logistics', 'welfare', 'loan', 'other']),
      entryType: z.enum(['expense', 'recovery']).default('expense'),
      amount: z.number().positive(),
      incurredAt: z.coerce.date(),
      notes: z.string().max(500).optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.flatten() });
  }

  const expense = await Expense.create({
    ...parsed.data,
    createdBy: req.user?._id,
  });

  return res.status(201).json(expense);
});

export { expensesRouter };
