import { supabase } from '@/lib/supabase';
import type { Expense } from '@/types';

export type LogExpenseInput = {
  property_id: string;
  unit_id?: string | null;
  category: string;
  amount: number;
  expense_date: string;   // YYYY-MM-DD
  description?: string | null;
  vendor?: string | null;
  tax_year?: number | null;
  notes?: string | null;
};

export async function logExpense(input: LogExpenseInput): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      property_id:  input.property_id,
      unit_id:      input.unit_id     ?? null,
      category:     input.category,
      amount:       input.amount,
      expense_date: input.expense_date,
      description:  input.description ?? null,
      vendor:       input.vendor      ?? null,
      tax_year:     input.tax_year    ?? new Date(input.expense_date).getFullYear(),
      notes:        input.notes       ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Expense;
}

export async function getExpenses(
  propertyId: string,
  opts?: { year?: number; month?: number; limit?: number },
): Promise<Expense[]> {
  let query = supabase
    .from('expenses')
    .select('*')
    .eq('property_id', propertyId)
    .order('expense_date', { ascending: false });

  if (opts?.year && opts?.month) {
    const start = `${opts.year}-${String(opts.month).padStart(2, '0')}-01`;
    const end   = `${opts.year}-${String(opts.month).padStart(2, '0')}-31`;
    query = query.gte('expense_date', start).lte('expense_date', end);
  } else if (opts?.year) {
    query = query.eq('tax_year', opts.year);
  }

  if (opts?.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Expense[];
}

// Values match the web app's DB enum exactly (IRS Schedule E categories).
// label = display name, value = what is stored in expenses.category column.
export const EXPENSE_CATEGORIES = [
  { value: 'advertising',              label: 'Advertising' },
  { value: 'auto_and_travel',          label: 'Auto & Travel' },
  { value: 'cleaning_and_maintenance', label: 'Cleaning & Maintenance' },
  { value: 'commissions',              label: 'Commissions' },
  { value: 'insurance',                label: 'Insurance' },
  { value: 'legal_and_professional',   label: 'Legal & Professional' },
  { value: 'management_fees',          label: 'Management Fees' },
  { value: 'mortgage_interest',        label: 'Mortgage Interest' },
  { value: 'other_interest',           label: 'Other Interest' },
  { value: 'repairs',                  label: 'Repairs & Maintenance' },
  { value: 'supplies',                 label: 'Supplies' },
  { value: 'taxes',                    label: 'Property Tax' },
  { value: 'utilities',                label: 'Utilities' },
  { value: 'depreciation',             label: 'Depreciation' },
  { value: 'other',                    label: 'Other' },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]['value'];
