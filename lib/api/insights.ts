import { supabase } from '@/lib/supabase';

export type PortfolioInsights = {
  briefing_daily:   string | null;
  briefing_weekly:  string | null;
  briefing_monthly: string | null;
  action_queue:     any[];
  summary_snapshot: {
    total_properties:  number;
    total_value:       number;
    monthly_collected: number;
    monthly_expected:  number;
    collection_rate:   number;
    vacancies:         number;
    health_score:      number;
    net_income:        number;
  } | null;
  computed_at: string | null;
  expires_at:  string | null;
};

/**
 * Read the cached portfolio_insights row for this workspace.
 * Returns null if none found or expired.
 */
export async function getCachedInsights(workspaceId: string): Promise<PortfolioInsights | null> {
  const { data, error } = await supabase
    .from('portfolio_insights')
    .select('briefing_daily,briefing_weekly,briefing_monthly,action_queue,summary_snapshot,computed_at,expires_at')
    .eq('workspace_id', workspaceId)
    .single();

  if (error || !data) return null;

  // Treat as stale if expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

  return data as PortfolioInsights;
}

/**
 * Trigger a refresh of portfolio_insights via the Edge Function.
 * Resolves with the new insights (including Claude briefings) or null on error.
 */
export async function refreshInsights(workspaceId: string): Promise<PortfolioInsights | null> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/refresh-insights`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey':        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify({ workspaceId }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    if (!json.ok) return null;

    // Re-read the freshly upserted row
    return getCachedInsights(workspaceId);
  } catch {
    return null;
  }
}
