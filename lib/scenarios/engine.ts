// Scenario engine — mirrors web's src/lib/scenarios/engine.ts (pure math, no deps)
import type {
  PropertySnapshot,
  HoldInputs,     HoldResult,
  CashOutRefiInputs, CashOutRefiResult,
  SellInputs,     SellResult,
  BuyAnotherInputs, BuyAnotherResult,
} from './types';

function monthlyPayment(principal: number, annualRate: number, termYears: number): number {
  if (principal <= 0) return 0;
  const r = annualRate / 12;
  const n = termYears * 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function computeHold(p: PropertySnapshot, inputs: HoldInputs): HoldResult {
  const { horizon, appreciationRate, rentGrowthRate } = inputs;
  const projectedValue  = p.marketValue * Math.pow(1 + appreciationRate, horizon);
  const projectedEquity = Math.max(0, projectedValue - p.outstandingDebt);
  const appreciationGain = projectedEquity - p.equity;
  const projectedAnnualRent = p.annualRent * Math.pow(1 + rentGrowthRate, horizon);
  const projectedNOI = projectedAnnualRent - p.annualOperatingExpenses;
  const projectedAnnualDebt = p.monthlyDebtService * 12;
  const projectedCashFlow = Math.round((projectedNOI - projectedAnnualDebt) / 12);
  const projectedROE = projectedEquity > 0
    ? Math.round(((projectedNOI - projectedAnnualDebt) / projectedEquity) * 1000) / 10
    : null;
  return {
    scenarioId: 'hold',
    horizon,
    currentROE:       p.currentROE,
    currentCashFlow:  p.monthlyCashFlow,
    projectedEquity:  Math.round(projectedEquity),
    projectedCashFlow,
    projectedROE,
    appreciationGain: Math.round(appreciationGain),
  };
}

export function computeCashOutRefi(p: PropertySnapshot, inputs: CashOutRefiInputs): CashOutRefiResult {
  const { ltv, newRate, newTermYears } = inputs;
  const newLoan       = Math.round(p.marketValue * ltv);
  const cashExtracted = Math.max(0, newLoan - p.outstandingDebt);
  const feasible      = cashExtracted > 0;
  const newPmt        = monthlyPayment(newLoan, newRate, newTermYears);
  const paymentDelta  = newPmt - p.monthlyDebtService;
  const newEquity     = Math.max(0, p.marketValue - newLoan);
  const newAnnualDebt = newPmt * 12;
  const newMonthlyCashFlow = Math.round((p.noi - newAnnualDebt) / 12);
  const newROE = newEquity > 0
    ? Math.round(((p.noi - newAnnualDebt) / newEquity) * 1000) / 10
    : null;
  const annualReturnOnCash   = cashExtracted * 0.06;
  const annualPaymentIncrease = Math.max(0, paymentDelta * 12);
  const breakevenMonths =
    annualPaymentIncrease > 0 && annualReturnOnCash > annualPaymentIncrease
      ? null
      : annualPaymentIncrease > 0
      ? Math.round((cashExtracted / (annualReturnOnCash - annualPaymentIncrease)) * 12)
      : null;
  return {
    scenarioId: 'cash_out_refi',
    cashExtracted:      Math.round(cashExtracted),
    newLoanAmount:      newLoan,
    newMonthlyPayment:  Math.round(newPmt),
    paymentDelta:       Math.round(paymentDelta),
    newEquity:          Math.round(newEquity),
    newROE,
    newMonthlyCashFlow,
    breakevenMonths:    breakevenMonths && breakevenMonths > 0 && breakevenMonths < 600 ? breakevenMonths : null,
    feasible,
  };
}

export function computeSell(p: PropertySnapshot, inputs: SellInputs): SellResult {
  const { salePrice, closingCostPct, capitalGainsRatePct } = inputs;
  const closingCosts          = Math.round(salePrice * closingCostPct);
  const loanPayoff            = Math.round(p.outstandingDebt);
  const netProceedsBeforeTax  = Math.round(salePrice - closingCosts - loanPayoff);
  const gain                  = Math.max(0, salePrice - (p.acquisitionPrice || salePrice));
  const estimatedCapGainsTax  = Math.round(gain * capitalGainsRatePct);
  const netAfterTax           = Math.round(netProceedsBeforeTax - estimatedCapGainsTax);
  let holdingPeriodYears: number | null = null;
  if (p.acquisitionDate) {
    const ms = Date.now() - new Date(p.acquisitionDate).getTime();
    holdingPeriodYears = Math.round((ms / (1000 * 60 * 60 * 24 * 365)) * 10) / 10;
  }
  return {
    scenarioId: 'sell',
    grossProceeds:         salePrice,
    closingCosts,
    loanPayoff,
    netProceedsBeforeTax,
    estimatedCapGainsTax,
    netAfterTax,
    holdingPeriodYears,
  };
}

export function computeBuyAnother(p: PropertySnapshot, inputs: BuyAnotherInputs): BuyAnotherResult {
  const { purchasePrice, capRate, downPaymentPct, loanRate, loanTermYears } = inputs;
  const downPayment  = Math.round(purchasePrice * downPaymentPct);
  const loanAmount   = purchasePrice - downPayment;
  const newNOI       = Math.round(purchasePrice * capRate);
  const newPmt       = monthlyPayment(loanAmount, loanRate, loanTermYears);
  const newMonthlyCashFlow = Math.round(newNOI / 12 - newPmt);
  const newROE = downPayment > 0
    ? Math.round(((newNOI - newPmt * 12) / downPayment) * 1000) / 10
    : null;
  const currentROEDecimal = p.currentROE != null ? p.currentROE / 100 : null;
  const newROEDecimal     = newROE != null ? newROE / 100 : null;
  let portfolioROEAfter: number | null = null;
  let portfolioROEDelta: number | null = null;
  if (currentROEDecimal != null && newROEDecimal != null && p.totalPortfolioEquity > 0) {
    const blended =
      (currentROEDecimal * p.totalPortfolioEquity + newROEDecimal * downPayment) /
      (p.totalPortfolioEquity + downPayment);
    portfolioROEAfter = Math.round(blended * 1000) / 10;
    portfolioROEDelta = Math.round((portfolioROEAfter - p.portfolioAvgROE) * 10) / 10;
  }
  return {
    scenarioId: 'buy_another',
    downPayment,
    loanAmount:          Math.round(loanAmount),
    newNOI,
    newMonthlyPayment:   Math.round(newPmt),
    newMonthlyCashFlow,
    newROE,
    portfolioROEAfter,
    portfolioROEDelta,
  };
}
