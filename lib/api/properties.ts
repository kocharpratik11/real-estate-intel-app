import { supabase } from '@/lib/supabase';
import type { Property, PropertyMetrics, PortfolioSummary, Unit, Lease } from '@/types';

export async function listProperties(workspaceId: string): Promise<Property[]> {
  const { data, error } = await supabase
    .from('properties')
    .select('id, name, address_line1, city, state, property_type, unit_count, workspace_id')
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

export async function getPropertyUnits(propertyId: string): Promise<Unit[]> {
  const { data, error } = await supabase
    .from('units')
    .select('id, property_id, label')
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

async function sumExpenses(propertyIds: string[], year: number, month: number): Promise<number> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end   = `${year}-${String(month).padStart(2, '0')}-31`;
  const { data } = await supabase
    .from('expenses')
    .select('amount')
    .in('property_id', propertyIds)
    .gte('expense_date', start)
    .lte('expense_date', end);
  return (data ?? []).reduce((s: number, e: any) => s + (e.amount ?? 0), 0);
}

// Lightweight metrics computed from rent_payments + DB-computed property columns
export async function getPropertyMetrics(
  propertyId: string,
  year: number,
  month: number,
): Promise<PropertyMetrics> {
  const [rentRes, unitRes, propRes] = await Promise.all([
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
      .select('current_market_value, total_equity, roe_percentage, annual_noi, monthly_debt_service')
      .eq('id', propertyId)
      .single(),
  ]);

  const rows     = rentRes.data ?? [];
  const unitIds  = (unitRes.data ?? []).map((u: any) => u.id as string);
  const vacancies = await countVacancies(unitIds);
  const prop     = propRes.data;

  const totalPaid = rows.reduce((s, r) => s + (r.amount_paid ?? 0), 0);
  const paid  = rows.filter(r => r.status === 'paid').length;
  const total = rows.length;

  // Prefer DB-computed annual_noi / 12 for cash flow; fall back to collected rent
  const monthlyCashFlow = prop?.annual_noi != null
    ? Math.round(prop.annual_noi / 12)
    : totalPaid;

  return {
    property_id:       propertyId,
    monthly_cash_flow: monthlyCashFlow,
    collection_rate:   total > 0 ? paid / total : 0,
    units_paid:        paid,
    units_total:       total,
    current_value:     prop?.current_market_value ?? null,
    equity:            prop?.total_equity          ?? null,
    roe:               prop?.roe_percentage        ?? null,
    vacancies,
  };
}

export async function getPortfolioSummary(
  workspaceId: string,
  year: number,
  month: number,
): Promise<PortfolioSummary> {
  // 1. Workspace properties (include market value for portfolio total)
  const { data: props } = await supabase
    .from('properties')
    .select('id, unit_count, current_market_value')
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

  // 2. Parallel: rent payments + all units + expenses
  const [rentRes, unitRes, totalExpenses] = await Promise.all([
    supabase
      .from('rent_payments')
      .select('amount_due, amount_paid, status')
      .in('property_id', propIds)
      .eq('period_year', year)
      .eq('period_month', month)
      .eq('charge_type', 'rent'),
    supabase
      .from('units')
      .select('id')
      .in('property_id', propIds),
    sumExpenses(propIds, year, month).catch(() => 0),
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

  return {
    total_properties:     propIds.length,
    total_value:          totalValue,
    monthly_cash_flow:    collected,
    collection_rate:      collectionRate,
    monthly_collected:    collected,
    monthly_expected:     expected,
    net_income:           collected - totalExpenses,
    vacancies,
    longest_vacancy_days: 0,          // requires vacancy-start tracking
    health_score:         healthScore,
  };
}
