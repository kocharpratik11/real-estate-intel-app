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

export async function recordPayment(
  paymentId: string,
  amountPaid: number,
  paidDate: string,
  method: string,
  notes?: string
): Promise<void> {
  const { error } = await supabase
    .from('rent_payments')
    .update({
      amount_paid: amountPaid,
      paid_date:   paidDate,
      status:      'paid',
      notes:       notes ?? null,
    })
    .eq('id', paymentId);
  if (error) throw error;
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
