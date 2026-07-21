import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getRentPayments, buildLedger } from '@/lib/api/rent';
import { LedgerRow } from '@/components/rent/LedgerRow';
import { RecordPaymentSheet } from '@/components/rent/RecordPaymentSheet';
import { Colors, Gradients } from '@/constants/colors';
import type { LedgerEvent, RentPayment, PaymentStatus } from '@/types';

type Filter = 'all' | 'paid' | 'overdue' | 'partial' | 'vacant';
const UNIT_ALL = 'all';

const NOW   = new Date();
const YEAR  = NOW.getFullYear();
const MONTH = NOW.getMonth() + 1;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmtAmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export default function RentLedgerScreen() {
  const { id, initialFilter } = useLocalSearchParams<{ id: string; initialFilter?: string }>();
  const insets = useSafeAreaInsets();
  const [allPayments, setAllPayments] = useState<RentPayment[]>([]);
  const [filter,     setFilter]     = useState<Filter>((initialFilter as Filter) ?? 'all');
  const [unitId,     setUnitId]     = useState<string>(UNIT_ALL);
  const [year,       setYear]       = useState(YEAR);
  const [month,      setMonth]      = useState(MONTH);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,   setSelected]   = useState<RentPayment | null>(null);
  const [showSheet,  setShowSheet]  = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    // Fetch the full history once — switching between "this month, all units" and
    // "all time, one unit" is then just client-side filtering, no re-fetch needed.
    const data = await getRentPayments(id).catch(() => []);
    setAllPayments(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const unitOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of allPayments) {
      if (p.units?.id && !seen.has(p.units.id)) seen.set(p.units.id, p.units.label);
    }
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [allPayments]);

  const isSingleUnit = unitId !== UNIT_ALL;

  // "All units" stays scoped to the selected month/year (unchanged behavior).
  // Picking one unit switches to that unit's complete history, all months.
  const payments = isSingleUnit
    ? allPayments.filter(p => p.unit_id === unitId)
    : allPayments.filter(p => p.period_year === year);

  const events = buildLedger(payments);

  // Summary: current month for "all units", all-time for a single unit.
  const summaryPayments = isSingleUnit
    ? payments.filter(p => p.charge_type === 'rent')
    : payments.filter(p => p.period_year === year && p.period_month === month && p.charge_type === 'rent');
  const totalDue   = summaryPayments.reduce((s, p) => s + p.amount_due, 0);
  const totalPaid  = summaryPayments.reduce((s, p) => s + (p.amount_paid ?? 0), 0);
  const paidCount  = summaryPayments.filter(p => p.status === 'paid').length;
  const totalCount = summaryPayments.length;
  const pct        = totalDue > 0 ? totalPaid / totalDue : 0;

  const STATUS_MAP: Record<Filter, PaymentStatus | null> = {
    all:     null,
    paid:    'paid',
    overdue: 'late',
    partial: 'partial',
    vacant:  'waived',
  };
  const filteredEvents = filter === 'all'
    ? events
    : events.filter(e => e.status === STATUS_MAP[filter]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all',     label: 'All' },
    { key: 'paid',    label: 'Paid' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'partial', label: 'Partial' },
  ];

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  return (
    <View style={[styles.root, { backgroundColor: Colors.indigo }]}>
      {/* Gradient header */}
      <LinearGradient
        colors={Gradients.primary}
        style={[styles.hero, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹ Property</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Rent Ledger</Text>
      </LinearGradient>

      {/* Scrollable content */}
      <View style={styles.body}>
        {/* Unit selector */}
        {unitOptions.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterRow}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 8 }}
          >
            <TouchableOpacity
              onPress={() => setUnitId(UNIT_ALL)}
              style={[styles.chip, unitId === UNIT_ALL && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, unitId === UNIT_ALL && styles.chipLabelActive]}>
                All Units
              </Text>
            </TouchableOpacity>
            {unitOptions.map(u => (
              <TouchableOpacity
                key={u.value}
                onPress={() => setUnitId(u.value)}
                style={[styles.chip, unitId === u.value && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, unitId === u.value && styles.chipLabelActive]}>
                  {u.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Month selector — only meaningful for the combined "all units" view;
            a single unit shows its complete history across all months. */}
        {!isSingleUnit && (
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={prevMonth} hitSlop={12}>
              <Text style={styles.navArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{MONTHS[month - 1]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={12}>
              <Text style={styles.navArrow}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Summary bar */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <Text style={styles.summaryAmount}>{fmtAmt(totalPaid)}</Text>
            <Text style={styles.summaryOf}>/ {fmtAmt(totalDue)}</Text>
          </View>
          <Text style={styles.summarySub}>
            collected  •  {paidCount} of {totalCount} {isSingleUnit ? 'charges' : 'units'} paid
            {isSingleUnit ? '  •  all time' : ''}
          </Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, {
              width: `${Math.round(pct * 100)}%` as any,
              backgroundColor: pct >= 0.8 ? Colors.green : pct >= 0.6 ? Colors.yellow : Colors.red,
            }]} />
          </View>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 8 }}
        >
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, filter === f.key && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, filter === f.key && styles.chipLabelActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={Colors.blue} />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.list}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.blue} />}
          >
            {filteredEvents.length === 0
              ? <Text style={styles.empty}>No entries for this period</Text>
              : filteredEvents.map((e, i) => (
                  <LedgerRow
                    key={`${e.sourcePayment.id}-${e.type}-${i}`}
                    event={e}
                    onPress={() => {
                      if (e.type !== 'charge' || e.sourcePayment.status === 'paid') return;
                      const tappedUnitId = e.sourcePayment.units?.id;
                      Alert.alert(
                        e.sourcePayment.units?.label ?? 'Overdue Payment',
                        `$${e.sourcePayment.amount_due.toLocaleString()} due`,
                        [
                          {
                            text: 'Contact Tenant',
                            onPress: () => {
                              if (tappedUnitId) {
                                router.push({
                                  pathname: '/(app)/portfolio/[id]/unit/[unitId]',
                                  params: { id: id!, unitId: tappedUnitId },
                                });
                              }
                            },
                          },
                          {
                            text: 'Record Payment',
                            onPress: () => { setSelected(e.sourcePayment); setShowSheet(true); },
                          },
                          { text: 'Cancel', style: 'cancel' },
                        ]
                      );
                    }}
                  />
                ))
            }
          </ScrollView>
        )}
      </View>

      {/* Record Payment Sheet */}
      {selected && (
        <RecordPaymentSheet
          payment={selected}
          visible={showSheet}
          onClose={() => { setShowSheet(false); setSelected(null); }}
          onSuccess={() => { setShowSheet(false); setSelected(null); load(); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  hero: {
    paddingHorizontal: 16,
    paddingBottom:     16,
    gap:               4,
  },
  back:  { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 2 },
  title: { color: Colors.white, fontSize: 22, fontWeight: '700' },
  body:  { flex: 1, backgroundColor: Colors.bg },
  monthNav: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   Colors.card,
    borderRadius:      10,
    borderWidth:       1,
    borderColor:       Colors.border,
    marginHorizontal:  16,
    marginTop:         12,
    paddingHorizontal: 16,
    paddingVertical:   10,
  },
  navArrow:   { color: Colors.textMuted, fontSize: 18 },
  monthLabel: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  summaryCard: {
    backgroundColor:  Colors.aiCard,
    borderRadius:     12,
    borderWidth:      1,
    borderColor:      Colors.aiBorder,
    marginHorizontal: 16,
    marginTop:        12,
    padding:          16,
    gap:              4,
  },
  summaryTop:    { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  summaryAmount: { color: Colors.text, fontSize: 22, fontWeight: '700' },
  summaryOf:     { color: Colors.textMuted, fontSize: 13 },
  summarySub:    { color: Colors.textMuted, fontSize: 11 },
  barTrack: {
    height:          5,
    backgroundColor: Colors.border,
    borderRadius:    3,
    marginTop:       8,
    overflow:        'hidden',
  },
  barFill:         { height: 5, borderRadius: 3 },
  filterRow:       { maxHeight: 56 },
  chip: {
    backgroundColor:   Colors.card,
    borderRadius:      14,
    borderWidth:       1,
    borderColor:       Colors.border,
    paddingHorizontal: 14,
    paddingVertical:   7,
  },
  chipActive:      { backgroundColor: Colors.blue, borderColor: Colors.blue },
  chipLabel:       { color: Colors.textMuted, fontSize: 12, fontWeight: '500' },
  chipLabelActive: { color: Colors.white, fontWeight: '700' },
  list:            { flex: 1 },
  empty:           { color: Colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 40 },
});
