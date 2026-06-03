import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { Investment } from '../models/Investment';
import { InvestmentReturn } from '../models/InvestmentReturn';

const investmentsRouter = Router();

investmentsRouter.use(requireAuth);

// ── Investments ───────────────────────────────────────────────

investmentsRouter.get('/', async (_req, res) => {
  const investments = await Investment.find().sort({ investedAt: -1 });
  res.json(investments);
});

investmentsRouter.post('/', requireAdmin, async (req, res) => {
  const parsed = z
    .object({
      title: z.string().min(2).max(100),
      amountInvested: z.number().min(0),
      roi: z.number().optional(),
      investedAt: z.coerce.date(),
      notes: z.string().max(500).optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.flatten() });
  }

  const investment = await Investment.create(parsed.data);
  return res.status(201).json(investment);
});

investmentsRouter.patch('/:id', requireAdmin, async (req, res) => {
  const parsed = z
    .object({
      title: z.string().min(2).max(100).optional(),
      amountInvested: z.number().min(0).optional(),
      roi: z.number().optional(),
      investedAt: z.coerce.date().optional(),
      notes: z.string().max(500).optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.flatten() });
  }

  const investment = await Investment.findByIdAndUpdate(req.params.id, parsed.data, { new: true });
  if (!investment) {
    return res.status(404).json({ message: 'Investment not found' });
  }

  return res.json(investment);
});

investmentsRouter.delete('/:id', requireAdmin, async (req, res) => {
  const investment = await Investment.findByIdAndDelete(req.params.id);
  if (!investment) {
    return res.status(404).json({ message: 'Investment not found' });
  }
  return res.json({ message: 'Deleted' });
});

// ── Investment Returns (monthly profit / loss) ────────────────

investmentsRouter.get('/returns', async (_req, res) => {
  const returns = await InvestmentReturn.find()
    .sort({ year: -1, month: -1 })
    .populate('createdBy', 'fullName')
    .populate('investmentId', 'title');
  res.json(returns);
});

investmentsRouter.post('/returns', requireAdmin, async (req, res) => {
  const parsed = z
    .object({
      investmentId: z.string().min(1),
      month: z.number().int().min(1).max(12),
      year: z.number().int().min(2024),
      type: z.enum(['profit', 'loss']),
      amount: z.number().min(0),
      note: z.string().max(500).optional(),
      recordedAt: z.coerce.date(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.flatten() });
  }

  const { investmentId, month, year, type, amount, note, recordedAt } = parsed.data;

  // upsert — one entry per investment per month/year
  const result = await InvestmentReturn.findOneAndUpdate(
    { investmentId, month, year },
    { type, amount, note, recordedAt, createdBy: req.user!._id },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return res.status(201).json(result);
});

investmentsRouter.delete('/returns/:id', requireAdmin, async (req, res) => {
  const result = await InvestmentReturn.findByIdAndDelete(req.params.id);
  if (!result) {
    return res.status(404).json({ message: 'Return entry not found' });
  }
  return res.json({ message: 'Deleted' });
});

export { investmentsRouter };
