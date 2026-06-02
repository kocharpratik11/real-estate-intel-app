import { supabase } from '@/lib/supabase';
import type { PropertySnapshot } from '@/lib/scenarios/types';

/**
 * Build PropertySnapshot objects for all properties in a workspace.
 *
 * Calls the get_portfolio_snapshots RPC which uses the same correct
 * calculation logic as the web (deploy_phase3e_rpc_layer.sql):
 *   - Amortised outstanding debt (mirrors JS calcOutstandingBalance)
 *   - TRUE NOI = income - operating expenses (BEFORE debt service)
 *   - Cash flow = (NOI - monthly_debt_service × 12) / 12
 *   - ROE = NOI / equity × 100
 *
 * Previously this function read stale pre-computed columns from the
 * properties table (annual_noi, monthly_debt_service) written by a
 * buggy trigger that baked debt service into the NOI figure, causing
 * cash flow to be double-counted.
 */
export async function buildSnapshots(workspaceId: string): Promise<PropertySnapshot[]> {
  const { data, error } = await supabase
    .rpc('get_portfolio_snapshots', { p_workspace_id: workspaceId });

  if (error || !data) return [];

  const json               = data as any;
  const portfolioAvgROE    = json.portfolio_avg_roe    ?? 0;
  const totalPortfolioEquity = json.total_portfolio_equity ?? 0;
  const props              = (json.properties ?? []) as any[];

  return props.map((p: any): PropertySnapshot => ({
    id:                      p.id,
    name:                    p.name,
    acquisitionPrice:        p.acquisition_price       ?? 0,
    acquisitionDate:         p.acquisition_date        ?? null,
    marketValue:             p.market_value            ?? 0,
    outstandingDebt:         p.outstanding_debt        ?? 0,
    equity:                  p.equity                  ?? 0,
    annualRent:              p.annual_rent             ?? 0,
    annualOperatingExpenses: p.annual_operating_expenses ?? 0,
    noi:                     p.noi                     ?? 0,
    monthlyDebtService:      p.monthly_debt_service    ?? 0,
    currentROE:              p.current_roe             ?? null,
    monthlyCashFlow:         p.monthly_cash_flow       ?? 0,
    portfolioAvgROE,
    totalPortfolioEquity,
  }));
}
