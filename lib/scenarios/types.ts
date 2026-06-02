// Scenario types — mirrors web's src/lib/scenarios/types.ts

export type ScenarioId = 'hold' | 'cash_out_refi' | 'sell' | 'buy_another';

export interface PropertySnapshot {
  id: string;
  name: string;
  acquisitionPrice: number;
  acquisitionDate: string | null;
  marketValue: number;
  outstandingDebt: number;
  equity: number;
  annualRent: number;
  annualOperatingExpenses: number;
  noi: number;
  monthlyDebtService: number;
  currentROE: number | null;
  monthlyCashFlow: number;
  portfolioAvgROE: number;
  totalPortfolioEquity: number;
}

// ─── Hold ──────────────────────────────────────────────────────────────────

export interface HoldInputs {
  appreciationRate: number;   // annual decimal e.g. 0.03
  rentGrowthRate:   number;   // annual decimal e.g. 0.02
  horizon:          1 | 5 | 10;
}

export interface HoldResult {
  scenarioId:        'hold';
  horizon:           number;
  currentROE:        number | null;
  currentCashFlow:   number;
  projectedEquity:   number;
  projectedCashFlow: number;
  projectedROE:      number | null;
  appreciationGain:  number;
}

// ─── Cash-Out Refi ────────────────────────────────────────────────────────

export interface CashOutRefiInputs {
  ltv:          number;   // decimal e.g. 0.75
  newRate:      number;   // annual decimal e.g. 0.0725
  newTermYears: number;   // e.g. 30
}

export interface CashOutRefiResult {
  scenarioId:        'cash_out_refi';
  cashExtracted:     number;
  newLoanAmount:     number;
  newMonthlyPayment: number;
  paymentDelta:      number;
  newEquity:         number;
  newROE:            number | null;
  newMonthlyCashFlow: number;
  breakevenMonths:   number | null;
  feasible:          boolean;
}

// ─── Sell ─────────────────────────────────────────────────────────────────

export interface SellInputs {
  salePrice:            number;
  closingCostPct:       number;   // e.g. 0.07
  capitalGainsRatePct:  number;   // e.g. 0.15
}

export interface SellResult {
  scenarioId:             'sell';
  grossProceeds:          number;
  closingCosts:           number;
  loanPayoff:             number;
  netProceedsBeforeTax:   number;
  estimatedCapGainsTax:   number;
  netAfterTax:            number;
  holdingPeriodYears:     number | null;
}

// ─── Buy Another ──────────────────────────────────────────────────────────

export interface BuyAnotherInputs {
  purchasePrice:   number;
  capRate:         number;   // decimal e.g. 0.055
  downPaymentPct:  number;   // decimal e.g. 0.25
  loanRate:        number;   // decimal e.g. 0.0725
  loanTermYears:   number;   // e.g. 30
}

export interface BuyAnotherResult {
  scenarioId:        'buy_another';
  downPayment:       number;
  loanAmount:        number;
  newNOI:            number;
  newMonthlyPayment: number;
  newMonthlyCashFlow: number;
  newROE:            number | null;
  portfolioROEAfter: number | null;
  portfolioROEDelta: number | null;
}

export type ScenarioResult =
  | HoldResult
  | CashOutRefiResult
  | SellResult
  | BuyAnotherResult;
