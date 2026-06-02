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
  const todayStr = today.toISOString().slice(0, 10);

  const props   = await listProperties(workspaceId);
  const propIds = props.map(p => p.id);
  if (!propIds.length) return alerts;

  const propMap = new Map(props.map(p => [p.id, p.name]));

  // Fetch all data in parallel
  const [
    overdueRes,
    unitRes,
    maintRes,
    thisMonthPayRes,
    vacantRes,
  ] = await Promise.all([
    // 1. Overdue rent payments this month
    supabase
      .from('rent_payments')
      .select('id, amount_due, property_id, properties(name)')
      .in('property_id', propIds)
      .in('status', ['late', 'partial'])
      .eq('period_year', year)
      .eq('period_month', month)
      .eq('charge_type', 'rent'),

    // For leases expiring
    supabase
      .from('units')
      .select('id, property_id, vacancy_started_at')
      .in('property_id', propIds),

    // 3. Urgent / high maintenance tickets
    supabase
      .from('maintenance_events')
      .select('id, property_id, title, priority, status')
      .in('property_id', propIds)
      .in('priority', ['urgent', 'high'])
      .in('status', ['requested', 'scheduled', 'in_progress']),

    // 4. Collection rate this month
    supabase
      .from('rent_payments')
      .select('property_id, amount_due, amount_paid, status')
      .in('property_id', propIds)
      .eq('period_year', year)
      .eq('period_month', month)
      .eq('charge_type', 'rent'),

    // 5. Vacant units (vacancy_started_at is set)
    supabase
      .from('units')
      .select('id, property_id, label, vacancy_started_at')
      .in('property_id', propIds)
      .not('vacancy_started_at', 'is', null),
  ]);

  const overdueRows   = overdueRes.data   ?? [];
  const unitRows      = unitRes.data      ?? [];
  const maintRows     = maintRes.data     ?? [];
  const thisMonthPay  = thisMonthPayRes.data ?? [];
  const vacantRows    = vacantRes.data    ?? [];

  // ── 1. Overdue rent payments ──────────────────────────────────────
  const overdueByProp = new Map<string, { name: string; count: number; totalDue: number }>();
  for (const r of overdueRows) {
    const pid  = r.property_id;
    const name = (r.properties as any)?.name ?? propMap.get(pid) ?? 'Unknown';
    const cur  = overdueByProp.get(pid) ?? { name, count: 0, totalDue: 0 };
    cur.count++;
    cur.totalDue += r.amount_due ?? 0;
    overdueByProp.set(pid, cur);
  }
  for (const [pid, d] of overdueByProp) {
    alerts.push({
      id:          `overdue-${pid}`,
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
  const unitIds    = unitRows.map((u: any) => u.id as string);
  const unitPropId = new Map(unitRows.map((u: any) => [u.id as string, u.property_id as string]));

  if (unitIds.length > 0) {
    const { data: expiringRows } = await supabase
      .from('leases')
      .select('id, end_date, unit_id, units(label)')
      .in('unit_id', unitIds)
      .eq('status', 'active')
      .lte('end_date', in30.toISOString().slice(0, 10))
      .gte('end_date', todayStr);

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
        id:          `expiring-${pid}`,
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

  // ── 3. Urgent / high-priority maintenance ────────────────────────
  if (maintRows.length > 0) {
    const urgentByProp = new Map<string, { propName: string; count: number; titles: string[] }>();
    for (const m of maintRows) {
      const pid      = m.property_id;
      const propName = propMap.get(pid) ?? 'Portfolio';
      const cur      = urgentByProp.get(pid) ?? { propName, count: 0, titles: [] };
      cur.count++;
      cur.titles.push(m.title);
      urgentByProp.set(pid, cur);
    }
    for (const [pid, d] of urgentByProp) {
      alerts.push({
        id:          `maintenance-${pid}`,
        severity:    'warning',
        title:       `${d.count} urgent maintenance ticket${d.count !== 1 ? 's' : ''} open`,
        body:        d.titles.slice(0, 2).join('  •  '),
        action:      'View Tickets →',
        property:    d.propName,
        time:        'Open',
        route:       '/(app)/maintenance',
      });
    }
  }

  // ── 4. Low collection rate this month ────────────────────────────
  if (thisMonthPay.length > 0) {
    const totalDue       = thisMonthPay.reduce((s: number, p: any) => s + (p.amount_due  ?? 0), 0);
    const totalCollected = thisMonthPay.reduce((s: number, p: any) => s + (p.amount_paid ?? 0), 0);
    const rate           = totalDue > 0 ? totalCollected / totalDue : 1;

    if (rate < 0.8 && totalDue > 0) {
      const pct = Math.round(rate * 100);
      alerts.push({
        id:       'low-collection',
        severity: rate < 0.5 ? 'emergency' : 'warning',
        title:    `Only ${pct}% rent collected this month`,
        body:     `$${Math.round(totalDue - totalCollected).toLocaleString()} outstanding across portfolio`,
        action:   'View Portfolio →',
        property: 'Portfolio',
        time:     'This month',
        route:    '/(app)/portfolio',
      });
    }
  }

  // ── 5. Long-running vacancies ─────────────────────────────────────
  const vacByProp = new Map<string, { propName: string; units: { label: string; days: number }[] }>();
  for (const u of vacantRows) {
    const pid      = u.property_id;
    const propName = propMap.get(pid) ?? 'Portfolio';
    const startedAt = u.vacancy_started_at as string | null;
    if (!startedAt) continue;
    const days = Math.floor((Date.now() - new Date(startedAt).getTime()) / 86400_000);
    if (days < 7) continue; // ignore very fresh vacancies
    const cur = vacByProp.get(pid) ?? { propName, units: [] };
    cur.units.push({ label: u.label as string, days });
    vacByProp.set(pid, cur);
  }
  for (const [pid, d] of vacByProp) {
    const maxDays = Math.max(...d.units.map(u => u.days));
    alerts.push({
      id:          `vacancy-${pid}`,
      severity:    maxDays >= 60 ? 'emergency' : 'warning',
      title:       `${d.units.length} unit${d.units.length !== 1 ? 's' : ''} vacant`,
      body:        `Longest vacancy: ${maxDays} days. Lost income grows daily.`,
      action:      'View Units →',
      property:    d.propName,
      time:        `${maxDays}d vacant`,
      route:       '/(app)/portfolio/[id]',
      routeParams: { id: pid },
    });
  }

  return alerts;
}
