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
import { getCachedInsights, refreshInsights } from '@/lib/api/insights';
import { AIHeroCard, Insight } from '@/components/home/AIHeroCard';
import { QuickStats } from '@/components/home/QuickStats';
import { RecentActivity, ActivityItem } from '@/components/home/RecentActivity';
import { Colors, Gradients } from '@/constants/colors';
import type { PortfolioSummary, AppAlert } from '@/types';

const MAX_BRIEFING_CARDS = 10;

// Dismissed briefing card ids for this app session only (module-scoped so it
// survives tab re-focus / pull-to-refresh, resets on a full app restart).
const dismissedInsightIds = new Set<string>();

function greetingFor(name: string): string {
  const hour = new Date().getHours();
  const salutation = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return `${salutation}, ${name}`;
}

function makeClaudeBriefingInsight(text: string): Insight {
  return {
    id:            'claude-briefing',
    title:         "Today's Briefing",
    body:          text,
    primaryAction: 'View Portfolio',
    onPrimary:     () => router.push('/(app)/portfolio'),
  };
}

function makeSummaryInsight(summary: PortfolioSummary | null): Insight {
  if (!summary || summary.total_properties === 0) {
    return {
      id:            'summary-fallback',
      title:         'Welcome to Asset Brain',
      body:          'Add your first property to start tracking your portfolio performance.',
      primaryAction: 'Add Property',
      onPrimary:     () => router.push('/(app)/portfolio'),
    };
  }
  const pct = Math.round(summary.collection_rate * 100);
  return {
    id:            'summary-fallback',
    title:         pct >= 90 ? 'Portfolio running smoothly' : `${pct}% rent collected this month`,
    body:          `${summary.total_properties} ${summary.total_properties === 1 ? 'property' : 'properties'}  •  $${summary.monthly_collected.toLocaleString()} collected${summary.vacancies > 0 ? `  •  ${summary.vacancies} vacant` : ''}`,
    primaryAction: 'View Portfolio',
    onPrimary:     () => router.push('/(app)/portfolio'),
  };
}

function alertToInsight(a: AppAlert): Insight {
  return {
    id:            a.id,
    title:         a.title,
    body:          a.body,
    primaryAction: a.action.replace(' →', ''),
    onPrimary: () => {
      if (a.route && a.routeParams) {
        router.push({ pathname: a.route as any, params: a.routeParams });
      } else if (a.route) {
        router.push(a.route as any);
      }
    },
  };
}

function buildBriefingCards(claudeText: string | null, alerts: AppAlert[], summary: PortfolioSummary | null): Insight[] {
  const criticalAlerts = alerts.filter(a => a.severity === 'emergency');
  const cards: Insight[] = [
    ...(claudeText ? [makeClaudeBriefingInsight(claudeText)] : []),
    ...criticalAlerts.map(alertToInsight),
  ].filter(c => !dismissedInsightIds.has(c.id));

  const capped = cards.slice(0, MAX_BRIEFING_CARDS);
  return capped.length > 0 ? capped : [makeSummaryInsight(summary)].filter(c => !dismissedInsightIds.has(c.id));
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

    const [sum, alerts, propsRes, cached] = await Promise.all([
      getPortfolioSummary(wsId, year, month).catch(() => null),
      generateAlerts(wsId, year, month).catch(() => []),
      supabase.from('properties').select('id').eq('workspace_id', wsId),
      getCachedInsights(wsId).catch(() => null),
    ]);

    if (sum) setSummary(sum);
    setActionAlerts(alerts.slice(0, 6));

    const claudeText = cached?.briefing_daily ?? null;
    setInsights(buildBriefingCards(claudeText, alerts, sum));
    setInsightIdx(0);

    // Background refresh: rebuilds portfolio_insights via Edge Function (fires and forgets)
    // When complete, re-read cache and swap in the updated Claude briefing card.
    refreshInsights(wsId).then(fresh => {
      if (!fresh?.briefing_daily) return;
      if (dismissedInsightIds.has('claude-briefing')) return;
      setInsights(prev => {
        const withoutClaude = prev.filter(i => i.id !== 'claude-briefing');
        return [makeClaudeBriefingInsight(fresh.briefing_daily as string), ...withoutClaude].slice(0, MAX_BRIEFING_CARDS);
      });
      setInsightIdx(0);
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

  const dismissInsight = useCallback((id: string) => {
    dismissedInsightIds.add(id);
    setInsights(prev => {
      const next = prev.filter(i => i.id !== id);
      return next.length > 0 ? next : [makeSummaryInsight(summary)];
    });
    setInsightIdx(0);
  }, [summary]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const hasAlerts = actionAlerts.some(a => a.severity === 'emergency');
  const visibleAlerts = actionAlerts.filter(a => a.severity === 'emergency').slice(0, 3);
  const visibleActivity = activity.slice(0, 3);

  return (
    <View style={styles.root}>
      {/* Gradient hero header */}
      <LinearGradient colors={Gradients.primary} style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greetingFor(userName)}</Text>
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
      </LinearGradient>

      {/* Scrollable content */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.blue} />}
      >
        {/* AI Hero Card */}
        <AIHeroCard
          insights={insights}
          current={insightIdx}
          onIndexChange={setInsightIdx}
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
                style={[styles.actionRow, styles.actionRowEmergency]}
                onPress={() => {
                  if (alert.route && alert.routeParams) {
                    router.push({ pathname: alert.route as any, params: alert.routeParams });
                  } else if (alert.route) {
                    router.push(alert.route as any);
                  }
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.severityDot, { backgroundColor: Colors.red }]} />
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
  },
  greeting: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 6 },
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
  seeAll: { color: Colors.blue, fontSize: 10 },

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
    borderColor:     Colors.red,
    backgroundColor: Colors.redBg,
  },
  severityDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  actionTitle: { color: Colors.text, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  actionSub:   { color: Colors.textMuted, fontSize: 10 },
  actionCTA:   { color: Colors.blue, fontSize: 11, fontWeight: '600', flexShrink: 0 },
});
