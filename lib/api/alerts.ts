import { supabase } from '@/lib/supabase';
import { listProperties } from './properties';
import type { AppAlert } from '@/types';

export async function generateAlerts(
  workspaceId: string,
  year: number,
  month: number,
): Promise<AppAlert[]> {
  const alerts: AppAlert[] = [];
  const today = new Date();
  const in30  = new Date(today);
  in30.setDate(in30.getDate() + 30);

  const props   = await listProperties(workspaceId);
  const propIds = props.map(p => p.id);
  if (!propIds.length) return alerts;

  const propMap = new Map(props.map(p => [p.id, p.name]));

  // ── 1. Overdue rent payments this month ──────────────────────────
  const { data: overdueRows } = await supabase
    .from('rent_payments')
    .select('id, amount_due, property_id, properties(name)')
    .in('property_id', propIds)
    .neq('status', 'paid')
    .eq('period_year', year)
    .eq('period_month', month)
    .eq('charge_type', 'rent');

  const overdueByProp = new Map<string, { name: string; count: number; totalDue: number }>();
  for (const r of overdueRows ?? []) {
    const pid  = r.property_id;
    const name = (r.properties as any)?.name ?? propMap.get(pid) ?? 'Unknown';
    const cur  = overdueByProp.get(pid) ?? { name, count: 0, totalDue: 0 };
    cur.count++;
    cur.totalDue += r.amount_due ?? 0;
    overdueByProp.set(pid, cur);
  }

  for (const [pid, d] of overdueByProp) {
    alerts.push({
      id:          `overdue-${d.name}`,
      severity:    'emergency',
      title:       `${d.count} tenant${d.count !== 1 ? 's' : ''} owe rent this month`,
      body:        `Potential recovery: $${d.totalDue.toLocaleString()}  •  Tap to view & contact`,
      action:      'View Ledger →',
      property:    d.name,
      time:        'This month',
      route:       '/(app)/portfolio/[id]/rent',
      routeParams: { id: pid, initialFilter: 'overdue' },
    });
  }

  // ── 2. Leases expiring within 30 days ────────────────────────────
  const { data: unitRows } = await supabase
    .from('units')
    .select('id, property_id')
    .in('property_id', propIds);

  const unitIds    = (unitRows ?? []).map((u: any) => u.id as string);
  const unitPropId = new Map((unitRows ?? []).map((u: any) => [u.id as string, u.property_id as string]));

  if (unitIds.length > 0) {
    const { data: expiringRows } = await supabase
      .from('leases')
      .select('id, end_date, unit_id, units(label)')
      .in('unit_id', unitIds)
      .eq('status', 'active')
      .lte('end_date', in30.toISOString().slice(0, 10))
      .gte('end_date', today.toISOString().slice(0, 10));

    const byProp = new Map<string, { propName: string; labels: string[] }>();
    for (const l of expiringRows ?? []) {
      const pid      = unitPropId.get(l.unit_id) ?? '';
      const propName = propMap.get(pid) ?? 'Portfolio';
      const label    = (l.units as any)?.label ?? '';
      const cur      = byProp.get(pid) ?? { propName, labels: [] };
      cur.labels.push(label);
      byProp.set(pid, cur);
    }

    for (const [pid, d] of byProp) {
      const n = d.labels.length;
      alerts.push({
        id:          `expiring-${d.propName}`,
        severity:    'warning',
        title:       `${n} lease${n !== 1 ? 's' : ''} expire within 30 days`,
        body:        `${d.labels.slice(0, 3).join(', ')}. Send renewal notices now.`,
        action:      'View Property →',
        property:    d.propName,
        time:        'Upcoming',
        route:       '/(app)/portfolio/[id]',
        routeParams: { id: pid },
      });
    }
  }

  return alerts;
}
