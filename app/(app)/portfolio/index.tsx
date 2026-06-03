import { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { listProperties, getPortfolioSummary } from '@/lib/api/properties';
import { PropertyRow, PropertyRowData } from '@/components/portfolio/PropertyRow';
import { Colors } from '@/constants/colors';
import { hapticLight } from '@/lib/haptics';
import { isPropertySetupComplete, openWebApp } from '@/lib/utils/propertySetup';

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

const fmtValue = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
};

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const addPushing = useRef(false);
  const [properties, setProperties] = useState<PropertyRowData[]>([]);
  const [search,     setSearch]     = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [totalValue,      setTotalValue]      = useState(0);
  const [totalCF,         setTotalCF]         = useState(0);
  const [overallPct,      setOverallPct]      = useState(0);
  const [vacancies,       setVacancies]       = useState(0);
  const [incompleteCount, setIncompleteCount] = useState(0);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const wsId = user.user_metadata?.current_workspace_id;
    if (!wsId) return;

    const [props, summary] = await Promise.all([
      listProperties(wsId),
      getPortfolioSummary(wsId, YEAR, MON).catch(() => null),
    ]);

    if (summary) {
      setTotalValue(summary.total_value);
    }

    const propIds = props.map(p => p.id);

    // Fetch rent payments, all units, and active leases in parallel
    const [rentsRes, allUnitsRes] = await Promise.all([
      supabase
        .from('rent_payments')
        .select('property_id, amount_due, amount_paid, status')
        .in('property_id', propIds)
        .eq('period_year', YEAR)
        .eq('period_month', MON)
        .eq('charge_type', 'rent'),
      supabase
        .from('units')
        .select('id, property_id')
        .in('property_id', propIds),
    ]);

    const rents    = rentsRes.data ?? [];
    const allUnits = (allUnitsRes.data ?? []) as { id: string; property_id: string }[];
    const allUnitIds = allUnits.map(u => u.id);

    // Fetch active leases for occupancy
    const { data: activeLeases } = allUnitIds.length > 0
      ? await supabase.from('leases').select('unit_id').in('unit_id', allUnitIds).eq('status', 'active')
      : { data: [] as { unit_id: string }[] };

    // Build per-property maps
    const rentByProp = new Map<string, { due: number; paid: number; count: number; paidCount: number }>();
    for (const r of rents) {
      const cur = rentByProp.get(r.property_id) ?? { due: 0, paid: 0, count: 0, paidCount: 0 };
      cur.due       += r.amount_due ?? 0;
      cur.paid      += r.amount_paid ?? 0;
      cur.count     += 1;
      cur.paidCount += r.status === 'paid' ? 1 : 0;
      rentByProp.set(r.property_id, cur);
    }

    const unitToProp = new Map(allUnits.map(u => [u.id, u.property_id]));
    const occupiedByProp = new Map<string, number>();
    for (const l of activeLeases ?? []) {
      const pid = unitToProp.get(l.unit_id);
      if (pid) occupiedByProp.set(pid, (occupiedByProp.get(pid) ?? 0) + 1);
    }
    const totalUnitsByProp = new Map<string, number>();
    for (const u of allUnits) {
      totalUnitsByProp.set(u.property_id, (totalUnitsByProp.get(u.property_id) ?? 0) + 1);
    }

    const rows: PropertyRowData[] = props.map(p => {
      const r           = rentByProp.get(p.id) ?? { due: 0, paid: 0, count: 1, paidCount: 0 };
      const pct         = r.count > 0 ? r.paidCount / r.count : 0;
      const cf          = r.paid;
      const h           = toHealth(pct * 100, cf);
      const totalUnits  = totalUnitsByProp.get(p.id) ?? p.unit_count;
      const occupied    = occupiedByProp.get(p.id) ?? 0;
      const occupancy   = totalUnits > 0 ? occupied / totalUnits : 1;
      // 2-axis health score: collection 60pts + occupancy 40pts
      const healthScore = Math.round(pct * 60 + occupancy * 40);
      return { ...p, cashFlow: cf, collectionRate: pct, health: h, badgeLabel: toBadge(h, cf), healthScore };
    });

    rows.sort((a, b) => ({ critical: 0, warning: 1, healthy: 2 }[a.health] - { critical: 0, warning: 1, healthy: 2 }[b.health]));

    setProperties(rows);
    setIncompleteCount(rows.filter(r => !isPropertySetupComplete(r)).length);
    setTotalCF(rows.reduce((s, p) => s + p.cashFlow, 0));
    setVacancies(rows.reduce((s, p) => s + (p.vacancies ?? 0), 0));
    setOverallPct(rows.length > 0
      ? Math.round(rows.reduce((s, p) => s + p.collectionRate, 0) / rows.length * 100)
      : 0);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = properties.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.city.toLowerCase().includes(search.toLowerCase())
  );

  const criticalCount = properties.filter(p => p.health === 'critical').length;

  return (
    <View style={[styles.root, { backgroundColor: Colors.indigo }]}>
      {/* Gradient header */}
      <LinearGradient colors={['#6366F1', '#7C3AED']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Portfolio</Text>
        <Text style={styles.sub}>{properties.length} properties  •  {properties.reduce((s, p) => s + p.unit_count, 0)} units</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.indigo} />}
      >
        {/* Summary strip */}
        <View style={styles.summaryStrip}>
          {totalValue > 0 && (
            <>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: Colors.indigo }]}>{fmtValue(totalValue)}</Text>
                <Text style={styles.summaryLabel}>portfolio value</Text>
              </View>
              <View style={styles.summaryDivider} />
            </>
          )}
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: totalCF >= 0 ? Colors.green : Colors.red }]}>
              {totalCF >= 0 ? '+' : ''}{fmtValue(Math.abs(totalCF))}
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
            <Text style={styles.summaryLabel}>vacant</Text>
          </View>
        </View>

        {/* Incomplete setup nudge */}
        {incompleteCount > 0 && (
          <TouchableOpacity
            style={styles.setupNudge}
            onPress={openWebApp}
            activeOpacity={0.8}
          >
            <Text style={styles.nudgeSpark}>✦</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.nudgeTitle}>
                {incompleteCount} {incompleteCount === 1 ? 'property needs' : 'properties need'} full setup
              </Text>
              <Text style={styles.nudgeSub}>Add mortgage, financials & AI insights on assetbrain.app →</Text>
            </View>
          </TouchableOpacity>
        )}

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
              selectionColor={Colors.indigo}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            )}
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
          {filtered.length === 0 && search.length > 0 && (
            <Text style={styles.emptySearch}>No properties match "{search}"</Text>
          )}
        </View>

        {/* Critical alert nudge */}
        {criticalCount > 0 && (
          <TouchableOpacity
            style={styles.nudge}
            onPress={() => router.push('/(app)/alerts')}
            activeOpacity={0.8}
          >
            <Text style={styles.nudgeSpark}>✦</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.nudgeTitle}>
                {criticalCount} {criticalCount === 1 ? 'property needs' : 'properties need'} attention
              </Text>
              <Text style={styles.nudgeSub}>View AI recommendations →</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 80 }]}
        activeOpacity={0.8}
        onPress={() => {
          if (addPushing.current) return;
          addPushing.current = true;
          hapticLight();
          router.push('/(app)/portfolio/add');
          setTimeout(() => { addPushing.current = false; }, 800);
        }}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom:     20,
  },
  title:  { color: Colors.white, fontSize: 22, fontWeight: '700' },
  sub:    { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },
  scroll: { flex: 1, backgroundColor: Colors.bg },

  summaryStrip: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  Colors.card,
    borderRadius:     14,
    borderWidth:      1,
    borderColor:      Colors.border,
    marginHorizontal: 16,
    marginTop:        16,
    marginBottom:     8,
    paddingVertical:  12,
    shadowColor:      '#000',
    shadowOffset:     { width: 0, height: 1 },
    shadowOpacity:    0.05,
    shadowRadius:     4,
    elevation:        2,
  },
  summaryItem:    { flex: 1, alignItems: 'center' },
  summaryValue:   { color: Colors.text, fontSize: 15, fontWeight: '700' },
  summaryLabel:   { color: Colors.textMuted, fontSize: 9, marginTop: 2 },
  summaryDivider: { width: 1, height: 32, backgroundColor: Colors.border },

  searchRow: { paddingHorizontal: 16, paddingVertical: 8 },
  searchBar: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   Colors.card,
    borderRadius:      10,
    borderWidth:       1,
    borderColor:       Colors.border,
    paddingHorizontal: 12,
    gap:               8,
  },
  searchIcon:  { fontSize: 14 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 13, paddingVertical: 10 },
  clearIcon:   { color: Colors.textMuted, fontSize: 12 },

  list:        { gap: 0, paddingTop: 4 },
  emptySearch: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 32, marginBottom: 16 },

  setupNudge: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  Colors.aiCard,
    borderRadius:     12,
    borderWidth:      1,
    borderColor:      Colors.aiBorder,
    marginHorizontal: 16,
    marginTop:        8,
    marginBottom:     4,
    padding:          14,
    gap:              10,
  },
  nudge: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  Colors.aiCard,
    borderRadius:     12,
    borderWidth:      1,
    borderColor:      Colors.aiBorder,
    marginHorizontal: 16,
    marginTop:        8,
    padding:          14,
    gap:              10,
  },
  nudgeSpark: { color: Colors.indigo, fontSize: 16, fontWeight: '700' },
  nudgeTitle: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  nudgeSub:   { color: Colors.indigo, fontSize: 11, marginTop: 2 },

  fab: {
    position:        'absolute',
    right:           20,
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: Colors.indigo,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     Colors.indigo,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.4,
    shadowRadius:    8,
    elevation:       8,
  },
  fabIcon: { color: Colors.white, fontSize: 28, fontWeight: '300', lineHeight: 32 },
});
