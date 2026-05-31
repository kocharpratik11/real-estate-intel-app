import { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, SafeAreaView, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getPortfolioSummary } from '@/lib/api/properties';
import { generateAlerts } from '@/lib/api/alerts';
import { AIHeroCard } from '@/components/home/AIHeroCard';
import { RecentActivity, ActivityItem } from '@/components/home/RecentActivity';
import { Colors } from '@/constants/colors';
import type { PortfolioSummary } from '@/types';

type Insight = {
  title: string;
  body: string;
  primaryAction: string;
  secondaryAction?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
};

function makeSummaryInsight(summary: PortfolioSummary | null): Insight {
  if (!summary || summary.total_properties === 0) {
    return {
      title:         'Welcome to REI',
      body:          'Add your first property to start tracking your portfolio.',
      primaryAction: 'View Portfolio',
      onPrimary:     () => router.push('/(app)/portfolio'),
    };
  }
  const pct = Math.round(summary.collection_rate * 100);
  const title = pct >= 90
    ? 'Portfolio running smoothly ✓'
    : `${pct}% rent collected this month`;
  const vacancyNote = summary.vacancies > 0 ? `  •  ${summary.vacancies} vacant` : '';
  return {
    title,
    body:          `${summary.total_properties} ${summary.total_properties === 1 ? 'property' : 'properties'}  •  $${summary.monthly_collected.toLocaleString()} collected${vacancyNote}`,
    primaryAction: 'View Portfolio',
    onPrimary:     () => router.push('/(app)/portfolio'),
  };
}

