import { supabase } from '@/lib/supabase';
import type { MaintenanceEvent } from '@/types';

export type CreateTicketInput = {
  property_id: string;
  unit_id?: string | null;
  title: string;
  description?: string | null;
  category?: string | null;
  priority?: MaintenanceEvent['priority'];
  estimated_cost?: number | null;
  scheduled_date?: string | null;   // YYYY-MM-DD
};

export async function createTicket(input: CreateTicketInput): Promise<MaintenanceEvent> {
  const { data, error } = await supabase
    .from('maintenance_events')
    .insert({
      property_id:     input.property_id,
      unit_id:         input.unit_id        ?? null,
      title:           input.title,
      description:     input.description    ?? null,
      category:        input.category       ?? null,
      priority:        input.priority       ?? 'normal',
      status:          'requested',
      requested_date:  new Date().toISOString().slice(0, 10),
      estimated_cost:  input.estimated_cost ?? null,
      scheduled_date:  input.scheduled_date ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as MaintenanceEvent;
}

export type UpdateTicketInput = {
  title?: string;
  description?: string | null;
  category?: string | null;
  priority?: MaintenanceEvent['priority'];
  estimated_cost?: number | null;
  scheduled_date?: string | null;
};

export async function updateTicket(ticketId: string, patch: UpdateTicketInput): Promise<void> {
  const { error } = await supabase
    .from('maintenance_events')
    .update(patch)
    .eq('id', ticketId);
  if (error) throw error;
}

export async function updateTicketStatus(
  ticketId: string,
  status: MaintenanceEvent['status'],
  opts?: { actual_cost?: number; completed_date?: string },
): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (status === 'completed') {
    updates.completed_date = opts?.completed_date ?? new Date().toISOString().slice(0, 10);
    if (opts?.actual_cost != null) updates.actual_cost = opts.actual_cost;
  }
  const { error } = await supabase
    .from('maintenance_events')
    .update(updates)
    .eq('id', ticketId);
  if (error) throw error;
}

export async function getTickets(
  propertyId: string,
  opts?: { status?: MaintenanceEvent['status'] | 'open'; limit?: number },
): Promise<MaintenanceEvent[]> {
  let query = supabase
    .from('maintenance_events')
    .select('*')
    .eq('property_id', propertyId)
    .order('requested_date', { ascending: false });

  if (opts?.status === 'open') {
    // "open" = any status except completed/cancelled
    query = query.not('status', 'in', '("completed","cancelled")');
  } else if (opts?.status) {
    query = query.eq('status', opts.status);
  }

  if (opts?.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MaintenanceEvent[];
}

// Values match the web app's DB enum exactly.
// label = display name, value = what is stored in maintenance_events.category column.
export const MAINTENANCE_CATEGORIES = [
  { value: 'plumbing',     label: 'Plumbing' },
  { value: 'electrical',   label: 'Electrical' },
  { value: 'hvac',         label: 'HVAC' },
  { value: 'appliance',    label: 'Appliance' },
  { value: 'structural',   label: 'Structural' },
  { value: 'pest_control', label: 'Pest Control' },
  { value: 'landscaping',  label: 'Landscaping' },
  { value: 'painting',     label: 'Painting' },
  { value: 'flooring',     label: 'Flooring' },
  { value: 'roofing',      label: 'Roofing' },
  { value: 'safety',       label: 'Safety' },
  { value: 'other',        label: 'Other' },
] as const;

export type MaintenanceCategory = (typeof MAINTENANCE_CATEGORIES)[number]['value'];
