import { supabase } from '@/lib/supabase';

export type MonthlyPL = {
  year:     number;
  month:    number;
  income:   number;   // rent collected
  expenses: number;   // logged expenses
  net:      number;   // income - expenses
};

export async function getPLSummary(propertyId: string, months = 6): Promise<MonthlyPL[]> {
  const now = new Date();
  const result: MonthlyPL[] = [];

  // Build month ranges going back `months` months
  const ranges: { year: number; month: number; from: string; to: string }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yr = d.getFullYear();
    const mo = d.getMonth() + 1;
    const from = `${yr}-${String(mo).padStart(2, '0')}-01`;
    const last  = new Date(yr, mo, 0).getDate();
    const to   = `${yr}-${String(mo).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    ranges.push({ year: yr, month: mo, from, to });
  }

  // Fetch all rent payments and expenses in one go
  const [{ data: payments }, { data: expenses }] = await Promise.all([
    supabase
      .from('rent_payments')
      .select('period_year, period_month, amount_paid')
      .eq('property_id', propertyId)
      .eq('charge_type', 'rent')
      .gte('period_year', ranges[0].year)
      .lte('period_year', ranges[ranges.length - 1].year),
    supabase
      .from('expenses')
      .select('expense_date, amount')
      .eq('property_id', propertyId)
      .gte('expense_date', ranges[0].from)
      .lte('expense_date', ranges[ranges.length - 1].to),
  ]);

  for (const { year, month, from, to } of ranges) {
    const income = (payments ?? [])
      .filter((p: any) => p.period_year === year && p.period_month === month)
      .reduce((s: number, p: any) => s + (p.amount_paid ?? 0), 0);

    const exp = (expenses ?? [])
      .filter((e: any) => e.expense_date >= from && e.expense_date <= to)
      .reduce((s: number, e: any) => s + (e.amount ?? 0), 0);

    result.push({ year, month, income, expenses: exp, net: income - exp });
  }

  return result;
}

export async function getPortfolioPLSummary(workspaceId: string, months = 6): Promise<MonthlyPL[]> {
  const now = new Date();
  const ranges: { year: number; month: number; from: string; to: string }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yr = d.getFullYear();
    const mo = d.getMonth() + 1;
    const from = `${yr}-${String(mo).padStart(2, '0')}-01`;
    const last  = new Date(yr, mo, 0).getDate();
    const to   = `${yr}-${String(mo).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    ranges.push({ year: yr, month: mo, from, to });
  }

  const [{ data: payments }, { data: expenses }] = await Promise.all([
    supabase
      .from('rent_payments')
      .select('period_year, period_month, amount_paid')
      .eq('workspace_id', workspaceId)
      .eq('charge_type', 'rent'),
    supabase
      .from('expenses')
      .select('expense_date, amount')
      .eq('workspace_id', workspaceId)
      .gte('expense_date', ranges[0].from)
      .lte('expense_date', ranges[ranges.length - 1].to),
  ]);

  return ranges.map(({ year, month, from, to }) => {
    const income = (payments ?? [])
      .filter((p: any) => p.period_year === year && p.period_month === month)
      .reduce((s: number, p: any) => s + (p.amount_paid ?? 0), 0);

    const exp = (expenses ?? [])
      .filter((e: any) => e.expense_date >= from && e.expense_date <= to)
      .reduce((s: number, e: any) => s + (e.amount ?? 0), 0);

    return { year, month, income, expenses: exp, net: income - exp };
  });
}
