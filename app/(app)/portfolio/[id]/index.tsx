import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getProperty, getActiveLeases } from '@/lib/api/properties';
import { Colors } from '@/constants/colors';
import { Badge } from '@/components/ui/Badge';
import type { Lease } from '@/types';

type Tab = 'units' | 'rent' | 'expenses' | 'docs';
const TABS: { key: Tab; label: string }[] = [
  { key: 'units',    label: 'Units' },
  { key: 'rent',     label: 'Rent' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'docs',     label: 'Docs' },
];

const fmt = (n: number | null) => n != null ? `$${n.toLocaleString()}` : '—';

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [property, setProperty] = useState<any>(null);
  const [leases,   setLeases]   = useState<Lease[]>([]);
  const [tab,      setTab]      = useState<Tab>('units');
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([getProperty(id), getActiveLeases(id)])
      .then(([prop, ls]) => { setProperty(prop); setLeases(ls); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.blue} />
      </SafeAreaView>
    );
  }

  if (!property) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.errorText}>Property not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Hero header */}
      <View style={styles.hero}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backLabel}>‹ Portfolio</Text>
        </TouchableOpacity>
        <Text style={styles.heroName}>{property.name}</Text>
        <Text style={styles.heroAddr}>{property.address_line1}, {property.city}, {property.state}</Text>
        <Text style={styles.heroMeta}>
          {property.property_type?.charAt(0).toUpperCase() + property.property_type?.slice(1)}  •  {property.unit_count} units
        </Text>
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        {[
          ['Value',      fmt(property.current_value)],
          ['Equity',     fmt(property.equity)],
          ['Cash Flow',  fmt(property.monthly_cash_flow)],
          ['ROE',        property.roe ? `${property.roe.toFixed(1)}%` : '—'],
        ].map(([label, val], i) => (
          <View key={label} style={styles.statItem}>
            {i > 0 && <View style={styles.statDivider} />}
            <Text style={styles.statValue}>{val}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {tab === 'units' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>UNITS</Text>
            <Text style={styles.sectionSub}>
              {property.units?.length ?? 0} units  •  {leases.length} occupied
            </Text>
            {(property.units ?? []).map((u: any) => {
              const lease = leases.find(l => l.unit_id === u.id);
              return (
                <TouchableOpacity
                  key={u.id}
                  style={styles.unitRow}
                  onPress={() => router.push({ pathname: '/(app)/portfolio/[id]/unit/[unitId]', params: { id, unitId: u.id } })}
                  activeOpacity={0.8}
                >
                  <View style={[styles.unitDot, { backgroundColor: lease ? Colors.green : Colors.border }]} />
                  <View style={styles.unitInfo}>
                    <Text style={styles.unitLabel}>{u.label}</Text>
                    <Text style={styles.unitSub}>{lease ? 'Occupied' : 'Vacant'}</Text>
                  </View>
                  {lease && <Text style={styles.unitRent}>{fmt(lease.monthly_rent)}</Text>}
                  {!lease && <Badge variant="vacant" label="Vacant" />}
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {tab === 'rent' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>RENT</Text>
            <TouchableOpacity
              style={styles.rentCTA}
              onPress={() => router.push({ pathname: '/(app)/portfolio/[id]/rent', params: { id } })}
              activeOpacity={0.8}
            >
              <View>
                <Text style={styles.rentCTATitle}>View Rent Ledger</Text>
                <Text style={styles.rentCTASub}>Payment history, charges & balances</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {tab === 'expenses' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>EXPENSES</Text>
            <Text style={styles.comingSoon}>Coming in Phase 1.5</Text>
          </View>
        )}

        {tab === 'docs' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DOCUMENTS</Text>
            <Text style={styles.comingSoon}>Coming in Phase 2</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.bg },
  hero: {
    backgroundColor: Colors.blue,
    paddingHorizontal: 16,
    paddingTop:      8,
    paddingBottom:   20,
  },
  backBtn:   { marginBottom: 8 },
  backLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  heroName:  { color: Colors.white, fontSize: 22, fontWeight: '700', marginBottom: 4 },
  heroAddr:  { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 2 },
  heroMeta:  { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  statsBar: {
    flexDirection:   'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 12, flexDirection: 'row' },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  statValue: { color: Colors.text, fontSize: 14, fontWeight: '700', flex: 1, textAlign: 'center' },
  statLabel: { display: 'none' },  // hidden on mobile; shown via tooltip on press
  tabs: {
    flexDirection:   'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabBtn: {
    flex:            1,
    paddingVertical: 12,
    alignItems:      'center',
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.blue,
  },
  tabLabel:       { color: Colors.textMuted, fontSize: 13 },
  tabLabelActive: { color: Colors.blue, fontWeight: '600' },
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionLabel: {
    color:      Colors.textMuted,
    fontSize:   9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sectionSub:  { color: Colors.textMuted, fontSize: 11, marginBottom: 12 },
  unitRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.card,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         14,
    marginBottom:    8,
    gap:             10,
  },
  unitDot:  { width: 8, height: 8, borderRadius: 4 },
  unitInfo: { flex: 1 },
  unitLabel:{ color: Colors.text, fontSize: 14, fontWeight: '600' },
  unitSub:  { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  unitRent: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  chevron:  { color: Colors.textMuted, fontSize: 18 },
  rentCTA: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    backgroundColor: Colors.card,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         16,
  },
  rentCTATitle: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  rentCTASub:   { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  errorText:    { color: Colors.red, padding: 16 },
  comingSoon:   { color: Colors.textMuted, fontSize: 13, marginTop: 8 },
});
