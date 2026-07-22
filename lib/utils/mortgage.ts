// Remaining mortgage balance from loan terms, matching the web app's formula:
// B_n = P·(1+r)^n − PMT·[(1+r)^n − 1] / r
// where P = original principal, r = monthly rate, n = months elapsed since origination.
export function computeMortgageBalance(
  principal: number,
  annualRatePct: number,
  monthlyPayment: number,
  originationDate: string,
  opts?: { isInterestOnly?: boolean; loanTermMonths?: number | null },
): number {
  if (opts?.isInterestOnly) return principal;

  const start = new Date(originationDate);
  if (isNaN(start.getTime())) return principal;

  const now = new Date();
  let n = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  n = Math.max(n, 0);
  if (opts?.loanTermMonths != null) n = Math.min(n, opts.loanTermMonths);

  const r = annualRatePct / 100 / 12;
  if (r === 0) return Math.max(principal - monthlyPayment * n, 0);

  const growth  = Math.pow(1 + r, n);
  const balance = principal * growth - (monthlyPayment * (growth - 1)) / r;
  return Math.max(balance, 0);
}

// Number of P&I payments made as of today, for a payoff-timeline estimate.
// Standard US mortgage convention: the first regular payment is due on the
// 1st of the second calendar month after origination (closing-month interest
// is prepaid at closing).
export function calcPaymentsMade(originationDate: string, termMonths: number): number {
  const [oy, om] = originationDate.split('-').map(Number); // om is 1-indexed
  const firstPayment = new Date(oy, om + 1, 1); // 0-indexed: (om-1)+2
  const today = new Date();
  if (today < firstPayment) return 0;
  const n = (today.getFullYear() - firstPayment.getFullYear()) * 12
    + (today.getMonth()   - firstPayment.getMonth()) + 1;
  return Math.min(n, termMonths);
}
