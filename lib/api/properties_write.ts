import { supabase } from '@/lib/supabase';
import type { Property, Unit } from '@/types';

export type CreatePropertyInput = {
  workspace_id: string;
  name: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  zip?: string | null;
  property_type: Property['property_type'];
  asset_class?: Property['asset_class'];
  property_usage?: Property['property_usage'];
  purchase_price?: number | null;
  purchase_date?: string | null;         // YYYY-MM-DD
  current_market_value?: number | null;
  unit_count?: number;
};

export async function createProperty(input: CreatePropertyInput): Promise<Property> {
  const { data, error } = await supabase
    .from('properties')
    .insert({
      workspace_id:        input.workspace_id,
      name:                input.name,
      address_line1:       input.address_line1,
      address_line2:       input.address_line2        ?? null,
      city:                input.city,
      state:               input.state,
      zip:                 input.zip                  ?? null,
      property_type:       input.property_type,
      asset_class:         input.asset_class          ?? null,
      property_usage:      input.property_usage       ?? null,
      purchase_price:      input.purchase_price       ?? null,
      purchase_date:       input.purchase_date        ?? null,
      current_market_value: input.current_market_value ?? null,
      unit_count:          input.unit_count           ?? 1,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Property;
}

export type CreateUnitInput = {
  property_id:  string;
  workspace_id: string;
  label: string;
  unit_type?: string | null;
  beds?: number | null;
  baths?: number | null;
};

export async function createUnit(input: CreateUnitInput): Promise<Unit> {
  const { data, error } = await supabase
    .from('units')
    .insert({
      property_id:  input.property_id,
      workspace_id: input.workspace_id,
      label:        input.label,
      unit_type:    input.unit_type ?? null,
      beds:         input.beds      ?? null,
      baths:        input.baths     ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Unit;
}

export async function updateProperty(
  id: string,
  patch: Partial<Omit<CreatePropertyInput, 'workspace_id'>>,
): Promise<void> {
  const { error } = await supabase.from('properties').update(patch).eq('id', id);
  if (error) throw error;
}

export const PROPERTY_TYPES: { value: Property['property_type']; label: string }[] = [
  { value: 'sfh',         label: 'Single Family' },
  { value: 'duplex',      label: 'Duplex' },
  { value: 'triplex',     label: 'Triplex' },
  { value: 'fourplex',    label: 'Fourplex' },
  { value: 'multifamily', label: 'Multi-Family' },
];

export const PROPERTY_USAGE_TYPES: { value: NonNullable<Property['property_usage']>; label: string }[] = [
  { value: 'long_term_rental',  label: 'Long-Term Rental' },
  { value: 'midterm_rental',    label: 'Mid-Term Rental' },
  { value: 'short_term_rental', label: 'Short-Term Rental' },
  { value: 'owner_occupied',    label: 'Owner Occupied' },
  { value: 'vacant',            label: 'Vacant / Other' },
];
