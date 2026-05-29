import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { generateAlerts } from '@/lib/api/alerts';
import { Colors } from '@/constants/colors';
import { Badge } from '@/components/ui/Badge';
import type { AppAlert } from '@/types';

const SEV_BG:    Record<string, string> = { emergency: Colors.redBg,  warning: Colors.yellowBg, info: Colors.aiDark };
const SEV_BD:    Record<string, string> = { emergency: Colors.redBd,  warning: Colors.yellowBd, info: Colors.aiBorder };
const SEV_COLOR: Record<string, string> = { emergency: Colors.red,    warning: Colors.yellow,   info: Colors.blue };

type Tab = 'Alerts' | 'Optimizer' | 'Scenarios';
const TABS: Tab[] = ['Alerts', 'Optimizer', 'Scenarios'];

const NOW   = new Date();
const YEAR  = NOW.getFullYear();
const MONTH = NOW.getMonth() + 1;

export default function AlertsScreen() {
  const [alerts,     setAlerts]     = useState<AppAlert[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab,        setTab]        = useState<Tab>('Alerts');

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const wsId = user.user_metadata?.current_workspace_id;
    if (!wsId) { setLoading(false); return; }

    const generated = await generateAlerts(wsId, YEAR, MONTH).catch(() => []);
    setAlerts(generated);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handlePress = (a: AppAlert) => {
    if (a.route) router.push(a.route as any);
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Intelligence</Text>
        <Text style={styles.sub}>{loading ? '—' : `${alerts.length} alert${alerts.length !== 1 ? 's' : ''} this month`}</Text>
      </View>

      {/* Tab pills */}
      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Alerts tab */}
      {tab === 'Alerts' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.blue} />}
        >
          {loading ? (
            <ActivityIndicator color={Colors.blue} style={{ marginTop: 48 }} />
          ) : alerts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={styles.emptyTitle}>All clear</Text>
              <Text style={styles.emptySub}>No alerts for this period.</Text>
            </View>
          ) : (
            alerts.map(a => (
              <TouchableOpacity key={a.id} activeOpacity={0.8} onPress={() => handlePress(a)}>
                <View style={[styles.card, { backgroundColor: SEV_BG[a.severity], borderColor: SEV_BD[a.severity] }]}>
                  <View style={styles.cardTop}>
                    <Badge
                      variant={a.severity === 'emergency' ? 'emergency' : a.severity === 'warning' ? 'warning' : 'info'}
                      label={a.severity.toUpperCase()}
                    />
                    <Text style={styles.cardTime}>{a.time}</Text>
                  </View>
                  <Text style={styles.cardTitle}>{a.title}</Text>
                  <Text style={styles.cardBody}>{a.body}</Text>
                  <View style={styles.cardFooter}>
                    <Text style={[styles.cardAction, { color: SEV_COLOR[a.severity] }]}>{a.action}</Text>
                    <Text style={styles.cardProperty}>{a.property}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Optimizer tab */}
      {tab === 'Optimizer' && (
        <View style={styles.soon}>
          <Text style={styles.soonIcon}>⚙️</Text>
          <Text style={styles.soonTitle}>Optimizer</Text>
          <Text style={styles.soonSub}>
            AI-powered recommendations to improve your portfolio's performance.{'\n'}Coming soon.
          </Text>
        </View>
      )}

      {/* Scenarios tab */}
      {tab === 'Scenarios' && (
        <View style={styles.soon}>
          <Text style={styles.soonIcon}>📈</Text>
          <Text style={styles.soonTitle}>Scenarios</Text>
          <Text style={styles.soonSub}>
            Model what-if scenarios: refinancing, rent increases, new acquisitions.{'\n'}Coming soon.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  title:  { color: Colors.text, fontSize: 22, fontWeight: '700' },
  sub:    { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  tabs: {
    flexDirection:     'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginHorizontal:  16,
    marginBottom:      16,
  },
  tabBtn:        { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabBtnActive:  { borderBottomColor: Colors.blue },
  tabLabel:      { color: Colors.textMuted, fontSize: 14 },
  tabLabelActive:{ color: Colors.blue, fontWeight: '600' },
  list: { paddingHorizontal: 16, gap: 12 },
  card: {
    borderRadius: 12,
    borderWidth:  1,
    padding:      16,
    gap:          8,
  },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTime:    { color: Colors.textMuted, fontSize: 10 },
  cardTitle:   { color: Colors.text, fontSize: 15, fontWeight: '700' },
  cardBody:    { color: Colors.textSub, fontSize: 12, lineHeight: 18 },
  cardFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cardAction:  { fontSize: 12, fontWeight: '600' },
  cardProperty:{ color: Colors.textMuted, fontSize: 10 },
  empty: { alignItems: 'center', paddingTop: 72, gap: 8 },
  emptyIcon:  { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptySub:   { fontSize: 13, color: Colors.textMuted },
  soon: {
    flex: 1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  soonIcon:  { fontSize: 40 },
  soonTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  soonSub:   { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
