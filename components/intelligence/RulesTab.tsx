import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { router } from 'expo-router';
import {
  getPortfolioRulesData, getPropertyInsightItems, sortActionItems,
  dismissInsight, getDismissedInsightIds, insightIdFor,
  type RulesActionItem,
} from '@/lib/api/rules';
import { refreshInsights } from '@/lib/api/insights';
import { Colors } from '@/constants/colors';

const MAX_VISIBLE = 5;

const SNOOZE_OPTIONS: { label: string; days: number | null }[] = [
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '1 month', days: 30 },
  { label: "Don't show again", days: null },
];

const SEV_BG:    Record<string, string> = { critical: Colors.redBg,    warning: Colors.yellowBg, info: Colors.aiCard };
const SEV_BD:    Record<string, string> = { critical: Colors.redBd,    warning: Colors.yellowBd, info: Colors.aiBorder };
const SEV_COLOR: Record<string, string> = { critical: Colors.red,      warning: Colors.yellow,   info: Colors.indigo };
const SEV_LABEL: Record<string, string> = { critical: '🔴 CRITICAL',   warning: '⚠️ WARNING',    info: 'ℹ️ INFO' };

const fmt = (n: number) => `$${Math.abs(n).toLocaleString()}`;

interface Props { workspaceId: string }

