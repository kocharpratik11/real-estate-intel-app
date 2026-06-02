import { supabase } from '@/lib/supabase';

export interface RulesActionItem {
  propertyId:   string;
  propertyName: string;
  ruleId:       string;
  title:        string;
  description:  string;
  severity:     'critical' | 'warning' | 'info';
  annualImpact: number | null;
  action:       string | null;
}

export interface RulesData {
  actionQueue:     RulesActionItem[];
  alerts:          any[];
  healthScores:    Record<string, { score: number; collection: number; occupancy: number; maintenance: number }>;
  briefingDaily:   string | null;
  briefingWeekly:  string | null;
  briefingMonthly: string | null;
  computedAt:      string | null;
  expiresAt:       string | null;
  isStale:         boolean;
}

/**
 * Fetch portfolio rules engine output and AI briefings from the
 * portfolio_insights cache via the get_portfolio_rules_data RPC.
 *
 * Returns null only on network/auth error.
 * Returns an object with empty arrays if no cached data exists.
 */
export async function getPortfolioRulesData(workspaceId: string): Promise<RulesData | null> {
  const { data, error } = await supabase
    .rpc('get_portfolio_rules_data', { p_workspace_id: workspaceId });

  if (error) {
    console.warn('[rules] get_portfolio_rules_data error:', error.message);
    return null;
  }

  const d = data as any;
  return {
    actionQueue:     d?.action_queue     ?? [],
    alerts:          d?.alerts           ?? [],
    healthScores:    d?.health_scores    ?? {},
    briefingDaily:   d?.briefing_daily   ?? null,
    briefingWeekly:  d?.briefing_weekly  ?? null,
    briefingMonthly: d?.briefing_monthly ?? null,
    computedAt:      d?.computed_at      ?? null,
    expiresAt:       d?.expires_at       ?? null,
    isStale:         d?.is_stale         ?? true,
  };
}