export default function HomeScreen() {
  const [userName,      setUserName]      = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [summary,       setSummary]       = useState<PortfolioSummary | null>(null);
  const [insights,      setInsights]      = useState<Insight[]>([makeSummaryInsight(null)]);
  const [insightIdx,    setInsightIdx]    = useState(0);
  const [activity,      setActivity]      = useState<ActivityItem[]>([]);
  const [aiQuery,       setAiQuery]       = useState('');
  const [refreshing,    setRefreshing]    = useState(false);

  // Track active workspace so we can reset UI when it changes
  const activeWsId = useRef<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/(auth)/login'); return; }

    const firstName = user.user_metadata?.first_name ?? user.email?.split('@')[0] ?? 'there';
    setUserName(firstName);

    const wsName = user.user_metadata?.current_workspace_name ?? 'My Portfolio';
    const wsId   = user.user_metadata?.current_workspace_id ?? null;

    // Reset UI whenever the active workspace changes
    if (wsId !== activeWsId.current) {
      activeWsId.current = wsId;
      setInsightIdx(0);
      setAiQuery('');
      setSummary(null);
      setInsights([makeSummaryInsight(null)]);
      setActivity([]);
    }

    setWorkspaceName(wsName);
    if (!wsId) return;

    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth() + 1;

    // Load summary, alerts, and workspace property IDs in parallel
    const [summary, alerts, propsRes] = await Promise.all([
      getPortfolioSummary(wsId, year, month).catch(() => null),
      generateAlerts(wsId, year, month).catch(() => []),
      supabase.from('properties').select('id').eq('workspace_id', wsId),
    ]);

    if (summary) setSummary(summary);

    // Convert alerts → insights for the hero card
    const derived: Insight[] = alerts.map(a => ({
      title:           a.title,
      body:            a.body,
      primaryAction:   a.action.replace(' →', ''),
      secondaryAction: 'Dismiss',
      onPrimary:       () => {
        if (a.route && a.routeParams) {
          router.push({ pathname: a.route as any, params: a.routeParams });
        } else if (a.route) {
          router.push(a.route as any);
        }
      },
    }));
    setInsights(derived.length > 0 ? derived : [makeSummaryInsight(summary)]);
    setInsightIdx(0);

    // Recent activity filtered to this workspace's properties
    const propIds = (propsRes.data ?? []).map((p: any) => p.id);
    if (propIds.length > 0) {
      const { data } = await supabase
        .from('rent_payments')
        .select('id, paid_date, amount_paid, status, units(label), properties(name)')
        .in('property_id', propIds)
        .not('paid_date', 'is', null)
        .order('paid_date', { ascending: false })
        .limit(3);

      setActivity(
        (data ?? []).map((r: any) => ({
          id:        r.id,
          icon:      r.status === 'paid' ? '💚' : '⚠️',
          title:     'Payment received',
          subtitle:  `${r.units?.label ?? 'Unit'} • ${r.properties?.name ?? ''} • $${r.amount_paid?.toLocaleString()}`,
          time:      r.paid_date ? new Date(r.paid_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
          timeColor: Colors.green,
          onPress:   () => {},
        }))
      );
    } else {
      setActivity([]);
    }
  }, []);

  // Reload every time this screen comes into focus (covers workspace switch + tab return)
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

  const submitAI = () => {
    if (!aiQuery.trim()) return;
    router.push({ pathname: '/(app)/alerts', params: { query: aiQuery } });
    setAiQuery('');
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.blue} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning, {userName}</Text>
            <TouchableOpacity onPress={() => router.push('/workspace-picker')}>
              <View style={styles.workspacePill}>
                <Text style={styles.workspaceLabel}>⊞  {workspaceName || 'Select workspace'}  ▾</Text>
              </View>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => router.push('/(app)/alerts')} style={styles.bellBtn}>
            <Text style={styles.bellIcon}>🔔</Text>
            {insights.some(i => i.secondaryAction === 'Dismiss') && <View style={styles.bellDot} />}
          </TouchableOpacity>
        </View>

        {/* AI Hero Card */}
        <AIHeroCard
          insight={insights[Math.min(insightIdx, insights.length - 1)]}
          total={insights.length}
          current={Math.min(insightIdx, insights.length - 1)}
          onDotPress={setInsightIdx}
          onDismiss={dismissInsight}
        />

        {/* Recent Activity */}
        {activity.length > 0 && (
          <RecentActivity
            items={activity}
            onSeeAll={() => router.push('/(app)/portfolio')}
          />
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Ask AI bar */}
      <View style={styles.aiBar}>
        <View style={styles.aiInputWrap}>
          <Text style={styles.aiSpark}>✦</Text>
          <TextInput
            style={styles.aiInput}
            value={aiQuery}
            onChangeText={setAiQuery}
            placeholder="Ask anything about your portfolio..."
            placeholderTextColor={Colors.textMuted}
            returnKeyType="send"
            onSubmitEditing={submitAI}
            selectionColor={Colors.blue}
          />
        </View>
        <TouchableOpacity onPress={submitAI} style={styles.aiSendBtn}>
          <Text style={styles.aiSendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'flex-start',
    paddingHorizontal: 16,
    paddingTop:        16,
    paddingBottom:     8,
  },
  greeting:       { color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  workspacePill: {
    backgroundColor:   Colors.aiDark,
    borderRadius:      13,
    borderWidth:       1,
    borderColor:       Colors.aiBorder,
    paddingHorizontal: 10,
    paddingVertical:   4,
  },
  workspaceLabel: { color: Colors.blue, fontSize: 10, fontWeight: '600' },
  bellBtn:        { position: 'relative' },
  bellIcon:       { fontSize: 20 },
  bellDot: {
    position:        'absolute',
    top:             0,
    right:           0,
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: Colors.red,
  },
  aiBar: {
    position:          'absolute',
    bottom:            80,
    left:              0,
    right:             0,
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   Colors.card,
    borderTopWidth:    1,
    borderTopColor:    Colors.border,
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:               10,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: -2 },
    shadowOpacity:     0.04,
    shadowRadius:      8,
    elevation:         4,
  },
  aiInputWrap: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   Colors.aiDark,
    borderRadius:      23,
    borderWidth:       1.5,
    borderColor:       Colors.aiBorder,
    paddingHorizontal: 14,
    paddingVertical:   10,
    gap:               8,
  },
  aiSpark:    { color: Colors.blue, fontSize: 14, fontWeight: '700' },
  aiInput:    { flex: 1, color: Colors.text, fontSize: 12 },
  aiSendBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: Colors.blue,
    alignItems:      'center',
    justifyContent:  'center',
  },
  aiSendIcon: { color: Colors.white, fontSize: 18, fontWeight: '700' },
});
