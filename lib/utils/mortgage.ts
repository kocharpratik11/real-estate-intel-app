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
