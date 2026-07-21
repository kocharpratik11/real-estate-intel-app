import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Gradients } from '@/constants/colors';

type ActivityRow = {
  id: string;
  propertyId: string;
  icon: string;
  title: string;
  subtitle: string;
  time: string;
  timeColor: string;
};

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const [rows,       setRows]       = useState<ActivityRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const wsId: string = user?.user_metadata?.current_workspace_id ?? '';
    if (!wsId) { setRows([]); return; }

    const { data: props } = await supabase
      .from('properties')
      .select('id')
      .eq('workspace_id', wsId);
    const propIds = (props ?? []).map((p: any) => p.id);
    if (propIds.length === 0) { setRows([]); return; }

    const { data } = await supabase
      .from('rent_payments')
      .select('id, property_id, paid_date, amount_paid, status, units(label), properties(name)')
      .in('property_id', propIds)
      .not('paid_date', 'is', null)
      .order('paid_date', { ascending: false })
      .limit(100);

    setRows(
      (data ?? []).map((r: any) => ({
        id:         r.id,
        propertyId: r.property_id,
        icon:       r.status === 'paid' ? '💚' : '⚠️',
        title:      'Payment received',
        subtitle:   `${r.units?.label ?? 'Unit'}  •  ${r.properties?.name ?? ''}  •  $${r.amount_paid?.toLocaleString()}`,
        time:       r.paid_date ? new Date(r.paid_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
        timeColor:  r.status === 'paid' ? Colors.green : Colors.yellow,
      }))
    );
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={Gradients.primary} style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={styles.heroTop}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backBtn}>‹ Home</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.heroTitle}>Recent Activity</Text>
        <Text style={styles.heroSub}>All rent payments across your portfolio</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.blue} />}
      >
        {rows === null ? (
          <ActivityIndicator color={Colors.blue} style={{ marginTop: 40 }} />
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptySub}>Recorded rent payments will show up here.</Text>
          </View>
        ) : (
          rows.map(row => (
            <TouchableOpacity
              key={row.id}
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: '/(app)/portfolio/[id]/rent', params: { id: row.propertyId } })}
            >
              <Text style={styles.icon}>{row.icon}</Text>
              <View style={styles.text}>
                <Text style={styles.title}>{row.title}</Text>
                <Text style={styles.sub}>{row.subtitle}</Text>
              </View>
              <Text style={[styles.time, { color: row.timeColor }]}>{row.time}</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  hero: {
    paddingHorizontal: 16,
    paddingBottom:     20,
    gap:               4,
  },
  heroTop:   { marginBottom: 8 },
  backBtn:   { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  heroSub:   { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  scroll:    { flex: 1 },

  row: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.card,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         14,
    gap:             10,
    marginBottom:    8,
  },
  icon: { fontSize: 18, width: 24 },
  text: { flex: 1, gap: 2 },
  title: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  sub:   { color: Colors.textMuted, fontSize: 10 },
  time:  { fontSize: 10 },
  chevron: { color: Colors.textMuted, fontSize: 16 },

  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyIcon:  { fontSize: 36 },
  emptyTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  emptySub:   { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
});
