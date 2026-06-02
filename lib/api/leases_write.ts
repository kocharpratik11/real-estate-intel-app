import { supabase } from '@/lib/supabase';

export type CreateLeaseInput = {
  unit_id:        string;
  workspace_id:   string;
  start_date:     string;       // YYYY-MM-DD
  end_date:       string | null;
  monthly_rent:   number;
  security_deposit?: number | null;
  status?:        'draft' | 'active';
  // Optional new tenant
  tenant_first_name?: string;
  tenant_last_name?:  string;
  tenant_email?:      string;
  tenant_phone?:      string;
};

/**
 * Generate rent_payment rows for a newly created active lease.
 * Mirrors web's generateLeaseCharges() — creates monthly rent charges
 * from lease start up to (and including) the current month, with
 * proration for mid-month starts. Also creates security deposit charge.
 */
async function generateRentCharges(params: {
  leaseId:         string;
  workspaceId:     string;
  propertyId:      string;
  unitId:          string;
  monthlyRent:     number;
  startDate:       string;
  endDate:         string | null;
  securityDeposit: number | null;
}): Promise<void> {
  const { leaseId, workspaceId, propertyId, unitId, monthlyRent, startDate, endDate, securityDeposit } = params;

  const [sy, sm, sd] = startDate.split('-').map(Number);
  const start = new Date(sy, sm - 1, 1);

  let end = start;
  if (endDate) {
    const [ey, em] = endDate.split('-').map(Number);
    end = new Date(ey, em - 1, 1);
  }

  const today = new Date();
  // Never pre-generate future months
  const ceilingAt    = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const leaseStopAt  = new Date(end.getFullYear(), end.getMonth() + 1, 1);
  const stopAt       = leaseStopAt < ceilingAt ? leaseStopAt : ceilingAt;

  const base = {
    workspace_id: workspaceId,
    lease_id:     leaseId,
    property_id:  propertyId,
    unit_id:      unitId,
    status:       'pending',
  };

  // Monthly rent charges ──────────────────────────────────────────────
  const rentRows: object[] = [];
  const cur = new Date(start);
  while (cur < stopAt) {
    const y = cur.getFullYear();
    const m = cur.getMonth() + 1;
    const isFirstMonth = y === sy && m === sm;

    let amount = monthlyRent;
    let chargeDescription: string | undefined;
    if (isFirstMonth && sd > 1) {
      const daysInMonth  = new Date(y, m, 0).getDate();
      const daysOccupied = daysInMonth - sd + 1;
      amount = Math.round((daysOccupied / daysInMonth) * monthlyRent * 100) / 100;
      chargeDescription  = `Prorated Rent (${daysOccupied}/${daysInMonth} days)`;
    }

    rentRows.push({
      ...base,
      charge_type:  'rent',
      period_year:  y,
      period_month: m,
      due_date:     `${y}-${String(m).padStart(2, '0')}-01`,
      amount_due:   amount,
      ...(chargeDescription ? { charge_description: chargeDescription } : {}),
    });
    cur.setMonth(cur.getMonth() + 1);
  }

  if (rentRows.length > 0) {
    await supabase.from('rent_payments').insert(rentRows);
  }

  // Security deposit (one-time) ──────────────────────────────────────
  if (securityDeposit && securityDeposit > 0) {
    await supabase.from('rent_payments').insert({
      ...base,
      charge_type:        'security_deposit',
      charge_description: 'Security Deposit',
      period_year:        null,
      period_month:       null,
      due_date:           startDate,
      amount_due:         securityDeposit,
    });
  }
}

export async function createLease(input: CreateLeaseInput): Promise<{ id: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const leaseStatus = input.status ?? 'active';

  // Check for existing active lease on this unit
  if (leaseStatus === 'active') {
    const { data: existing } = await supabase
      .from('leases')
      .select('id')
      .eq('unit_id', input.unit_id)
      .eq('status', 'active')
      .maybeSingle();
    if (existing) throw new Error('This unit already has an active lease.');
  }

  // Create lease
  const { data: lease, error: leaseErr } = await supabase
    .from('leases')
    .insert({
      workspace_id:     input.workspace_id,
      unit_id:          input.unit_id,
      start_date:       input.start_date,
      end_date:         input.end_date,
      monthly_rent:     input.monthly_rent,
      security_deposit: input.security_deposit ?? null,
      status:           leaseStatus,
      created_by:       user.id,
    })
    .select('id')
    .single();

  if (leaseErr || !lease) throw new Error(leaseErr?.message ?? 'Failed to create lease');

  // Get property_id from unit
  const { data: unit } = await supabase
    .from('units')
    .select('property_id')
    .eq('id', input.unit_id)
    .single();

  if (leaseStatus === 'active') {
    // Clear vacancy_started_at on the unit
    await supabase.from('units').update({ vacancy_started_at: null }).eq('id', input.unit_id);

    // Auto-generate rent charges (current month + proration if mid-month start)
    if (unit?.property_id) {
      await generateRentCharges({
        leaseId:         lease.id,
        workspaceId:     input.workspace_id,
        propertyId:      unit.property_id,
        unitId:          input.unit_id,
        monthlyRent:     input.monthly_rent,
        startDate:       input.start_date,
        endDate:         input.end_date,
        securityDeposit: input.security_deposit ?? null,
      });
    }
  }

  // Create tenant if name provided
  if (input.tenant_first_name || input.tenant_last_name) {
    const { data: tenant } = await supabase
      .from('tenants')
      .insert({
        workspace_id: input.workspace_id,
        first_name:   input.tenant_first_name || 'Unknown',
        last_name:    input.tenant_last_name  || 'Unknown',
        email:        input.tenant_email  || null,
        phone:        input.tenant_phone  || null,
      })
      .select('id')
      .single();

    if (tenant) {
      await supabase.from('lease_tenants').insert({
        workspace_id: input.workspace_id,
        lease_id:     lease.id,
        tenant_id:    tenant.id,
      });
    }
  }

  // Recalculate property metrics
  if (unit?.property_id) {
    try {
      await supabase.rpc('calculate_property_metrics', { p_property_id: unit.property_id });
    } catch {}
  }

  return { id: lease.id };
}
