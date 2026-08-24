import { supabase } from '@/lib/supabase';

// Matches property_systems' CHECK constraint in deploy_phase4a_intelligence_v2.sql (web repo),
// which itself mirrors maintenance_category's vocabulary plus a few longer-lifespan additions.
export const SYSTEM_TYPES = [
  { value: 'hvac',          label: 'HVAC' },
  { value: 'water_heater',  label: 'Water Heater' },
  { value: 'roofing',       label: 'Roofing' },
  { value: 'electrical',    label: 'Electrical' },
  { value: 'plumbing',      label: 'Plumbing' },
  { value: 'appliance',     label: 'Appliance' },
  { value: 'windows',       label: 'Windows' },
  { value: 'foundation',    label: 'Foundation' },
  { value: 'structural',    label: 'Structural' },
  { value: 'safety',        label: 'Safety' },
  { value: 'painting',      label: 'Painting' },
  { value: 'flooring',      label: 'Flooring' },
  { value: 'landscaping',   label: 'Landscaping' },
  { value: 'pest_control',  label: 'Pest Control' },
  { value: 'other',         label: 'Other' },
] as const;

export type SystemType = (typeof SYSTEM_TYPES)[number]['value'];

export type PropertySystem = {
  id:                        string;
  property_id:               string;
  system_type:               SystemType;
  installed_date:            string | null;
  last_serviced_date:        string | null;
  estimated_lifespan_years:  number | null;
  replacement_cost_estimate: number | null;
  warranty_expires:          string | null;
  notes:                     string | null;
};

// Same defaults as supabase/functions/refresh-property-insights/index.ts and web's
// SystemsContent.tsx computeSystemUrgency — keep all three in sync. This is what
// makes a system's badge here match what actually drives the nightly AI narrative.
const DEFAULT_LIFESPAN: Partial<Record<SystemType, number>> = {
  hvac: 15, water_heater: 10, roofing: 25, electrical: 40, plumbing: 50,
  appliance: 12, windows: 20, foundation: 100,
};

export type Urgency = 'ok' | 'monitor' | 'plan' | 'urgent';

export function urgencyFor(system: PropertySystem): { urgency: Urgency; pct: number } {
  if (!system.installed_date) return { urgency: 'ok', pct: 0 };
  const ageYears = (Date.now() - new Date(system.installed_date).getTime()) / (1000 * 60 * 60 * 24 * 365);
  const lifespan = system.estimated_lifespan_years ?? DEFAULT_LIFESPAN[system.system_type] ?? 15;
  const pct = lifespan > 0 ? (ageYears / lifespan) * 100 : 0;
  const urgency: Urgency = pct >= 90 ? 'urgent' : pct >= 75 ? 'plan' : pct >= 60 ? 'monitor' : 'ok';
  return { urgency, pct: Math.round(pct) };
}

export async function getPropertySystems(propertyId: string): Promise<PropertySystem[]> {
  const { data, error } = await supabase
    .from('property_systems')
    .select('id, property_id, system_type, installed_date, last_serviced_date, estimated_lifespan_years, replacement_cost_estimate, warranty_expires, notes')
    .eq('property_id', propertyId)
    .order('installed_date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PropertySystem[];
}

export type SaveSystemInput = {
  property_id:                 string;
  system_type:                 SystemType;
  installed_date?:             string | null;
  last_serviced_date?:         string | null;
  estimated_lifespan_years?:   number | null;
  replacement_cost_estimate?:  number | null;
  notes?:                      string | null;
};

export async function createPropertySystem(input: SaveSystemInput): Promise<void> {
  const { data: property, error: propertyErr } = await supabase
    .from('properties')
    .select('workspace_id')
    .eq('id', input.property_id)
    .single();
  if (propertyErr) throw propertyErr;

  const { error } = await supabase
    .from('property_systems')
    .insert({ ...input, workspace_id: property.workspace_id });
  if (error) throw error;
}

export async function updatePropertySystem(id: string, patch: Partial<SaveSystemInput>): Promise<void> {
  const { error } = await supabase.from('property_systems').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deletePropertySystem(id: string): Promise<void> {
  const { error } = await supabase.from('property_systems').delete().eq('id', id);
  if (error) throw error;
}
