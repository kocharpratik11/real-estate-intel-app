import { supabase } from '@/lib/supabase';
import type { RentPayment, LedgerEvent } from '@/types';

export async function getRentPayments(
  propertyId: string,
  year?: number
): Promise<RentPayment[]> {
  let q = supabase
    .from('rent_payments')
    .select(`
      id, lease_id, property_id, unit_id,
      period_year, period_month,
      due_date, paid_date,
      amount_due, amount_paid,
      status, charge_type, charge_description, notes,
      units(id, label)
    `)
    .eq('property_id', propertyId)
    .order('due_date', { ascending: false });

  if (year) q = q.eq('period_year', year);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as RentPayment[];
}

/**
 * Record a lump-sum payment against a lease and apply it FIFO (oldest due_date
 * first) across its outstanding pending/partial/late charges — mirroring the
 * web app's recordPayment server action exactly, so mobile and web produce
 * identical ledger state. Any amount left over after all outstanding charges
 * are covered is recorded as a "Prepayment Credit" entry.
 */
export async function recordLumpSumPayment(data: {
  leaseId:     string;
  propertyId:  string;
  amount:      number;
  paymentDate: string;
  notes?:      string;
}): Promise<{ applied: number; credit: number }> {
  if (data.amount <= 0) throw new Error('Payment amount must be positive.');

  const { data: charges, error: chargesErr } = await supabase
    .from('rent_payments')
    .select('id, amount_due, amount_paid, charge_type, charge_description, due_date')
    .eq('lease_id', data.leaseId)
    .in('status', ['pending', 'partial', 'late'])
    .order('due_date', { ascending: true });
  if (chargesErr) throw chargesErr;

  const pending = (charges ?? []).filter(
    c => !(c.charge_type === 'other' && c.charge_description === 'Prepayment Credit')
  );

  let remaining = data.amount;
  for (const charge of pending) {
    if (remaining <= 0) break;
    const outstanding = charge.amount_due - (charge.amount_paid ?? 0);
    if (outstanding <= 0) continue;

    const applying = Math.min(remaining, outstanding);
    const newAmountPaid = (charge.amount_paid ?? 0) + applying;
    const newStatus = newAmountPaid >= charge.amount_due ? 'paid' : 'partial';

    const { error } = await supabase
      .from('rent_payments')
      .update({
        amount_paid: newAmountPaid,
        paid_date:   data.paymentDate,
        status:      newStatus,
        ...(data.notes ? { notes: data.notes } : {}),
      })
      .eq('id', charge.id);
    if (error) throw error;
    remaining -= applying;
  }

  // Any remaining amount becomes a prepayment credit
  if (remaining > 0.005) {
    const { data: lease, error: leaseErr } = await supabase
      .from('leases')
      .select('unit_id, workspace_id')
      .eq('id', data.leaseId)
      .single();
    if (leaseErr) throw leaseErr;

    const { error } = await supabase.from('rent_payments').insert({
      workspace_id:       lease.workspace_id,
      lease_id:           data.leaseId,
      property_id:        data.propertyId,
      unit_id:            lease.unit_id,
      charge_type:        'other',
      charge_description: 'Prepayment Credit',
      period_year:        null,
      period_month:       null,
      due_date:           data.paymentDate,
      amount_due:         0,
      amount_paid:        Math.round(remaining * 100) / 100,
      paid_date:          data.paymentDate,
      status:             'paid',
      notes:              data.notes ?? null,
    });
    if (error) throw error;
  }

  return { applied: data.amount - remaining, credit: remaining > 0.005 ? remaining : 0 };
}

export async function updatePaymentStatus(
  paymentId: string,
  status: 'pending' | 'late' | 'waived'
): Promise<void> {
  const { error } = await supabase
    .from('rent_payments')
    .update({ status })
    .eq('id', paymentId);
  if (error) throw error;
}

// Build a chronological ledger from raw rent_payment rows.
// Each row yields up to two events: a charge event and (if paid) a payment event.
export function buildLedger(payments: RentPayment[]): LedgerEvent[] {
  const events: Omit<LedgerEvent, 'runningBalance'>[] = [];

  for (const p of payments) {
    const isCredit =
      p.charge_type === 'other' &&
      (p.charge_description?.toLowerCase().includes('prepayment credit') ?? false);

    if (!isCredit && p.status !== 'waived') {
      events.push({
        date:          p.due_date,
        type:          'charge',
        amount:        p.amount_due,
        description:   chargeLabel(p),
        status:        p.status,
        sourcePayment: p,
        isCredit:      false,
      });
    }

    if (p.amount_paid && p.amount_paid > 0 && p.paid_date) {
      events.push({
        date:          p.paid_date,
        type:          'payment',
        amount:        p.amount_paid,
        description:   isCredit ? 'Prepayment Credit' : 'Payment received',
        status:        null,
        sourcePayment: p,
        isCredit,
      });
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date));

  let balance = 0;
  return events.map(e => {
    if (e.type === 'charge' && !e.isCredit) balance += e.amount;
    else balance -= e.amount;
    return { ...e, runningBalance: balance };
  }).reverse();
}

function chargeLabel(p: RentPayment): string {
  if (p.charge_description) return p.charge_description;
  const LABELS: Record<string, string> = {
    rent:             'Monthly Rent',
    late_fee:         'Late Fee',
    security_deposit: 'Security Deposit',
    pet_fee:          'Pet Fee',
    other:            'Other Charge',
  };
  const label = LABELS[p.charge_type] ?? 'Charge';
  if (p.period_month && p.period_year) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${label} — ${months[p.period_month - 1]} ${p.period_year}`;
  }
  return label;
}
