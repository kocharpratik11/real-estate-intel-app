import { buildSnapshots } from './scenarios';
import { computeHold, computeCashOutRefi, computeSell } from '@/lib/scenarios/engine';

const MARKET_BENCHMARKS = {
  mortgageRate30yr: 0.0725,
  appreciationRate: 0.03,
};

export type OptimizationRecommendation = {
  propertyId:            string;
  propertyName:          string;
  currentROE:            number | null;
  currentMonthlyCashFlow: number;
  equity:                number;
  marketValue:           number;
  bestAction:            'hold' | 'refi' | 'sell' | 'none';
  bestActionLabel:       string;
  annualBenefit:         number;
  insight:               string;
};

export async function runOptimizer(workspaceId: string): Promise<{
  recommendations: OptimizationRecommendation[];
  portfolioROE: number;
}> {
  const snapshots = await buildSnapshots(workspaceId);
  if (snapshots.length === 0) return { recommendations: [], portfolioROE: 0 };

  const portfolioAvgROE = snapshots[0].portfolioAvgROE;

  const recommendations: OptimizationRecommendation[] = snapshots.map(snap => {
    // Hold 5yr
    const hold = computeHold(snap, {
      horizon:          5,
      appreciationRate: MARKET_BENCHMARKS.appreciationRate,
      rentGrowthRate:   0.02,
    });
    const holdAnnualBenefit = hold.projectedCashFlow - snap.monthlyCashFlow > 0
      ? (hold.projectedCashFlow - snap.monthlyCashFlow) * 12
      : 0;

    // Refi at 75% LTV
    const refi = computeCashOutRefi(snap, {
      ltv:          0.75,
      newRate:      MARKET_BENCHMARKS.mortgageRate30yr,
      newTermYears: 30,
    });
    const refiAnnualBenefit = refi.feasible && refi.cashExtracted > 0
      ? refi.cashExtracted * (portfolioAvgROE / 100) - refi.paymentDelta * 12
      : -Infinity;

    // Sell at market value
    const sell = computeSell(snap, {
      salePrice:           snap.marketValue,
      closingCostPct:      0.07,
      capitalGainsRatePct: 0.15,
    });
    const currentAnnualCF = snap.monthlyCashFlow * 12;
    const sellAnnualBenefit = sell.netAfterTax > 0
      ? sell.netAfterTax * (portfolioAvgROE / 100) - currentAnnualCF
      : -Infinity;

    const scores: Record<string, number> = {
      hold: holdAnnualBenefit,
      refi: refiAnnualBenefit === -Infinity ? -Infinity : refiAnnualBenefit,
      sell: sellAnnualBenefit === -Infinity ? -Infinity : sellAnnualBenefit,
    };
    const best = (Object.entries(scores) as [string, number][]).reduce(
      (a, b) => (b[1] > a[1] ? b : a)
    );

    const bestAction = best[1] > 500 ? (best[0] as 'hold' | 'refi' | 'sell') : 'none';
    const annualBenefit = best[1] > 500 ? Math.round(best[1]) : 0;

    const labels: Record<string, string> = {
      hold: 'Continue Holding',
      refi: 'Cash-Out Refinance',
      sell: 'Sell & Redeploy',
      none: 'Review Needed',
    };

    const insightMap: Record<string, string> = {
      hold: `+$${Math.round((hold.projectedCashFlow - snap.monthlyCashFlow) * 12).toLocaleString()}/yr cash flow growth projected over 5 years.`,
      refi: `Extract ~$${refi.cashExtracted.toLocaleString()} equity. Redeploy at ${portfolioAvgROE}% portfolio ROE.`,
      sell: `Net $${sell.netAfterTax.toLocaleString()} after tax. Reinvesting at portfolio avg outpaces current cash flow.`,
      none: `ROE of ${snap.currentROE ?? 0}% is near portfolio average. No high-impact action identified.`,
    };

    return {
      propertyId:            snap.id,
      propertyName:          snap.name,
      currentROE:            snap.currentROE,
      currentMonthlyCashFlow: snap.monthlyCashFlow,
      equity:                snap.equity,
      marketValue:           snap.marketValue,
      bestAction,
      bestActionLabel:       labels[bestAction],
      annualBenefit,
      insight:               insightMap[bestAction],
    };
  });

  recommendations.sort((a, b) => b.annualBenefit - a.annualBenefit);

  return { recommendations, portfolioROE: portfolioAvgROE };
}