export function RulesTab({ workspaceId }: Props) {
  const [items,       setItems]       = useState<RulesActionItem[]>([]);
  const [briefing,    setBriefing]    = useState<string | null>(null);
  const [computedAt,  setComputedAt]  = useState<string | null>(null);
  const [isStale,     setIsStale]     = useState(true);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [expanded,      setExpanded]     = useState(false);

  const load = async () => {
    if (!workspaceId) return;
    const [data, propertyInsightItems, dismissed] = await Promise.all([
      getPortfolioRulesData(workspaceId),
      getPropertyInsightItems(workspaceId),
      getDismissedInsightIds(workspaceId),
    ]);
    if (data) {
      setItems(sortActionItems([...data.actionQueue, ...propertyInsightItems]));
      setBriefing(data.briefingDaily ?? data.briefingWeekly ?? null);
      setComputedAt(data.computedAt);
      setIsStale(data.isStale);
    }
    setDismissedIds(dismissed);
    setLoading(false);
  };

  function handleDismissPress(item: RulesActionItem) {
    const id = insightIdFor(item);
    Alert.alert(
      'Dismiss insight',
      undefined,
      [
        ...SNOOZE_OPTIONS.map(opt => ({
          text: opt.days === null ? opt.label : `Snooze ${opt.label}`,
          onPress: async () => {
            const until = opt.days ? new Date(Date.now() + opt.days * 86_400_000).toISOString() : null;
            setDismissedIds(prev => new Set(prev).add(id));
            await dismissInsight(workspaceId, id, until);
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  }

  useEffect(() => { load(); }, [workspaceId]);

  const onRefresh = async () => {
    setRefreshing(true);
    // Trigger background refresh of AI briefings
    await refreshInsights(workspaceId).catch(() => null);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.indigo} />
      </View>
    );
  }

  const notDismissed = items.filter(i => !dismissedIds.has(insightIdFor(i)));
  const visibleItems = expanded ? notDismissed : notDismissed.slice(0, MAX_VISIBLE);
  const hiddenCount = notDismissed.length - MAX_VISIBLE;

  const critical = visibleItems.filter(i => i.severity === 'critical');
  const warning  = visibleItems.filter(i => i.severity === 'warning');
  const info     = visibleItems.filter(i => i.severity === 'info');

  const renderItem = (item: RulesActionItem) => (
    <TouchableOpacity
      key={item.ruleId + item.propertyId}
      style={[styles.card, {
        backgroundColor: SEV_BG[item.severity] ?? Colors.aiCard,
        borderColor:     SEV_BD[item.severity] ?? Colors.aiBorder,
      }]}
      onPress={() => item.propertyId && router.push(`/portfolio/${item.propertyId}` as any)}
      activeOpacity={item.propertyId ? 0.7 : 1}
    >
      <View style={styles.cardTop}>
        <Text style={[styles.sevLabel, { color: SEV_COLOR[item.severity] ?? Colors.indigo }]}>
          {SEV_LABEL[item.severity] ?? item.severity.toUpperCase()}
        </Text>
        <View style={styles.cardTopRight}>
          {item.annualImpact != null && (
            <Text style={[styles.impact, { color: item.annualImpact >= 0 ? Colors.green : Colors.red }]}>
              {item.annualImpact >= 0 ? '+' : '-'}{fmt(item.annualImpact)}/yr
            </Text>
          )}
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); handleDismissPress(item); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.dismissBtn}
          >
            <Text style={styles.dismissIcon}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      {item.propertyName ? (
        <Text style={styles.propName}>{item.propertyName}</Text>
      ) : null}
      <Text style={styles.cardDesc}>{item.description}</Text>
      {item.action ? (
        <Text style={styles.actionHint}>{item.action}</Text>
      ) : null}
    </TouchableOpacity>
  );

  const empty = notDismissed.length === 0;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.indigo} />}
    >
      {/* AI Briefing */}
      {briefing ? (
        <View style={styles.briefingCard}>
          <Text style={styles.briefingLabel}>AI DAILY BRIEFING</Text>
          <Text style={styles.briefingText}>{briefing}</Text>
          {computedAt && (
            <Text style={styles.computedAt}>
              Updated {new Date(computedAt).toLocaleDateString()}
              {isStale ? ' · Refresh to update' : ''}
            </Text>
          )}
        </View>
      ) : isStale ? (
        <TouchableOpacity style={styles.refreshPrompt} onPress={onRefresh} activeOpacity={0.8}>
          <Text style={styles.refreshPromptText}>Tap to generate AI briefing</Text>
        </TouchableOpacity>
      ) : null}

      {/* Stale notice */}
      {isStale && notDismissed.length > 0 && (
        <Text style={styles.staleNotice}>Pull to refresh for latest analysis</Text>
      )}

      {empty ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✓</Text>
          <Text style={styles.emptyTitle}>Portfolio looks healthy</Text>
          <Text style={styles.emptySub}>No action items from the rules engine. Pull to refresh.</Text>
        </View>
      ) : (
        <>
          {critical.length > 0 && (
            <>
              <Text style={styles.groupHeader}>Critical</Text>
              {critical.map(renderItem)}
            </>
          )}
          {warning.length > 0 && (
            <>
              <Text style={styles.groupHeader}>Warnings</Text>
              {warning.map(renderItem)}
            </>
          )}
          {info.length > 0 && (
            <>
              <Text style={styles.groupHeader}>Recommendations</Text>
              {info.map(renderItem)}
            </>
          )}
          {!expanded && hiddenCount > 0 && (
            <TouchableOpacity style={styles.showMoreBtn} onPress={() => setExpanded(true)}>
              <Text style={styles.showMoreText}>Show {hiddenCount} more</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: Colors.bg },
  content:       { padding: 16, paddingBottom: 40 },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  briefingCard:  { backgroundColor: Colors.aiCard, borderWidth: 1, borderColor: Colors.aiBorder, borderRadius: 12, padding: 14, marginBottom: 16 },
  briefingLabel: { fontSize: 10, fontWeight: '700', color: Colors.indigo, letterSpacing: 1, marginBottom: 6 },
  briefingText:  { fontSize: 13, color: Colors.text, lineHeight: 20 },
  computedAt:    { fontSize: 11, color: Colors.textMuted, marginTop: 8 },
  refreshPrompt: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, marginBottom: 16, alignItems: 'center' },
  refreshPromptText: { fontSize: 13, color: Colors.indigo, fontWeight: '600' },
  staleNotice:   { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginBottom: 8 },
  groupHeader:   { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  card:          { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  cardTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTopRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sevLabel:      { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  impact:        { fontSize: 12, fontWeight: '700' },
  dismissBtn:    { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dismissIcon:   { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  showMoreBtn:   { alignItems: 'center', paddingVertical: 12 },
  showMoreText:  { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  cardTitle:     { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  propName:      { fontSize: 12, color: Colors.textMuted, marginBottom: 4 },
  cardDesc:      { fontSize: 13, color: Colors.text, lineHeight: 18 },
  actionHint:    { fontSize: 12, color: Colors.indigo, marginTop: 6, fontStyle: 'italic' },
  emptyState:    { alignItems: 'center', paddingTop: 60 },
  emptyIcon:     { fontSize: 40, marginBottom: 12 },
  emptyTitle:    { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  emptySub:      { fontSize: 13, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 30 },
});
