import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, SafeAreaView, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getPortfolioSummary } from '@/lib/api/properties';
import { AIHeroCard } from '@/components/home/AIHeroCard';
import { QuickStats } from '@/components/home/QuickStats';
import { RecentActivity, ActivityItem } from '@/components/home/RecentActivity';
import { Colors } from '@/constants/colors';
import type { PortfolioSummary } from '@/types';

const NOW  = new Date();
const YEAR = NOW.getFullYear();
const MON  = NOW.getMonth() + 1;
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Static insights — in production these come from /api/portfolio/insights
const INSIGHTS = [
  {
    title:           '3 tenants owe rent this month',
    body:            'Potential recovery: $5,550  •  Avg 14 days overdue',
    primaryAction:   'View Ledger',
    secondaryAction: 'Dismiss',
    onPrimary:       () => router.push('/(app)/portfolio'),
    onSecondary:     () => {},
  },
  {
    title:           '1 unit has been vacant 47 days',
    body:            'Maple St Unit 3B — losing $1,800/mo. Market avg vacancy: 18 days.',
    primaryAction:   'View Property',
    secondaryAction: 'Dismiss',
    onPrimary:       () => router.push('/(app)/portfolio'),
    onSecondary:     () => {},
  },
  {
    title:           'Refi opportunity — save $340/mo',
    body:            'Maple St rate: 7.8% vs market 6.2%. Estimated annual saving: $4,080.',
    primaryAction:   'View Analysis',
    secondaryAction: 'Dismiss',
    onPrimary:       () => {},
    onSecondary:     () => {},
  },
];

export default function HomeScreen() {
  const [userName,    setUserName]    = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [summary,     setSummary]     = useState<PortfolioSummary | null>(null);
  const [insightIdx,  setInsightIdx]  = useState(0);
  const [activity,    setActivity]    = useState<ActivityItem[]>([]);
  const [aiQuery,     setAiQuery]     = useState('');
  const [refreshing,  setRefreshing]  = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/(auth)/login'); return; }

    const firstName = user.user_metadata?.first_name ?? user.email?.split('@')[0] ?? 'there';
    setUserName(firstName);

    // Load active workspace from secure store (set during workspace-picker)
    const wsName = user.user_metadata?.current_workspace_name ?? 'My Portfolio';
    setWorkspaceName(wsName);

    const wsId = user.user_metadata?.current_workspace_id;
    if (wsId) {
      const s = await getPortfolioSummary(wsId, YEAR, MON).catch(() => null);
      if (s) setSummary(s);
    }

    // Recent activity from rent_payments
    const { data } = await supabase
      .from('rent_payments')
      .select('id, paid_date, amount_paid, status, units(label), properties(name)')
      .not('paid_date', 'is', null)
      .order('paid_date', { ascending: false })
      .limit(5);

    setActivity(
      (data ?? []).map((r: any) => ({
        id:       r.id,
        icon:     r.status === 'paid' ? '💚' : '⚠️',
        title:    'Payment received',
        subtitle: `${r.units?.label ?? 'Unit'} • ${r.properties?.name ?? ''} • $${r.amount_paid?.toLocaleString()}`,
        time:     r.paid_date ? new Date(r.paid_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
        timeColor: Colors.green,
        onPress:  () => {},
      }))
    );
  }, []);

  useEffect(() => { load(); }, [load]);

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
            <View style={styles.bellDot} />
          </TouchableOpacity>
        </View>

        {/* AI Hero Card */}
        <AIHeroCard
          insight={INSIGHTS[insightIdx]}
          total={INSIGHTS.length}
          current={insightIdx}
          onDotPress={setInsightIdx}
        />

        {/* Quick Stats */}
        {summary && (
          <QuickStats
            summary={summary}
            onPress={() => router.push('/(app)/portfolio')}
          />
        )}

        {/* Recent Activity */}
        <RecentActivity
          items={activity.length > 0 ? activity : PLACEHOLDER_ACTIVITY}
          onSeeAll={() => router.push('/(app)/portfolio')}
        />

        {/* Portfolio Health */}
        <TouchableOpacity style={styles.healthCard} activeOpacity={0.8}>
          <Text style={styles.healthIcon}>📊</Text>
          <View style={styles.healthText}>
            <Text style={styles.healthLabel}>Portfolio health score</Text>
            <Text style={styles.healthValue}>{summary?.health_score ?? 74} / 100</Text>
          </View>
          <Text style={styles.healthTrend}>↑ 3 pts</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

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

const PLACEHOLDER_ACTIVITY: ActivityItem[] = [
  { id: '1', icon: '💚', title: 'Payment received', subtitle: 'Unit 1A  •  $1,850', time: '2h ago',     timeColor: Colors.green },
  { id: '2', icon: '🔴', title: 'Expense logged',   subtitle: 'Maple St  •  Repair  •  $450', time: 'Yesterday', timeColor: Colors.textMuted },
  { id: '3', icon: '⚠️', title: 'Lease expiring',   subtitle: 'Oak Ave 2A  •  28 days', time: 'Alert',     timeColor: Colors.yellow },
];

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    paddingHorizontal: 16,
    paddingTop:     16,
    paddingBottom:  8,
  },
  greeting: { color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  workspacePill: {
    backgroundColor: Colors.aiDark,
    borderRadius:    13,
    borderWidth:     1,
    borderColor:     Colors.aiBorder,
    paddingHorizontal: 10,
    paddingVertical:   4,
  },
  workspaceLabel: { color: Colors.blue, fontSize: 10, fontWeight: '600' },
  bellBtn: { position: 'relative' },
  bellIcon: { fontSize: 20 },
  bellDot: {
    position:        'absolute',
    top:             0,
    right:           0,
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: Colors.red,
  },
  healthCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.card,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.border,
    marginHorizontal: 16,
    marginTop:       12,
    padding:         14,
    gap:             10,
  },
  healthIcon: { fontSize: 20 },
  healthText: { flex: 1 },
  healthLabel: { color: Colors.textMuted, fontSize: 11 },
  healthValue: { color: Colors.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
  healthTrend: { color: Colors.green, fontSize: 10, fontWeight: '700' },
  chevron: { color: Colors.textMuted, fontSize: 18 },
  aiBar: {
    position:        'absolute',
    bottom:          80,
    left:            0,
    right:           0,
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.card,
    borderTopWidth:  1,
    borderTopColor:  Colors.border,
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:             10,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: -2 },
    shadowOpacity:   0.04,
    shadowRadius:    8,
    elevation:       4,
  },
  aiInputWrap: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.aiDark,
    borderRadius:    23,
    borderWidth:     1.5,
    borderColor:     Colors.aiBorder,
    paddingHorizontal: 14,
    paddingVertical:   10,
    gap:             8,
  },
  aiSpark:  { color: Colors.blue, fontSize: 14, fontWeight: '700' },
  aiInput:  { flex: 1, color: Colors.text, fontSize: 12 },
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
