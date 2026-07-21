import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getExpenses, EXPENSE_CATEGORIES, type ExpenseCategory } from '@/lib/api/expenses';
import { getProperty } from '@/lib/api/properties';
import { LogExpenseSheet } from '@/components/expenses/LogExpenseSheet';
import { Colors, Gradients } from '@/constants/colors';
import type { Expense } from '@/types';

const CATEGORY_ALL = 'all';
const NOW   = new Date();
const YEAR  = NOW.getFullYear();
const MONTH = NOW.getMonth() + 1;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map(c => [c.value, c.label])
);

const fmtAmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string) => {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function ExpenseLedgerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [propertyName, setPropertyName] = useState('');
  const [expenses,   setExpenses]   = useState<Expense[]>([]);
  const [category,   setCategory]   = useState<string>(CATEGORY_ALL);
  const [year,       setYear]       = useState(YEAR);
  const [month,      setMonth]      = useState(MONTH);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLog,    setShowLog]    = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [data, prop] = await Promise.all([
      getExpenses(id, { year, month }).catch(() => []),
      getProperty(id).catch(() => null),
    ]);
    setExpenses(data);
    if (prop) setPropertyName(prop.name);
    setLoading(false);
  }, [id, year, month]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = category === CATEGORY_ALL
    ? expenses
    : expenses.filter(e => e.category === category);

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  return (
    <View style={styles.root}>
      {/* Gradient header */}
      <LinearGradient
        colors={Gradients.primary}
        style={[styles.hero, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.heroTop}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>‹ Property</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowLog(true)} style={styles.logBtn}>
            <Text style={styles.logBtnLabel}>+ Log</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>Expense Ledger</Text>
      </LinearGradient>

      <View style={styles.body}>
        {/* Month selector */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} hitSlop={12}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{MONTHS[month - 1]} {year}</Text>
          <TouchableOpacity onPress={nextMonth} hitSlop={12}>
            <Text style={styles.navArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Summary bar */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryAmount}>{fmtAmt(total)}</Text>
          <Text style={styles.summarySub}>
            {filtered.length} {filtered.length === 1 ? 'expense' : 'expenses'}
            {category !== CATEGORY_ALL ? `  •  ${CATEGORY_LABEL[category] ?? category}` : ''}
          </Text>
        </View>

        {/* Category filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 8 }}
        >
          <TouchableOpacity
            onPress={() => setCategory(CATEGORY_ALL)}
            style={[styles.chip, category === CATEGORY_ALL && styles.chipActive]}
          >
            <Text style={[styles.chipLabel, category === CATEGORY_ALL && styles.chipLabelActive]}>All</Text>
          </TouchableOpacity>
          {EXPENSE_CATEGORIES.map(c => (
            <TouchableOpacity
              key={c.value}
              onPress={() => setCategory(c.value)}
              style={[styles.chip, category === c.value && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, category === c.value && styles.chipLabelActive]}>
                {c.label}
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
            {filtered.length === 0 ? (
              <TouchableOpacity style={styles.emptyState} onPress={() => setShowLog(true)} activeOpacity={0.8}>
                <Text style={styles.emptyIcon}>🧾</Text>
                <Text style={styles.emptyTitle}>No expenses this month</Text>
                <Text style={styles.emptySub}>Tap to log one</Text>
              </TouchableOpacity>
            ) : (
              filtered.map(e => (
                <View key={e.id} style={styles.row}>
                  <View style={styles.dateCol}>
                    <Text style={styles.dateMonth}>
                      {new Date(e.expense_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                    </Text>
                    <Text style={styles.dateDay}>
                      {new Date(e.expense_date + 'T00:00:00').getDate()}
                    </Text>
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowCategory}>{CATEGORY_LABEL[e.category] ?? e.category}</Text>
                    {e.description && <Text style={styles.rowDesc} numberOfLines={1}>{e.description}</Text>}
                    {e.vendor && <Text style={styles.rowVendor}>{e.vendor}</Text>}
                  </View>
                  <Text style={styles.rowAmount}>{fmtAmt(e.amount)}</Text>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>

      <LogExpenseSheet
        propertyId={id ?? ''}
        propertyName={propertyName}
        visible={showLog}
        onClose={() => setShowLog(false)}
        onSuccess={() => { setShowLog(false); load(); }}
      />
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
  heroTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  back:  { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  logBtn: {
    backgroundColor:   'rgba(255,255,255,0.18)',
    borderRadius:      8,
    paddingHorizontal: 12,
    paddingVertical:   6,
  },
  logBtnLabel: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  title: { color: Colors.white, fontSize: 22, fontWeight: '700', marginTop: 4 },
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
  summaryAmount: { color: Colors.text, fontSize: 22, fontWeight: '700' },
  summarySub:    { color: Colors.textMuted, fontSize: 11 },
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
  list: { flex: 1 },

  row: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    backgroundColor: Colors.card,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         14,
    marginBottom:    8,
    gap:             12,
  },
  dateCol: { alignItems: 'center', minWidth: 32 },
  dateMonth: { color: Colors.blue, fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
  dateDay:   { color: Colors.text, fontSize: 18, fontWeight: '700', lineHeight: 22 },
  rowInfo: { flex: 1, gap: 2 },
  rowCategory: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  rowDesc:     { color: Colors.textMuted, fontSize: 11 },
  rowVendor:   { color: Colors.textMuted, fontSize: 10 },
  rowAmount:   { color: Colors.text, fontSize: 15, fontWeight: '700', flexShrink: 0 },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyIcon:  { fontSize: 36 },
  emptyTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  emptySub:   { color: Colors.textMuted, fontSize: 13 },
});
