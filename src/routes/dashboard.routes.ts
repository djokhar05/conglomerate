import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { Expense } from '../models/Expense';
import { Investment } from '../models/Investment';
import { Payment } from '../models/Payment';
import { User } from '../models/User';

const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get('/summary', async (req, res) => {
  const year = Number(req.query.year ?? new Date().getFullYear());
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const [payments, members, investments, expenses] = await Promise.all([
    Payment.find({ year }),
    User.find({ active: { $ne: false } }).select('fullName slots'),
    Investment.find(),
    Expense.find({ incurredAt: { $gte: start, $lt: end } }),
  ]);

  const totalContributions = payments.reduce((sum, item) => sum + item.amount, 0);
  const totalPenalties = payments.reduce((sum, item) => sum + item.penaltyAmount, 0);
  const totalInvested = investments.reduce((sum, item) => sum + item.amountInvested, 0);
  const currentInvestmentValue = investments.reduce((sum, item) => sum + item.currentValue, 0);
  const investmentProfit = currentInvestmentValue - totalInvested;
  const totalExpenses = expenses
    .filter((item) => item.entryType !== 'recovery')
    .reduce((sum, item) => sum + item.amount, 0);
  const totalRecoveries = expenses
    .filter((item) => item.entryType === 'recovery')
    .reduce((sum, item) => sum + item.amount, 0);
  const netExpenses = totalExpenses - totalRecoveries;

  const membersWithSlots = members.map((member) => ({
    member,
    slots: typeof member.slots === 'number' && member.slots > 0 ? member.slots : 1,
  }));

  const totalSlots = membersWithSlots.reduce((sum, item) => sum + item.slots, 0) || 1;
  const contributionsByMember = new Map<string, number>();

  for (const payment of payments) {
    const memberId = String(payment.user);
    const current = contributionsByMember.get(memberId) ?? 0;
    contributionsByMember.set(memberId, current + payment.amount);
  }

  const proportionalDistribution = membersWithSlots.map(({ member, slots }) => {
    const ratio = slots / totalSlots;
    return {
      memberId: member._id,
      fullName: member.fullName,
      slots,
      principal: contributionsByMember.get(String(member._id)) ?? 0,
      ratio,
      projectedProfitShare: Number((investmentProfit * ratio).toFixed(2)),
    };
  });

  return res.json({
    year,
    metrics: {
      totalContributions,
      totalPenalties,
      totalExpenses,
      totalRecoveries,
      netExpenses,
      totalInvested,
      currentInvestmentValue,
      investmentProfit,
      overallPoolValue: totalContributions + totalPenalties + investmentProfit - netExpenses,
    },
    proportionalDistribution,
  });
});

export { dashboardRouter };
