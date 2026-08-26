import { supabase } from '@/lib/supabase';

export type Move = {
  rank: number;
  title: string;
  description: string;
  annualImpact: number;
  effort: 'Low' | 'Medium' | 'High';
  risk: 'Low' | 'Medium' | 'High';
  timeline: string;
  why: string;
  howTo: string;
};

export type PropertyInsightData = {
  situationSummary: string | null;
  urgentAction: { exists: boolean; description?: string; daysUntilDeadline?: number | null } | null;
  moves: Move[];
  avoidList: { option: string; reason: string }[];
  bottomLine: string | null;
  projectedReturn: { current: number; afterMoves: number; difference: number } | null;
  disclaimer: string | null;
  computedAt: string | null;
  isStale: boolean;
};

/**
 * Reads the nightly AI narrative for a single property — the same
 * property_insights row refresh-property-insights writes, and the same
 * source lib/api/rules.ts's getPropertyInsightItems() maps into RulesTab's
 * action queue. That mapping only ever surfaces the top move; this reads
 * the full row so a dedicated screen can show every move, the avoid list,
 * and the bottom line.
 */
export async function getPropertyInsight(propertyId: string): Promise<PropertyInsightData | null> {
  const { data, error } = await supabase
    .from('property_insights')
    .select('insight_data, computed_at, expires_at')
    .eq('property_id', propertyId)
    .single();

  if (error || !data) return null;

  const d = data.insight_data as any;
  return {
    situationSummary: d?.situationSummary ?? null,
    urgentAction: d?.urgentAction?.exists
      ? { exists: true, description: d.urgentAction.description, daysUntilDeadline: d.urgentAction.daysUntilDeadline ?? null }
      : null,
    moves: (d?.moves ?? []) as Move[],
    avoidList: d?.avoidList ?? [],
    bottomLine: d?.bottomLine ?? null,
    projectedReturn: d?.projectedReturn ?? null,
    disclaimer: d?.disclaimer ?? null,
    computedAt: data.computed_at,
    isStale: data.expires_at ? new Date(data.expires_at) < new Date() : false,
  };
}
