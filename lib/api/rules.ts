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

// Mirrors the web app's sortInsights()/selectTopInsight() in
// src/lib/portfolio-rules/engine.ts — keep both in sync. Any item due within
// 30 days wins outright (soonest first); ties otherwise fall back to severity.
const SEVERITY_ORDER: Record<RulesActionItem['severity'], number> = { critical: 0, warning: 1, info: 2 };
const DEADLINE_URGENCY_WINDOW_DAYS = 30;

/**
 * Sorts a merged action queue (rule-based items + property_insights AI
 * narratives) into one consistent priority order, so the 5-item cap in
 * RulesTab cuts off the same way regardless of which source an item came
 * from. selectTopInsight() below is just this sort's first element.
 */
export function sortActionItems(items: RulesActionItem[]): RulesActionItem[] {
  return [...items].sort((a, b) => {
    const aUrgent = a.daysUntilDeadline != null && a.daysUntilDeadline <= DEADLINE_URGENCY_WINDOW_DAYS;
    const bUrgent = b.daysUntilDeadline != null && b.daysUntilDeadline <= DEADLINE_URGENCY_WINDOW_DAYS;
    if (aUrgent && bUrgent) return (a.daysUntilDeadline ?? Infinity) - (b.daysUntilDeadline ?? Infinity);
    if (aUrgent !== bUrgent) return aUrgent ? -1 : 1;
    return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  });
}

export function selectTopInsight(items: RulesActionItem[]): RulesActionItem | null {
  return sortActionItems(items)[0] ?? null;
}

/**
 * Fetches property_insights (the nightly AI-narrative table populated by
 * refresh-property-insights) for a workspace and maps each row into a
 * RulesActionItem, mirroring the web app's property-insights.ts mapping —
 * so RulesTab and AIHeroCard can merge these in alongside the rule-based
 * action queue through the exact same list/dismiss/selectTopInsight path,
 * no separate UI needed for this source.
 */
export async function getPropertyInsightItems(workspaceId: string): Promise<RulesActionItem[]> {
  const { data, error } = await supabase
    .from('property_insights')
    .select('property_id, insight_data, expires_at, properties(name)')
    .eq('workspace_id', workspaceId)
    .gte('expires_at', new Date().toISOString());

  if (error) {
    console.warn('[rules] getPropertyInsightItems error:', error.message);
    return [];
  }

  return ((data ?? []) as any[])
    .map(mapPropertyInsightToActionItem)
    .filter((i): i is RulesActionItem => i !== null);
}

function mapPropertyInsightToActionItem(row: {
  property_id: string;
  insight_data: any;
  properties: { name: string } | null;
}): RulesActionItem | null {
  const d = row.insight_data;
  if (!d) return null;

  const propertyName = row.properties?.name ?? '';
  const topMove = d.moves?.[0];

  if (d.urgentAction?.exists) {
    return {
      propertyId:        row.property_id,
      propertyName,
      ruleId:            'ai_narrative',
      title:             `AI Insight — ${propertyName}`,
      description:       d.urgentAction.description ?? d.situationSummary ?? '',
      severity:          d.urgentAction.daysUntilDeadline != null && d.urgentAction.daysUntilDeadline <= 30 ? 'critical' : 'warning',
      annualImpact:      topMove?.annualImpact ?? null,
      action:            'View Property',
      daysUntilDeadline: d.urgentAction.daysUntilDeadline ?? null,
    };
  }

  if (!topMove && !d.situationSummary) return null;

  return {
    propertyId:        row.property_id,
    propertyName,
    ruleId:            'ai_narrative',
    title:             `AI Insight — ${propertyName}`,
    description:       topMove?.description ?? d.situationSummary ?? '',
    severity:          'info',
    annualImpact:      topMove?.annualImpact ?? null,
    action:            'View Property',
    daysUntilDeadline: null,
  };
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
