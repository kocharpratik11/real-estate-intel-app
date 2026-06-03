import { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getPortfolioSummary } from '@/lib/api/properties';
import { generateAlerts } from '@/lib/api/alerts';
import { getPreferences, updatePreferences } from '@/lib/api/preferences';
import { getCachedInsights, refreshInsights } from '@/lib/api/insights';
import { AIHeroCard } from '@/components/home/AIHeroCard';
import { QuickStats } from '@/components/home/QuickStats';
import { RecentActivity, ActivityItem } from '@/components/home/RecentActivity';
import { Colors } from '@/constants/colors';
import type { PortfolioSummary, AppAlert } from '@/types';

type BriefingMode = 'daily' | 'weekly' | 'monthly';
type Insight = {
  title: string;
  body: string;
  primaryAction: string;
  secondaryAction?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
};

const BRIEFING_LABELS: Record<BriefingMode, string> = {
  daily:   "Today's Briefing",
  weekly:  'This Week',
  monthly: 'Monthly Summary',
};

function greetingFor(name: string, mode: BriefingMode): string {
  if (mode === 'weekly')  return `This week, ${name}`;
  if (mode === 'monthly') return `Monthly overview`;
  const hour = new Date().getHours();
  const salutation = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return `${salutation}, ${name}`;
}

function makeClaudeBriefingInsight(text: string, mode: BriefingMode): Insight {
  const titles: Record<BriefingMode, string> = {
    daily:   "Today's Briefing",
    weekly:  'Weekly Summary',
    monthly: 'Monthly Overview',
  };
  return {
    title:         titles[mode],
    body:          text,
    primaryAction: 'View Portfolio',
    onPrimary:     () => router.push('/(app)/portfolio'),
  };
}

