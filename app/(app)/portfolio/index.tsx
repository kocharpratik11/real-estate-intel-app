import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { listProperties } from '@/lib/api/properties';
import { PropertyRow, PropertyRowData } from '@/components/portfolio/PropertyRow';
import { Colors } from '@/constants/colors';
import type { Property } from '@/types';

const NOW  = new Date();
const YEAR = NOW.getFullYear();
const MON  = NOW.getMonth() + 1;

function toHealth(pct: number, cf: number): PropertyRowData['health'] {
  if (cf < 0 || pct < 60) return 'critical';
  if (pct < 80) return 'warning';
  return 'healthy';
}

function toBadge(h: PropertyRowData['health'], cf: number): string {
  if (h === 'critical') return cf < 0 ? 'Cash flow neg.' : 'Needs attention';
  if (h === 'warning')  return 'Some overdue';
  return 'All paid';
}

export default function PortfolioScreen() {
  const [properties, setProperties] = useState<PropertyRowData[]>([]);
  const [search,     setSearch]     = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [totalValue, setTotalValue] = useState(0);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const wsId = user.user_metadata?.current_workspace_id;
    if (!wsId) return;

    const props = await listProperties(wsId);

    // Fetch this month's rent payments for all properties in one query
    const propIds = props.map(p => p.id);
    const { data: rents } = await supabase
      .from('rent_payments')
      .select('property_id, amount_due, amount_paid, status')
      .in('property_id', propIds)
      .eq('period_year', YEAR)
      .eq('period_month', MON)
      .eq('charge_type', 'rent');

    const rentByProp = new Map<string, { due: number; paid: number; count: number; paidCount: number }>();
    for (const r of rents ?? []) {
      const cur = rentByProp.get(r.property_id) ?? { due: 0, paid: 0, count: 0, paidCount: 0 };
      cur.due       += r.amount_due ?? 0;
      cur.paid      += r.amount_paid ?? 0;
      cur.count     += 1;
      cur.paidCount += r.status === 'paid' ? 1 : 0;
      rentByProp.set(r.property_id, cur);
    }

    const rows: PropertyRowData[] = props.map(p => {
      const r   = rentByProp.get(p.id) ?? { due: 0, paid: 0, count: 1, paidCount: 0 };
      const pct = r.count > 0 ? r.paidCount / r.count : 0;
      const cf  = r.paid;
      const h   = toHealth(pct * 100, cf);
      return { ...p, cashFlow: cf, collectionRate: pct, health: h, badgeLabel: toBadge(h, cf) };
    });

    // Sort: critical first, then warning, then healthy
    rows.sort((a, b) => {
      const order = { critical: 0, warning: 1, healthy: 2 };
      return order[a.health] - order[b.health];
    });

    setProperties(rows);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = properties.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.city.toLowerCase().includes(search.toLowerCase())
  );

  const totalCF  = properties.reduce((s, p) => s + p.cashFlow, 0);
  const overallPct = properties.length > 0
    ? Math.round(properties.reduce((s, p) => s + p.collectionRate, 0) / properties.length * 100)
    : 0;
  const vacancies = properties.reduce((s, p) => s + (p.vacancies ?? 0), 0);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.blue} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Portfolio</Text>
          <Text style={styles.sub}>{properties.length} properties  •  {properties.reduce((s,p)=>s+p.unit_count,0)} units total</Text>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search properties..."
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.blue}
            />
          </View>
        </View>

        {/* Summary strip */}
        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: Colors.green }]}>
              {totalCF >= 0 ? '+' : ''}{totalCF >= 1000 ? `$${(totalCF/1000).toFixed(1)}k` : `$${totalCF}`}
            </Text>
            <Text style={styles.summaryLabel}>/ mo cash flow</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{overallPct}%</Text>
            <Text style={styles.summaryLabel}>collected</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: vacancies > 0 ? Colors.red : Colors.text }]}>
              {vacancies}
            </Text>
            <Text style={styles.summaryLabel}>vacancy</Text>
          </View>
        </View>

        {/* Property list */}
        <View style={styles.list}>
          {filtered.map(p => (
            <PropertyRow
              key={p.id}
              property={p}
              onPress={() => router.push({ pathname: '/(app)/portfolio/[id]', params: { id: p.id } })}
            />
          ))}
        </View>

        {/* AI nudge */}
        {properties.some(p => p.health === 'critical') && (
          <TouchableOpacity style={styles.aiNudge} activeOpacity={0.8}>
            <Text style={styles.aiNudgeSpark}>✦</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiNudgeTitle}>
                {properties.filter(p => p.health === 'critical').length} {properties.filter(p => p.health === 'critical').length === 1 ? 'property needs' : 'properties need'} attention
              </Text>
              <Text style={styles.aiNudgeSub}>View AI recommendations →</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.8}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  title:  { color: Colors.text, fontSize: 22, fontWeight: '700' },
  sub:    { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  searchRow: {
    flexDirection:   'row',
    paddingHorizontal: 16,
    paddingVertical:   12,
    gap:             8,
  },
  searchBar: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.card,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     Colors.border,
    paddingHorizontal: 12,
    gap:             8,
  },
  searchIcon:  { fontSize: 14 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 13, paddingVertical: 10 },
  summaryStrip: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.aiDark,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.aiBorder,
    marginHorizontal: 16,
    paddingVertical:  12,
    marginBottom:    16,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  summaryLabel: { color: Colors.textMuted, fontSize: 9, marginTop: 2 },
  summaryDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  list: { gap: 0 },
  aiNudge: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.aiDark,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.aiBorder,
    marginHorizontal: 16,
    marginTop:       8,
    padding:         14,
    gap:             10,
  },
  aiNudgeSpark: { color: Colors.blue, fontSize: 16, fontWeight: '700' },
  aiNudgeTitle: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  aiNudgeSub:   { color: Colors.blue, fontSize: 11, marginTop: 2 },
  fab: {
    position:        'absolute',
    bottom:          96,
    right:           20,
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: Colors.blue,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     Colors.blue,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.4,
    shadowRadius:    8,
    elevation:       8,
  },
  fabIcon: { color: Colors.white, fontSize: 28, fontWeight: '300', lineHeight: 32 },
});
