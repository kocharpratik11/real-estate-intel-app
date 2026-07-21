import { supabase } from '@/lib/supabase';

export type HealthScoreResult = {
  score:       number;  // 0–100
  collection:  number;  // 0–40
  occupancy:   number;  // 0–20
  leaseHealth: number;  // 0–20
  maintenance: number;  // 0–20
  detail: {
    collectionRate: number;  // 0–1
    occupancyRate:  number;  // 0–1
    leasesAtRisk:   number;
    totalLeases:    number;
    urgentTickets:  number;
    highTickets:    number;
  };
};

export function scoreColor(score: number): string {
  if (score >= 80) return '#22C55E';   // green
  if (score >= 60) return '#F59E0B';   // yellow
  return '#EF4444';                    // red
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Warning';
  return 'At Risk';
}

export async function getPropertyHealthScore(
  propertyId: string,
  year:       number,
  month:      number,
): Promise<HealthScoreResult> {
  // Step 1: unit IDs (needed for lease queries)
  const { data: unitRows } = await supabase
    .from('units')
    .select('id')
    .eq('property_id', propertyId);
  const unitIds = (unitRows ?? []).map((u: any) => u.id as string);

  // Step 2: parallel data fetches
  const [rentRes, leaseRes, mainRes] = await Promise.all([
    // Rent collection for this month
    supabase
      .from('rent_payments')
      .select('status')
      .eq('property_id', propertyId)
      .eq('period_year', year)
      .eq('period_month', month)
      .eq('charge_type', 'rent'),

    // Active leases (occupancy + expiry health)
    unitIds.length > 0
      ? supabase
          .from('leases')
          .select('unit_id, end_date')
          .eq('status', 'active')
          .in('unit_id', unitIds)
      : Promise.resolve({ data: [] as any[] }),

    // Open maintenance tickets
    supabase
      .from('maintenance_events')
      .select('priority')
      .eq('property_id', propertyId)
      .in('status', ['requested', 'scheduled', 'in_progress']),
  ]);

  const rents       = (rentRes.data   ?? []) as any[];
  const leases      = (leaseRes.data  ?? []) as any[];
  const maintenance = (mainRes.data   ?? []) as any[];

  // --- Occupancy (0–20) --- (computed first so collection can use occupiedUnits)
  const totalUnits    = unitIds.length;
  const occupiedUnits = new Set(leases.map((l: any) => l.unit_id)).size;
  const occupancyRate = totalUnits > 0 ? occupiedUnits / totalUnits : 1;
  const occupancy     = Math.round(occupancyRate * 20);

  // --- Collection (0–40) ---
  const totalRents     = rents.length;
  const paidRents      = rents.filter(r => r.status === 'paid').length;
  // No rent charges this month: only read as "fully collected" if a unit is actually
  // occupied (e.g. billed but nothing outstanding yet). A fully vacant property has
  // nothing to collect by definition — that's a failing signal, not a perfect one.
  const collectionRate = totalRents > 0 ? paidRents / totalRents : (occupiedUnits > 0 ? 1 : 0);
  const collection     = Math.round(collectionRate * 40);

  // --- Lease health (0–20) ---
  const today   = new Date();
  const in60    = new Date(today); in60.setDate(in60.getDate() + 60);
  const todayStr = today.toISOString().slice(0, 10);
  const in60Str  = in60.toISOString().slice(0, 10);

  const totalLeases  = leases.length;
  const leasesAtRisk = leases.filter(
    (l: any) => l.end_date && l.end_date >= todayStr && l.end_date <= in60Str
  ).length;
  const leaseHealthRate = totalLeases > 0 ? (totalLeases - leasesAtRisk) / totalLeases : 1;
  const leaseHealth     = Math.round(leaseHealthRate * 20);

  // --- Maintenance (0–20) ---
  const urgentTickets = maintenance.filter((m: any) => m.priority === 'urgent').length;
  const highTickets   = maintenance.filter((m: any) => m.priority === 'high').length;
  const maintenanceScore = Math.max(0, Math.min(20, 20 - urgentTickets * 5 - highTickets * 2));

  const score = collection + occupancy + leaseHealth + maintenanceScore;

  return {
    score,
    collection,
    occupancy,
    leaseHealth,
    maintenance: maintenanceScore,
    detail: {
      collectionRate,
      occupancyRate,
      leasesAtRisk,
      totalLeases,
      urgentTickets,
      highTickets,
    },
  };
}
