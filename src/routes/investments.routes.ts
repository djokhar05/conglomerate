import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { Investment } from '../models/Investment';

const investmentsRouter = Router();

investmentsRouter.use(requireAuth);

investmentsRouter.get('/', async (_req, res) => {
  const investments = await Investment.find().sort({ investedAt: -1 });
  res.json(investments);
});

investmentsRouter.post('/', requireAdmin, async (req, res) => {
  const parsed = z
    .object({
      title: z.string().min(2).max(100),
      amountInvested: z.number().min(0),
      currentValue: z.number().min(0),
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
      currentValue: z.number().min(0).optional(),
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

export { investmentsRouter };
