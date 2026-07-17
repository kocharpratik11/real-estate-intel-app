import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { generateAlerts } from '@/lib/api/alerts';
import { OptimizerTab } from '@/components/intelligence/OptimizerTab';
import { ScenariosTab } from '@/components/intelligence/ScenariosTab';
import { RulesTab } from '@/components/intelligence/RulesTab';
import { Colors, Gradients } from '@/constants/colors';
import type { AppAlert } from '@/types';

const SEV_BG:    Record<string, string> = { emergency: Colors.redBg,    warning: Colors.yellowBg, info: Colors.aiCard };
const SEV_BD:    Record<string, string> = { emergency: Colors.redBd,    warning: Colors.yellowBd, info: Colors.aiBorder };
const SEV_COLOR: Record<string, string> = { emergency: Colors.red,      warning: Colors.yellow,   info: Colors.indigo };
const SEV_LABEL: Record<string, string> = { emergency: '🔴 EMERGENCY',  warning: '⚠️ WARNING',    info: 'ℹ️ INFO' };

type Tab = 'Alerts' | 'Optimizer' | 'Scenarios' | 'Rules';
const TABS: Tab[] = ['Alerts', 'Optimizer', 'Scenarios', 'Rules'];

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const [alerts,      setAlerts]      = useState<AppAlert[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [tab,         setTab]         = useState<Tab>('Alerts');

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const wsId = user.user_metadata?.current_workspace_id ?? '';
    setWorkspaceId(wsId);
    if (!wsId) { setLoading(false); return; }

    const now   = new Date();
    const generated = await generateAlerts(wsId, now.getFullYear(), now.getMonth() + 1).catch(() => []);
    setAlerts(generated);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handlePress = (a: AppAlert) => {
    if (!a.route) return;
    if (a.routeParams) {
      router.push({ pathname: a.route as any, params: a.routeParams });
    } else {
      router.push(a.route as any);
    }
  };

  const emergency = alerts.filter(a => a.severity === 'emergency');
  const warning   = alerts.filter(a => a.severity === 'warning');
  const info      = alerts.filter(a => a.severity === 'info');

  return (
    <View style={[styles.root, { backgroundColor: Colors.indigo }]}>
      {/* Gradient header */}
      <LinearGradient colors={Gradients.primary} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Intelligence</Text>
        <Text style={styles.sub}>
          {tab === 'Alerts'
            ? loading
              ? 'Loading...'
              : alerts.length === 0
                ? 'All clear'
                : `${alerts.length} alert${alerts.length !== 1 ? 's' : ''} this month`
            : tab === 'Optimizer'
            ? 'AI-powered portfolio recommendations'
            : tab === 'Scenarios'
            ? 'Model scenarios for each property'
            : 'Rules engine analysis & AI briefing'}
        </Text>
      </LinearGradient>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ALERTS TAB */}
      {tab === 'Alerts' && (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.indigo} />}
        >
          {loading ? (
            <ActivityIndicator color={Colors.indigo} style={{ marginTop: 48 }} />
          ) : alerts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={styles.emptyTitle}>All clear</Text>
              <Text style={styles.emptySub}>No alerts for this period. Your portfolio is looking healthy.</Text>
            </View>
          ) : (
            <>
              {[
                { label: 'EMERGENCY', items: emergency },
                { label: 'WARNINGS',  items: warning },
                { label: 'INFO',      items: info },
              ].filter(g => g.items.length > 0).map(group => (
                <View key={group.label} style={styles.group}>
                  <Text style={styles.groupLabel}>{group.label}</Text>
                  {group.items.map(a => (
                    <TouchableOpacity key={a.id} activeOpacity={0.8} onPress={() => handlePress(a)}>
                      <View style={[styles.card, { backgroundColor: SEV_BG[a.severity], borderColor: SEV_BD[a.severity] }]}>
                        <View style={styles.cardTop}>
                          <View style={[styles.sevPill, { borderColor: SEV_COLOR[a.severity] }]}>
                            <Text style={[styles.sevLabel, { color: SEV_COLOR[a.severity] }]}>
                              {SEV_LABEL[a.severity]}
                            </Text>
                          </View>
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
                  ))}
                </View>
              ))}
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* OPTIMIZER TAB */}
      {tab === 'Optimizer' && <OptimizerTab workspaceId={workspaceId} />}

      {/* SCENARIOS TAB */}
      {tab === 'Scenarios' && <ScenariosTab workspaceId={workspaceId} />}

      {/* RULES TAB */}
      {tab === 'Rules' && <RulesTab workspaceId={workspaceId} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },

  header: {
    paddingHorizontal: 16,
    paddingBottom:     16,
  },
  title: { color: Colors.white, fontSize: 22, fontWeight: '700' },
  sub:   { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },

  tabBar: {
    flexDirection:     'row',
    backgroundColor:   Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabBtn: {
    flex:              1,
    paddingVertical:   12,
    alignItems:        'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive:   { borderBottomColor: Colors.indigo },
  tabLabel:       { color: Colors.textMuted, fontSize: 13 },
  tabLabelActive: { color: Colors.indigo, fontWeight: '600' },

  scroll: { flex: 1, backgroundColor: Colors.bg },
  list:   { paddingHorizontal: 16, paddingTop: 16, gap: 0 },

  group:      { marginBottom: 20 },
  groupLabel: {
    color:         Colors.textMuted,
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 0.8,
    marginBottom:  8,
  },

  card: {
    borderRadius: 12,
    borderWidth:  1,
    padding:      16,
    gap:          8,
    marginBottom: 8,
  },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTime:   { color: Colors.textMuted, fontSize: 10 },
  cardTitle:  { color: Colors.text, fontSize: 15, fontWeight: '700' },
  cardBody:   { color: Colors.textSub, fontSize: 12, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cardAction: { fontSize: 12, fontWeight: '600' },
  cardProperty: { color: Colors.textMuted, fontSize: 10 },

  sevPill: {
    borderRadius:      6,
    borderWidth:       1,
    paddingHorizontal: 7,
    paddingVertical:   2,
  },
  sevLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 0.3 },

  empty:      { alignItems: 'center', paddingTop: 72, gap: 8 },
  emptyIcon:  { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptySub:   { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },
});