function makeSummaryInsight(summary: PortfolioSummary | null): Insight {
  if (!summary || summary.total_properties === 0) {
    return {
      title:         'Welcome to Asset Brain',
      body:          'Add your first property to start tracking your portfolio performance.',
      primaryAction: 'Add Property',
      onPrimary:     () => router.push('/(app)/portfolio'),
    };
  }
  const pct = Math.round(summary.collection_rate * 100);
  return {
    title:         pct >= 90 ? 'Portfolio running smoothly' : `${pct}% rent collected this month`,
    body:          `${summary.total_properties} ${summary.total_properties === 1 ? 'property' : 'properties'}  •  $${summary.monthly_collected.toLocaleString()} collected${summary.vacancies > 0 ? `  •  ${summary.vacancies} vacant` : ''}`,
    primaryAction: 'View Portfolio',
    onPrimary:     () => router.push('/(app)/portfolio'),
  };
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const [userName,      setUserName]      = useState('there');
  const [workspaceName, setWorkspaceName] = useState('');
  const [summary,       setSummary]       = useState<PortfolioSummary | null>(null);
  const [insights,      setInsights]      = useState<Insight[]>([makeSummaryInsight(null)]);
  const [insightIdx,    setInsightIdx]    = useState(0);
  const [actionAlerts,  setActionAlerts]  = useState<AppAlert[]>([]);
  const [activity,      setActivity]      = useState<ActivityItem[]>([]);
  const [briefingMode,  setBriefingMode]  = useState<BriefingMode>('daily');
  const [refreshing,    setRefreshing]    = useState(false);
  const activeWsId = useRef<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/(auth)/login'); return; }

    const firstName    = user.user_metadata?.first_name ?? user.email?.split('@')[0] ?? 'there';
    const wsName       = user.user_metadata?.current_workspace_name ?? 'My Portfolio';
    const wsId: string = user.user_metadata?.current_workspace_id ?? '';

    setUserName(firstName);
    setWorkspaceName(wsName);

    if (wsId !== activeWsId.current) {
      activeWsId.current = wsId;
      setInsightIdx(0);
      setSummary(null);
      setInsights([makeSummaryInsight(null)]);
      setActivity([]);
      setActionAlerts([]);
    }

    if (!wsId) return;

    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth() + 1;

    const [sum, alerts, propsRes, cached, prefs] = await Promise.all([
      getPortfolioSummary(wsId, year, month).catch(() => null),
      generateAlerts(wsId, year, month).catch(() => []),
      supabase.from('properties').select('id').eq('workspace_id', wsId),
      getCachedInsights(wsId).catch(() => null),
      getPreferences().catch(() => null),
    ]);

    if (sum) setSummary(sum);
    setActionAlerts(alerts.slice(0, 6));

    // Update briefing mode from prefs (source of truth from DB)
    if (prefs) setBriefingMode(prefs.briefing_mode);

    // Use prefs value directly (avoids stale closure from briefingMode state)
    const currentMode: BriefingMode = prefs?.briefing_mode ?? 'daily';
    const claudeText: string | null =
      currentMode === 'weekly'  ? (cached?.briefing_weekly  ?? null) :
      currentMode === 'monthly' ? (cached?.briefing_monthly ?? null) :
                                   (cached?.briefing_daily   ?? null);

    // Hero card: Claude briefing first (if available), then alert-derived, then summary fallback
    const alertInsights: Insight[] = alerts.slice(0, 3).map(a => ({
      title:           a.title,
      body:            a.body,
      primaryAction:   a.action.replace(' →', ''),
      secondaryAction: 'Dismiss',
      onPrimary: () => {
        if (a.route && a.routeParams) {
          router.push({ pathname: a.route as any, params: a.routeParams });
        } else if (a.route) {
          router.push(a.route as any);
        }
      },
    }));

    const derived: Insight[] = [
      ...(claudeText ? [makeClaudeBriefingInsight(claudeText, currentMode)] : []),
      ...alertInsights,
    ];
    setInsights(derived.length > 0 ? derived : [makeSummaryInsight(sum)]);
    setInsightIdx(0);

    // Background refresh: rebuilds portfolio_insights via Edge Function (fires and forgets)
    // When complete, re-read cache and prepend updated Claude briefing
    refreshInsights(wsId).then(fresh => {
      if (!fresh) return;
      const freshText: string | null =
        currentMode === 'weekly'  ? (fresh.briefing_weekly  ?? null) :
        currentMode === 'monthly' ? (fresh.briefing_monthly ?? null) :
                                     (fresh.briefing_daily   ?? null);
      if (freshText) {
        setInsights(prev => {
          // Replace or prepend Claude insight (first item if it was a Claude one)
          const withoutClaude = prev.filter(i =>
            i.title !== "Today's Briefing" &&
            i.title !== 'Weekly Summary'   &&
            i.title !== 'Monthly Overview'
          );
          return [makeClaudeBriefingInsight(freshText, currentMode), ...withoutClaude];
        });
        setInsightIdx(0);
      }
    }).catch(() => {});

    // Recent payments
    const propIds = (propsRes.data ?? []).map((p: any) => p.id);
    if (propIds.length > 0) {
      const { data } = await supabase
        .from('rent_payments')
        .select('id, paid_date, amount_paid, status, units(label), properties(name)')
        .in('property_id', propIds)
        .not('paid_date', 'is', null)
        .order('paid_date', { ascending: false })
        .limit(20);

      setActivity(
        (data ?? []).map((r: any) => ({
          id:        r.id,
          icon:      r.status === 'paid' ? '💚' : '⚠️',
          title:     'Payment received',
          subtitle:  `${r.units?.label ?? 'Unit'}  •  ${r.properties?.name ?? ''}  •  $${r.amount_paid?.toLocaleString()}`,
          time:      r.paid_date ? new Date(r.paid_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
          rawDate:   r.paid_date ? (r.paid_date as string).slice(0, 10) : '',
          timeColor: Colors.green,
          onPress:   () => {},
        }))
      );
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const dismissInsight = useCallback(() => {
    setInsights(prev => {
      const next = prev.filter((_, i) => i !== insightIdx);
      return next.length > 0 ? next : [makeSummaryInsight(summary)];
    });
    setInsightIdx(0);
  }, [insightIdx, summary]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const hasAlerts = actionAlerts.some(a => a.severity === 'emergency');

  // Briefing mode filtering
  const visibleAlerts = actionAlerts.filter(a => {
    if (briefingMode === 'daily')  return a.severity === 'emergency';
    if (briefingMode === 'weekly') return a.severity !== 'info';
    return true;
  }).slice(0, 3);

  const cutoffDate = (() => {
    const d = new Date();
    if (briefingMode === 'daily')  d.setDate(d.getDate() - 1);
    if (briefingMode === 'weekly') d.setDate(d.getDate() - 7);
    else d.setDate(1); // monthly: start of month
    return d.toISOString().slice(0, 10);
  })();
  const visibleActivity = activity.filter(a => !a.rawDate || a.rawDate >= cutoffDate).slice(0, 3);

  return (
    <View style={styles.root}>
      {/* Gradient hero header */}
      <LinearGradient colors={['#6366F1', '#7C3AED']} style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        {/* Top row: greeting + workspace + bell */}
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greetingFor(userName, briefingMode)}</Text>
            <TouchableOpacity onPress={() => router.push('/workspace-picker')} activeOpacity={0.8}>
              <View style={styles.workspacePill}>
                <Text style={styles.workspaceLabel}>⊞  {workspaceName || 'Select workspace'}  ▾</Text>
              </View>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(app)/alerts')}
            style={styles.bellBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.bellIcon}>🔔</Text>
            {hasAlerts && <View style={styles.bellDot} />}
          </TouchableOpacity>
        </View>

        {/* Briefing mode chips */}
        <View style={styles.chips}>
          {(['daily', 'weekly', 'monthly'] as BriefingMode[]).map(mode => (
            <TouchableOpacity
              key={mode}
              style={[styles.chip, briefingMode === mode && styles.chipActive]}
              onPress={() => {
                setBriefingMode(mode);
                updatePreferences({ briefing_mode: mode }).catch(() => {});
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipLabel, briefingMode === mode && styles.chipLabelActive]}>
                {BRIEFING_LABELS[mode]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* Scrollable content */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.indigo} />}
      >
        {/* AI Hero Card */}
        <AIHeroCard
          insight={insights[Math.min(insightIdx, insights.length - 1)]}
          total={insights.length}
          current={Math.min(insightIdx, insights.length - 1)}
          onDotPress={setInsightIdx}
          onDismiss={dismissInsight}
        />

        {/* Quick Stats */}
        {summary && (
          <QuickStats summary={summary} onPress={() => router.push('/(app)/portfolio')} />
        )}

        {/* Action Queue */}
        {visibleAlerts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>ACTION QUEUE</Text>
              <TouchableOpacity onPress={() => router.push('/(app)/alerts')}>
                <Text style={styles.seeAll}>See all →</Text>
              </TouchableOpacity>
            </View>
            {visibleAlerts.map(alert => (
              <TouchableOpacity
                key={alert.id}
                style={[styles.actionRow, alert.severity === 'emergency' && styles.actionRowEmergency]}
                onPress={() => {
                  if (alert.route && alert.routeParams) {
                    router.push({ pathname: alert.route as any, params: alert.routeParams });
                  } else if (alert.route) {
                    router.push(alert.route as any);
                  }
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.severityDot, {
                  backgroundColor: alert.severity === 'emergency' ? Colors.red : Colors.yellow,
                }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>{alert.title}</Text>
                  <Text style={styles.actionSub}>{alert.property}  •  {alert.time}</Text>
                </View>
                <Text style={styles.actionCTA}>{alert.action}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recent Activity */}
        {visibleActivity.length > 0 && (
          <RecentActivity items={visibleActivity} onSeeAll={() => router.push('/(app)/portfolio')} />
        )}

        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },

  // Hero
  hero: {
    paddingHorizontal: 16,
    paddingBottom:     20,
  },
  heroTop: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   16,
  },
  greeting: { color: Colors.white, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  workspacePill: {
    backgroundColor:   'rgba(255,255,255,0.18)',
    borderRadius:      13,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.3)',
    paddingHorizontal: 10,
    paddingVertical:   4,
    alignSelf:         'flex-start',
  },
  workspaceLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: '600' },
  bellBtn:        { position: 'relative', paddingTop: 2 },
  bellIcon:       { fontSize: 20 },
  bellDot: {
    position:        'absolute',
    top:             0,
    right:           0,
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: Colors.red,
    borderWidth:     1.5,
    borderColor:     Colors.purple,
  },

  // Briefing chips
  chips:          { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical:   6,
    borderRadius:      16,
    backgroundColor:   'rgba(255,255,255,0.15)',
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.2)',
  },
  chipActive: {
    backgroundColor: Colors.white,
    borderColor:     Colors.white,
  },
  chipLabel:       { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '500' },
  chipLabelActive: { color: Colors.indigo, fontWeight: '700' },

  // Content
  scroll: { flex: 1 },
  section: { marginTop: 20, paddingHorizontal: 16, gap: 8 },
  sectionHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   4,
  },
  sectionLabel: {
    color:         Colors.textMuted,
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 0.8,
  },
  seeAll: { color: Colors.indigo, fontSize: 10 },

  // Action queue row
  actionRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.card,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         14,
    gap:             12,
  },
  actionRowEmergency: {
    borderColor:     Colors.redBd,
    backgroundColor: Colors.redBg,
  },
  severityDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  actionTitle: { color: Colors.text, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  actionSub:   { color: Colors.textMuted, fontSize: 10 },
  actionCTA:   { color: Colors.indigo, fontSize: 11, fontWeight: '600', flexShrink: 0 },
});
