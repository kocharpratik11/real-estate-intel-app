import { supabase } from '@/lib/supabase';
import type { PropertySnapshot } from '@/lib/scenarios/types';

/**
 * Build PropertySnapshot objects for all properties in a workspace.
 * Uses the pre-computed metric columns stored on the properties table
 * (populated by calculate_property_metrics trigger) to avoid heavy joins.
 */
export async function buildSnapshots(workspaceId: string): Promise<PropertySnapshot[]> {
  const { data: properties } = await supabase
    .from('properties')
    .select(`
      id, name, purchase_price, purchase_date,
      current_market_value, total_equity, monthly_debt_service,
      annual_noi, roe_percentage
    `)
    .eq('workspace_id', workspaceId);

  if (!properties || properties.length === 0) return [];

  const propIds = properties.map((p: any) => p.id as string);

  // Monthly rent from active leases (needed for annualRent)
  const { data: leaseRows } = await supabase
    .from('leases')
    .select('unit_id, monthly_rent, units!inner(property_id)')
    .eq('status', 'active')
    .in('units.property_id', propIds);

  // Annual expenses from last 12 months
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const { data: expenseRows } = await supabase
    .from('expenses')
    .select('property_id, amount')
    .in('property_id', propIds)
    .gte('expense_date', oneYearAgo.toISOString().slice(0, 10));

  // Build property → annualRent map
  const rentByProp = new Map<string, number>();
  for (const l of leaseRows ?? []) {
    const pid = (l.units as any)?.property_id as string | undefined;
    if (!pid) continue;
    rentByProp.set(pid, (rentByProp.get(pid) ?? 0) + (l.monthly_rent ?? 0) * 12);
  }

  // Build property → annualExpenses map
  const expByProp = new Map<string, number>();
  for (const e of expenseRows ?? []) {
    const pid = e.property_id as string;
    expByProp.set(pid, (expByProp.get(pid) ?? 0) + (e.amount ?? 0));
  }

  // Portfolio totals (for BuyAnother blended ROE)
  const totalPortfolioEquity = (properties as any[]).reduce(
    (s: number, p: any) => s + (p.total_equity ?? 0), 0
  );
  const weightedROESum = (properties as any[]).reduce((s: number, p: any) => {
    const eq = p.total_equity ?? 0;
    const cf = ((p.annual_noi ?? 0) - (p.monthly_debt_service ?? 0) * 12);
    const roe = eq > 0 ? cf / eq : 0;
    return s + roe * eq;
  }, 0);
  const portfolioAvgROE = totalPortfolioEquity > 0
    ? Math.round((weightedROESum / totalPortfolioEquity) * 1000) / 10
    : 0;

  return (properties as any[]).map((p: any) => {
    const marketValue      = p.current_market_value ?? 0;
    const equity           = p.total_equity ?? 0;
    const outstandingDebt  = Math.max(0, marketValue - equity);
    const monthlyDebt      = p.monthly_debt_service ?? 0;
    const noi              = p.annual_noi ?? 0;
    const annualRent       = rentByProp.get(p.id) ?? 0;
    const annualOpExp      = annualRent > 0 ? Math.max(0, annualRent - noi) : (expByProp.get(p.id) ?? 0);
    const monthlyCashFlow  = Math.round((noi - monthlyDebt * 12) / 12);
    const currentROE       = p.roe_percentage ?? (equity > 0
      ? Math.round(((noi - monthlyDebt * 12) / equity) * 1000) / 10
      : null);

    return {
      id:                    p.id,
      name:                  p.name,
      acquisitionPrice:      p.purchase_price ?? 0,
      acquisitionDate:       p.purchase_date ?? null,
      marketValue,
      outstandingDebt:       Math.round(outstandingDebt),
      equity:                Math.round(equity),
      annualRent,
      annualOperatingExpenses: Math.round(annualOpExp),
      noi,
      monthlyDebtService:    monthlyDebt,
      currentROE,
      monthlyCashFlow,
      portfolioAvgROE,
      totalPortfolioEquity:  Math.round(totalPortfolioEquity),
    } satisfies PropertySnapshot;
  });
}
