import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { runOptimizer } from '@/lib/api/optimizer';
import { Colors } from '@/constants/colors';
import type { OptimizationRecommendation } from '@/lib/api/optimizer';

const ACTION_COLOR: Record<string, string> = {
  hold: Colors.green,
  refi: Colors.indigo,
  sell: Colors.yellow,
  none: Colors.textMuted,
};

const ACTION_ICON: Record<string, string> = {
  hold: '📈',
  refi: '🏦',
  sell: '💰',
  none: '🔍',
};

export function OptimizerTab({ workspaceId }: { workspaceId: string }) {
  const [recs,       setRecs]       = useState<OptimizationRecommendation[]>([]);
  const [portROE,    setPortROE]    = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!workspaceId) { setLoading(false); return; }
    const { recommendations, portfolioROE } = await runOptimizer(workspaceId).catch(() => ({
      recommendations: [],
      portfolioROE: 0,
    }));
    setRecs(recommendations);
    setPortROE(portfolioROE);
    setLoading(false);
  };

  useEffect(() => { load(); }, [workspaceId]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.indigo} />
        <Text style={styles.loadingText}>Analyzing portfolio...</Text>
      </View>
    );
  }

  if (recs.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 32, marginBottom: 8 }}>📊</Text>
        <Text style={styles.emptyTitle}>No properties to optimize</Text>
        <Text style={styles.emptySub}>Add properties to your portfolio to see recommendations.</Text>
      </View>
    );
  }

  const totalOpportunity = recs.reduce((s, r) => s + r.annualBenefit, 0);

  return (
    <ScrollView
      style={styles.scroll}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.indigo} />}
    >
      {/* Summary banner */}
      <View style={styles.banner}>
        <View style={styles.bannerStat}>
          <Text style={styles.bannerValue}>{portROE}%</Text>
          <Text style={styles.bannerLabel}>Portfolio ROE</Text>
        </View>
        <View style={styles.bannerDivider} />
        <View style={styles.bannerStat}>
          <Text style={styles.bannerValue}>{recs.length}</Text>
          <Text style={styles.bannerLabel}>Properties</Text>
        </View>
        {totalOpportunity > 0 && (
          <>
            <View style={styles.bannerDivider} />
            <View style={styles.bannerStat}>
              <Text style={[styles.bannerValue, { color: Colors.green }]}>
                ${Math.round(totalOpportunity / 1000)}k
              </Text>
              <Text style={styles.bannerLabel}>Opportunity/yr</Text>
            </View>
          </>
        )}
      </View>

      <Text style={styles.sectionLabel}>RECOMMENDATIONS</Text>

      {recs.map((r) => {
        const color = ACTION_COLOR[r.bestAction];
        const icon  = ACTION_ICON[r.bestAction];
        return (
          <TouchableOpacity
            key={r.propertyId}
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => router.push({ pathname: '/(app)/portfolio/[id]', params: { id: r.propertyId } })}
          >
            {/* Header */}
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{r.propertyName}</Text>
                <View style={[styles.actionBadge, { borderColor: color }]}>
                  <Text style={[styles.actionLabel, { color }]}>{r.bestActionLabel}</Text>
                </View>
              </View>
              {r.annualBenefit > 0 && (
                <View style={styles.benefitBadge}>
                  <Text style={styles.benefitText}>+${r.annualBenefit.toLocaleString()}/yr</Text>
                </View>
              )}
            </View>

            {/* Metrics row */}
            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>
                  {r.currentROE != null ? `${r.currentROE}%` : '—'}
                </Text>
                <Text style={styles.metricLabel}>ROE</Text>
              </View>
              <View style={styles.metric}>
                <Text style={[styles.metricValue, { color: r.currentMonthlyCashFlow >= 0 ? Colors.green : Colors.red }]}>
                  {r.currentMonthlyCashFlow >= 0 ? '+' : ''}${r.currentMonthlyCashFlow.toLocaleString()}
                </Text>
                <Text style={styles.metricLabel}>Cash Flow/mo</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>${Math.round(r.equity / 1000)}k</Text>
                <Text style={styles.metricLabel}>Equity</Text>
              </View>
            </View>

            {/* Insight */}
            <Text style={styles.insight}>{r.insight}</Text>
          </TouchableOpacity>
        );
      })}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:  { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: 16, paddingTop: 16 },

  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 8, backgroundColor: Colors.bg,
  },
  loadingText: { color: Colors.textMuted, fontSize: 13, marginTop: 8 },
  emptyTitle:  { color: Colors.text, fontSize: 16, fontWeight: '700' },
  emptySub:    { color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  banner: {
    flexDirection:   'row',
    backgroundColor: Colors.card,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         16,
    marginBottom:    20,
    justifyContent:  'space-around',
  },
  bannerStat:    { alignItems: 'center', gap: 2 },
  bannerValue:   { color: Colors.text, fontSize: 18, fontWeight: '700' },
  bannerLabel:   { color: Colors.textMuted, fontSize: 10 },
  bannerDivider: { width: 1, backgroundColor: Colors.border },

  sectionLabel: {
    color: Colors.textMuted, fontSize: 9, fontWeight: '700',
    letterSpacing: 0.8, marginBottom: 10,
  },

  card: {
    backgroundColor: Colors.card,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         16,
    marginBottom:    12,
    gap:             12,
  },

  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardIcon:    { fontSize: 22, lineHeight: 28 },
  cardName:    { color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  actionBadge: {
    borderWidth: 1, borderRadius: 6, alignSelf: 'flex-start',
    paddingHorizontal: 7, paddingVertical: 2,
  },
  actionLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },

  benefitBadge: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius:    8,
    paddingHorizontal: 8,
    paddingVertical:   4,
  },
  benefitText: { color: Colors.green, fontSize: 12, fontWeight: '700' },

  metricsRow: { flexDirection: 'row', gap: 0 },
  metric:     { flex: 1, alignItems: 'center' },
  metricValue: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  metricLabel: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },

  insight: { color: Colors.textSub, fontSize: 12, lineHeight: 18 },
});
