import { supabase } from '@/lib/supabase';
import type { Property, PropertyMetrics, PortfolioSummary, Unit, Lease } from '@/types';

export async function listProperties(workspaceId: string): Promise<Property[]> {
  const { data, error } = await supabase
    .from('properties')
    .select('id, name, address_line1, city, state, property_type, unit_count, workspace_id, is_primary_residence')
    .eq('workspace_id', workspaceId)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getProperty(id: string) {
  const { data, error } = await supabase
    .from('properties')
    .select('*, units(id, label)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Full data for the Primary Residence detail screen — property core fields
 * plus its financing structures (loans) and non-archived documents. A
 * separate query from getProperty() so the normal rental detail screen's
 * payload doesn't grow for data it doesn't use.
 */
export async function getPrimaryResidenceDetail(propertyId: string) {
  const { data, error } = await supabase
    .from('properties')
    .select(`
      id, name, address_line1, address_line2, city, state, zip,
      current_market_value, value_updated_at, purchase_price, purchase_date,
      annual_property_tax, monthly_hoa_fee, target_payoff_date,
      financing_structures(
        id, lender_name, loan_amount, current_balance, interest_rate,
        loan_term_months, monthly_payment, origination_date, maturity_date,
        is_interest_only, payoff_date
      ),
      documents(id, filename, document_type, document_date)
    `)
    .eq('id', propertyId)
    .single();
  if (error) throw error;
  return data;
}

export async function getPropertyUnits(propertyId: string): Promise<Unit[]> {
  const { data, error } = await supabase
    .from('units')
    .select('id, property_id, workspace_id, label')
    .eq('property_id', propertyId)
    .order('label');
  if (error) throw error;
  return data ?? [];
}

export async function getActiveLeases(propertyId: string): Promise<Lease[]> {
  const { data: units } = await supabase
    .from('units')
    .select('id')
    .eq('property_id', propertyId);
  const unitIds = (units ?? []).map((u: any) => u.id);
  if (!unitIds.length) return [];

  const { data, error } = await supabase
    .from('leases')
    .select('id, unit_id, monthly_rent, start_date, end_date, status, units(id, label)')
    .in('unit_id', unitIds)
    .eq('status', 'active');
  if (error) throw error;
  return (data ?? []) as unknown as Lease[];
}

async function countVacancies(unitIds: string[]): Promise<number> {
  if (!unitIds.length) return 0;
  const { data } = await supabase
    .from('leases')
    .select('unit_id')
    .in('unit_id', unitIds)
    .eq('status', 'active');
  const occupied = new Set((data ?? []).map((l: any) => l.unit_id));
  return unitIds.filter(id => !occupied.has(id)).length;
}

/**
 * Lightweight metrics for a single property for a given month.
 *
 * Uses get_property_metrics_v2 RPC for financial figures (cash flow, equity,
 * ROE) so the numbers match exactly what the web shows — same amortised debt,
 * same NOI calculation, same cash flow formula.
 *
 * Rent collection stats (units_paid, collection_rate) are read directly from
 * rent_payments for the specific month/year requested.
 */
export async function getPropertyMetrics(
  propertyId: string,
  year: number,
  month: number,
): Promise<PropertyMetrics> {
  const [rpcRes, rentRes, unitRes, propRes] = await Promise.all([
    supabase.rpc('get_property_metrics_v2', { p_property_id: propertyId }),
    supabase
      .from('rent_payments')
      .select('amount_due, amount_paid, status')
      .eq('property_id', propertyId)
      .eq('period_year', year)
      .eq('period_month', month)
      .eq('charge_type', 'rent'),
    supabase
      .from('units')
      .select('id')
      .eq('property_id', propertyId),
    supabase
      .from('properties')
      .select('is_primary_residence')
      .eq('id', propertyId)
      .single(),
  ]);

  const m           = (rpcRes.data ?? {}) as any;
  const rows        = rentRes.data ?? [];
  const unitIds     = (unitRes.data ?? []).map((u: any) => u.id as string);
  const isPrimary   = !!propRes.data?.is_primary_residence;
  const vacancies   = await countVacancies(unitIds);

  const paid  = rows.filter(r => r.status === 'paid').length;
  const total = rows.length;

  const equity = m?.current_equity ?? null;
  // Primary residences aren't rental income — cash flow, collection rate and ROE
  // don't apply to them (matches the web app's convention). Equity/value still do.
  const monthlyCashFlow = isPrimary ? 0 : (m?.monthly_cash_flow ?? 0);
  // ROE = annualized cash flow / current equity — verified against the web app's actual
  // displayed values. Not NOI / purchase price (roe_percentage's documented formula);
  // that's a different, stale metric that no longer matches what's shown as "ROE".
  const roe = (isPrimary || equity == null || equity === 0)
    ? null
    : (monthlyCashFlow * 12 / equity) * 100;

  return {
    property_id:          propertyId,
    is_primary_residence: isPrimary,
    monthly_cash_flow:    monthlyCashFlow,
    collection_rate:      isPrimary ? 0 : (total > 0 ? paid / total : 0),
    units_paid:           paid,
    units_total:          total,
    current_value:        m?.current_value ?? null,
    equity,
    roe,
    vacancies:            isPrimary ? 0 : vacancies,
  };
}

export async function getPortfolioSummary(
  workspaceId: string,
  year: number,
  month: number,
): Promise<PortfolioSummary> {
  // 1. Workspace properties (include market value for portfolio total — equity/value
  // always include primary residences, matching the web app's convention)
  const { data: props } = await supabase
    .from('properties')
    .select('id, unit_count, current_market_value, is_primary_residence')
    .eq('workspace_id', workspaceId);

  const propIds   = (props ?? []).map((p: any) => p.id as string);
  const totalValue = (props ?? []).reduce((s: number, p: any) => s + (p.current_market_value ?? 0), 0);

  if (!propIds.length) {
    return {
      total_properties: 0, total_value: 0,
      monthly_cash_flow: 0, collection_rate: 0,
      monthly_collected: 0, monthly_expected: 0,
      net_income: 0, vacancies: 0, longest_vacancy_days: 0, health_score: 0,
    };
  }

  // Rent, occupancy and collection stats only apply to rental properties —
  // a primary residence has no tenants to collect from or vacate.
  const rentalPropIds = (props ?? [])
    .filter((p: any) => !p.is_primary_residence)
    .map((p: any) => p.id as string);

  // 2. Parallel: rent payments + rental units + per-property cash flow (same
  // get_property_metrics_v2 source the portfolio list and property detail
  // screens use, so this can't drift out of sync with them)
  const [rentRes, unitRes, metricsResults] = await Promise.all([
    rentalPropIds.length > 0
      ? supabase
          .from('rent_payments')
          .select('amount_due, amount_paid, status')
          .in('property_id', rentalPropIds)
          .eq('period_year', year)
          .eq('period_month', month)
          .eq('charge_type', 'rent')
      : Promise.resolve({ data: [] as any[] }),
    rentalPropIds.length > 0
      ? supabase
          .from('units')
          .select('id')
          .in('property_id', rentalPropIds)
      : Promise.resolve({ data: [] as any[] }),
    Promise.all(propIds.map(id => getPropertyMetrics(id, year, month).catch(() => null))),
  ]);

  const rents    = rentRes.data ?? [];
  const unitIds  = (unitRes.data ?? []).map((u: any) => u.id as string);
  const vacancies = await countVacancies(unitIds);

  const collected = rents.reduce((s, r) => s + (r.amount_paid ?? 0), 0);
  const expected  = rents.reduce((s, r) => s + (r.amount_due  ?? 0), 0);
  const paid      = rents.filter(r => r.status === 'paid').length;

  const collectionRate = rents.length > 0 ? paid / rents.length : 0;
  const vacancyRate    = unitIds.length  > 0 ? vacancies / unitIds.length : 0;
  // Health score: 60pts collection + 40pts occupancy
  const healthScore = Math.round(collectionRate * 60 + (1 - vacancyRate) * 40);

  // Net cash flow (NOI - debt service), summed from the same RPC-backed figure used
  // elsewhere — not gross rent minus manually-logged expenses, which ignored the
  // mortgage entirely and overstated profitability.
  const cashFlow = metricsResults
    .filter((m): m is NonNullable<typeof m> => m != null)
    .reduce((s, m) => s + m.monthly_cash_flow, 0);

  return {
    total_properties:     propIds.length,
    total_value:          totalValue,
    monthly_cash_flow:    cashFlow,
    collection_rate:      collectionRate,
    monthly_collected:    collected,
    monthly_expected:     expected,
    net_income:           cashFlow,
    vacancies,
    longest_vacancy_days: 0,          // requires vacancy-start tracking
    health_score:         healthScore,
  };
}
