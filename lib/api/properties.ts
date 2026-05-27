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
    .select('*, units(id, label, bedrooms, bathrooms)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getPropertyUnits(propertyId: string): Promise<Unit[]> {
  const { data, error } = await supabase
    .from('units')
    .select('id, property_id, label, bedrooms, bathrooms, square_feet')
    .eq('property_id', propertyId)
    .order('label');
  if (error) throw error;
  return data ?? [];
}

export async function getActiveLeases(propertyId: string): Promise<Lease[]> {
  const { data, error } = await supabase
    .from('leases')
    .select('id, unit_id, monthly_rent, start_date, end_date, status, units(label)')
    .eq('property_id', propertyId)
    .eq('status', 'active');
  if (error) throw error;
  return (data ?? []) as Lease[];
}

// Lightweight metrics computed from rent_payments
export async function getPropertyMetrics(
  propertyId: string,
  year: number,
  month: number
): Promise<PropertyMetrics> {
  const { data, error } = await supabase
    .from('rent_payments')
    .select('amount_due, amount_paid, status, units(label)')
    .eq('property_id', propertyId)
    .eq('period_year', year)
    .eq('period_month', month)
    .eq('charge_type', 'rent');
  if (error) throw error;

  const rows = data ?? [];
  const totalDue  = rows.reduce((s, r) => s + (r.amount_due ?? 0), 0);
  const totalPaid = rows.reduce((s, r) => s + (r.amount_paid ?? 0), 0);
  const paid      = rows.filter(r => r.status === 'paid').length;
  const total     = rows.length;

  return {
    property_id:    propertyId,
    monthly_cash_flow: totalPaid,
    collection_rate:   total > 0 ? paid / total : 0,
    units_paid:     paid,
    units_total:    total,
    current_value:  null,
    equity:         null,
    roe:            null,
    vacancies:      0,
  };
}

export async function getPortfolioSummary(
  workspaceId: string,
  year: number,
  month: number
): Promise<PortfolioSummary> {
  const [propRes, rentRes] = await Promise.all([
    supabase
      .from('properties')
      .select('id, unit_count')
      .eq('workspace_id', workspaceId),
    supabase
      .from('rent_payments')
      .select('amount_due, amount_paid, status, property_id')
      .in('property_id', (await supabase
        .from('properties')
        .select('id')
        .eq('workspace_id', workspaceId)
      ).data?.map(p => p.id) ?? [])
      .eq('period_year', year)
      .eq('period_month', month)
      .eq('charge_type', 'rent'),
  ]);

  const props = propRes.data ?? [];
  const rents = rentRes.data ?? [];

  const totalValue = 0; // requires valuations join — loaded separately
  const collected  = rents.reduce((s, r) => s + (r.amount_paid ?? 0), 0);
  const expected   = rents.reduce((s, r) => s + (r.amount_due ?? 0), 0);
  const paid       = rents.filter(r => r.status === 'paid').length;

  return {
    total_properties:  props.length,
    total_value:       totalValue,
    monthly_cash_flow: collected,
    collection_rate:   rents.length > 0 ? paid / rents.length : 0,
    monthly_collected: collected,
    monthly_expected:  expected,
    net_income:        0, // requires expenses join
    vacancies:         0,
    longest_vacancy_days: 0,
    health_score:      74, // placeholder until scoring engine is wired
  };
}
