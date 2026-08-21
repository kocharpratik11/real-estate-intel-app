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
  // Days until this item's underlying deadline (lease end, loan maturity,
  // policy expiration), when it has one. Drives selectTopInsight() below.
  daysUntilDeadline?: number | null;
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

// Mirrors the web app's selectTopInsight() in src/lib/portfolio-rules/engine.ts —
// keep both in sync. Any item due within 30 days wins outright (soonest first);
// otherwise falls back to severity, since actionQueue arrives already ordered
// critical -> warning -> info by the server-side rules engine.
const SEVERITY_ORDER: Record<RulesActionItem['severity'], number> = { critical: 0, warning: 1, info: 2 };
const DEADLINE_URGENCY_WINDOW_DAYS = 30;

export function selectTopInsight(items: RulesActionItem[]): RulesActionItem | null {
  if (items.length === 0) return null;

  const withDeadline = items.filter(
    i => i.daysUntilDeadline != null && i.daysUntilDeadline <= DEADLINE_URGENCY_WINDOW_DAYS,
  );
  if (withDeadline.length > 0) {
    return [...withDeadline].sort(
      (a, b) => (a.daysUntilDeadline ?? Infinity) - (b.daysUntilDeadline ?? Infinity),
    )[0];
  }

  return [...items].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])[0];
}

// Stable id for a RulesActionItem, mirroring the web app's Insight.id shape
// (e.g. "lease_expiring_<leaseId>") so dismissal survives recomputation.
export function insightIdFor(item: RulesActionItem): string {
  return `${item.ruleId}:${item.propertyId ?? 'portfolio'}`;
}

/** Dismiss or snooze an insight. until = null means dismissed forever. */
export async function dismissInsight(
  workspaceId: string,
  insightId: string,
  until: string | null,
): Promise<void> {
  const { error } = await supabase.from('dismissed_insights').upsert(
    { workspace_id: workspaceId, insight_id: insightId, dismissed_until: until },
    { onConflict: 'workspace_id,insight_id' },
  );
  if (error) console.warn('[rules] dismissInsight error:', error.message);
}

/** Currently-active dismissals for the workspace (expired snoozes excluded). */
export async function getDismissedInsightIds(workspaceId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('dismissed_insights')
    .select('insight_id, dismissed_until')
    .eq('workspace_id', workspaceId);

  if (error) {
    console.warn('[rules] getDismissedInsightIds error:', error.message);
    return new Set();
  }

  const now = Date.now();
  const active = (data ?? []).filter(
    (d: any) => d.dismissed_until === null || new Date(d.dismissed_until).getTime() > now,
  );
  return new Set(active.map((d: any) => d.insight_id as string));
}
