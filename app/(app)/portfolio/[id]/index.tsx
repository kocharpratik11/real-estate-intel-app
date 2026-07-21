import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getProperty, getActiveLeases, getPropertyMetrics } from '@/lib/api/properties';
import type { PropertyMetrics } from '@/types';
import { isPropertySetupComplete } from '@/lib/utils/propertySetup';
import { WebSetupNudge } from '@/components/ui/WebSetupNudge';
import { getPropertyHealthScore, scoreColor, scoreLabel } from '@/lib/api/healthScore';
import { Colors, Gradients } from '@/constants/colors';
import { Badge } from '@/components/ui/Badge';
import { LogExpenseSheet } from '@/components/expenses/LogExpenseSheet';
import { NewTicketSheet } from '@/components/maintenance/NewTicketSheet';
import { CollectionBarChart, type MonthlyCollection } from '@/components/charts/CollectionBarChart';
import { PLBarChart } from '@/components/charts/PLBarChart';
import { getPLSummary, type MonthlyPL } from '@/lib/api/financials';
import { MAINTENANCE_CATEGORIES } from '@/lib/api/maintenance';
import type { Lease, Expense, MaintenanceEvent } from '@/types';
import type { HealthScoreResult } from '@/lib/api/healthScore';

type Tab = 'units' | 'rent' | 'equity' | 'expenses' | 'maintenance' | 'docs';
const TABS: { key: Tab; label: string }[] = [
  { key: 'units',       label: 'Units' },
  { key: 'rent',        label: 'Rent' },
  { key: 'equity',      label: 'Equity' },
  { key: 'expenses',    label: 'Expenses' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'docs',        label: 'Docs' },
];

const fmt    = (n: number | null | undefined) => n != null ? `$${n.toLocaleString()}` : '—';
const fmtPct = (n: number | null | undefined) => n != null ? `${n.toFixed(1)}%` : '—';

const PRIORITY_COLOR: Record<string, string> = {
  urgent: Colors.red,
  high:   Colors.yellow,
  normal: Colors.textMuted,
  low:    Colors.textMuted,
};

const STATUS_LABEL: Record<string, string> = {
  requested:   'Requested',
  scheduled:   'Scheduled',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
};

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [property,    setProperty]    = useState<any>(null);
  const [leases,      setLeases]      = useState<Lease[]>([]);
  const [expenses,    setExpenses]    = useState<Expense[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceEvent[]>([]);
  const [healthScore, setHealthScore] = useState<HealthScoreResult | null>(null);
  const [metrics,     setMetrics]     = useState<PropertyMetrics | null>(null);
  const [tab,         setTab]         = useState<Tab>('units');
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [showExpense,   setShowExpense]   = useState(false);
  const [showTicket,    setShowTicket]    = useState(false);
  const [chartData,     setChartData]     = useState<MonthlyCollection[]>([]);
  const [plData,        setPLData]        = useState<MonthlyPL[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    const now = new Date();
    const [prop, ls, m] = await Promise.all([
      getProperty(id),
      getActiveLeases(id),
      getPropertyMetrics(id, now.getFullYear(), now.getMonth() + 1).catch(() => null),
    ]);
    setProperty(prop);
    setLeases(ls);
    setMetrics(m);
  }, [id]);

  const loadExpenses = useCallback(async () => {
    if (!id) return;
    const [{ data }, plResult] = await Promise.all([
      supabase
        .from('expenses')
        .select('id, property_id, unit_id, category, amount, expense_date, description, vendor')
        .eq('property_id', id)
        .order('expense_date', { ascending: false })
        .limit(30),
      getPLSummary(id, 6).catch(() => [] as MonthlyPL[]),
    ]);
    setExpenses((data ?? []) as Expense[]);
    setPLData(plResult);
  }, [id]);

  const loadChartData = useCallback(async () => {
    if (!id) return;
    // Last 6 months of rent collection
    const now = new Date();
    const months: { year: number; month: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    const results: MonthlyCollection[] = await Promise.all(
      months.map(async ({ year, month }) => {
        const { data } = await supabase
          .from('rent_payments')
          .select('amount_due, amount_paid, status')
          .eq('property_id', id)
          .eq('period_year', year)
          .eq('period_month', month)
          .eq('charge_type', 'rent');
        const rows = data ?? [];
        return {
          month,
          year,
          collected: rows.reduce((s: number, r: any) => s + (r.amount_paid ?? 0), 0),
          expected:  rows.reduce((s: number, r: any) => s + (r.amount_due  ?? 0), 0),
        };
      })
    );
    setChartData(results.filter(r => r.expected > 0));
  }, [id]);

  const loadMaintenance = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('maintenance_events')
      .select('id, property_id, unit_id, title, description, category, status, priority, requested_date, scheduled_date, estimated_cost, actual_cost')
      .eq('property_id', id)
      .neq('status', 'cancelled')
      .order('requested_date', { ascending: false })
      .limit(30);
    setMaintenance((data ?? []) as MaintenanceEvent[]);
  }, [id]);

  useEffect(() => {
    const now = new Date();
    Promise.all([
      load(),
      loadExpenses(),
      loadMaintenance(),
      loadChartData(),
      id
        ? getPropertyHealthScore(id, now.getFullYear(), now.getMonth() + 1)
            .then(setHealthScore)
            .catch(() => null)
        : Promise.resolve(null),
    ]).finally(() => setLoading(false));
  }, [load, loadExpenses, loadMaintenance, loadChartData]);

  useFocusEffect(useCallback(() => {
    if (!loading) {
      load();
      if (tab === 'expenses') loadExpenses();
      if (tab === 'maintenance') loadMaintenance();
    }
  }, [loading, tab, load, loadExpenses, loadMaintenance]));

  // Load tab data on demand when switching tabs
  const onTabPress = (t: Tab) => {
    setTab(t);
    if (t === 'expenses')    loadExpenses();
    if (t === 'maintenance') loadMaintenance();
    if (t === 'rent')        loadChartData();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), loadExpenses(), loadMaintenance()]);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.indigo} />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={styles.root}>
        <Text style={styles.errorText}>Property not found</Text>
      </View>
    );
  }

  // Use RPC-computed monthly cash flow (correct: NOI - debt service, no double-counting)
  const monthlyCF = metrics?.monthly_cash_flow ?? null;
  const openTickets = maintenance.filter(m => m.status !== 'completed').length;
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <View style={[styles.root, { backgroundColor: Colors.indigo }]}>
      {/* Gradient hero */}
      <LinearGradient colors={Gradients.primary} style={[styles.hero, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backLabel}>‹ Portfolio</Text>
        </TouchableOpacity>
        <Text style={styles.heroName} numberOfLines={1}>{property.name}</Text>
        <Text style={styles.heroAddr}>{property.address_line1}, {property.city}, {property.state}</Text>
        <Text style={styles.heroMeta}>
          {property.property_type?.toUpperCase()}  •  {property.units?.length ?? 0} units
        </Text>
      </LinearGradient>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        {[
          { label: 'Value',     value: fmt(metrics?.current_value    ?? property.current_market_value) },
          { label: 'Equity',    value: fmt(metrics?.equity           ?? property.total_equity) },
          { label: 'Cash Flow', value: fmt(monthlyCF) },
          { label: 'ROE',       value: fmtPct(metrics?.roe           ?? property.roe_percentage) },
        ].map(({ label, value }, i) => (
          <View key={label} style={styles.statItem}>
            {i > 0 && <View style={styles.statDivider} />}
            <View style={styles.statContent}>
              <Text style={styles.statValue}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Health Score Card */}
      {healthScore != null && (
        <View style={styles.healthCard}>
          <View style={styles.healthLeft}>
            <Text style={[styles.healthNum, { color: scoreColor(healthScore.score) }]}>
              {healthScore.score}
            </Text>
            <Text style={styles.healthDenom}>/100</Text>
            <View style={[styles.healthBadge, {
              backgroundColor: healthScore.score >= 80 ? Colors.greenBg : healthScore.score >= 60 ? Colors.yellowBg : Colors.redBg,
              borderColor:     scoreColor(healthScore.score),
            }]}>
              <Text style={[styles.healthBadgeText, { color: scoreColor(healthScore.score) }]}>
                {scoreLabel(healthScore.score).toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.healthAxes}>
            {[
              { label: 'Collection', pts: healthScore.collection,  max: 40 },
              { label: 'Occupancy',  pts: healthScore.occupancy,   max: 20 },
              { label: 'Leases',     pts: healthScore.leaseHealth, max: 20 },
              { label: 'Maint.',     pts: healthScore.maintenance, max: 20 },
            ].map(({ label, pts, max }) => (
              <View key={label} style={styles.axisRow}>
                <Text style={styles.axisLabel}>{label}</Text>
                <View style={styles.axisTrack}>
                  <View style={[styles.axisFill, {
                    width: `${Math.round((pts / max) * 100)}%` as any,
                    backgroundColor: scoreColor(healthScore.score),
                  }]} />
                </View>
                <Text style={styles.axisPts}>{pts}/{max}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} onPress={() => onTabPress(t.key)} style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}>
              <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
              {t.key === 'maintenance' && openTickets > 0 && (
                <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{openTickets}</Text></View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.indigo} />}
      >
        {/* Setup nudge — shown until property is configured on web */}
        {!isPropertySetupComplete(property) && (
          <View style={styles.nudgeWrap}>
            <WebSetupNudge
              propertyId={property.id}
              title="Complete setup on assetbrain.app"
              subtitle="Add mortgage details, AI financials & documents to unlock full insights"
            />
          </View>
        )}

        {/* UNITS TAB */}
        {tab === 'units' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>UNITS</Text>
            <Text style={styles.sectionSub}>{property.units?.length ?? 0} units  •  {leases.length} occupied</Text>
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
                  {lease && <Text style={styles.unitRent}>{fmt(lease.monthly_rent)}/mo</Text>}
                  {!lease && <Text style={styles.createLeaseHint}>+ Lease</Text>}
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* RENT TAB */}
        {tab === 'rent' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>RENT LEDGER</Text>
            {chartData.length > 0 && (
              <CollectionBarChart data={chartData} title="6-Month Collection" />
            )}
            <TouchableOpacity
              style={styles.ctaRow}
              onPress={() => router.push({ pathname: '/(app)/portfolio/[id]/rent', params: { id } })}
              activeOpacity={0.8}
            >
              <View style={styles.ctaIcon}>
                <Text style={styles.ctaIconText}>💳</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ctaTitle}>View Rent Ledger</Text>
                <Text style={styles.ctaSub}>Payment history, charges & balances</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* EQUITY TAB */}
        {tab === 'equity' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>EQUITY & FINANCING</Text>
            <TouchableOpacity
              style={styles.ctaRow}
              onPress={() => router.push({ pathname: '/(app)/portfolio/[id]/equity', params: { id } })}
              activeOpacity={0.8}
            >
              <View style={styles.ctaIcon}>
                <Text style={styles.ctaIconText}>📈</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ctaTitle}>View Equity & Loans</Text>
                <Text style={styles.ctaSub}>Current value, LTV, and financing structures</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* EXPENSES TAB */}
        {tab === 'expenses' && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionLabel}>EXPENSES</Text>
                <Text style={styles.sectionSub}>{expenses.length} records  •  {fmt(totalExpenses)} total</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowExpense(true)}
                style={styles.addBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.addBtnLabel}>+ Log</Text>
              </TouchableOpacity>
            </View>
            {plData.length > 0 && (
              <PLBarChart data={plData} title="6-MONTH P&L" />
            )}
            <TouchableOpacity
              style={styles.ctaRow}
              onPress={() => router.push({ pathname: '/(app)/portfolio/[id]/expenses', params: { id } })}
              activeOpacity={0.8}
            >
              <View style={styles.ctaIcon}>
                <Text style={styles.ctaIconText}>🧾</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ctaTitle}>View Expense Ledger</Text>
                <Text style={styles.ctaSub}>Full history by category & month</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* MAINTENANCE TAB */}
        {tab === 'maintenance' && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionLabel}>MAINTENANCE</Text>
                <Text style={styles.sectionSub}>{openTickets} open  •  {maintenance.length} total</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowTicket(true)}
                style={styles.addBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.addBtnLabel}>+ New</Text>
              </TouchableOpacity>
            </View>
            {maintenance.length === 0 ? (
              <TouchableOpacity style={styles.emptyState} onPress={() => setShowTicket(true)} activeOpacity={0.8}>
                <Text style={styles.emptyIcon}>🔧</Text>
                <Text style={styles.emptyTitle}>No maintenance tickets</Text>
                <Text style={styles.emptySub}>Tap to submit your first ticket</Text>
              </TouchableOpacity>
            ) : (
              maintenance.map(m => (
                <View key={m.id} style={[
                  styles.maintenanceRow,
                  m.priority === 'urgent' && styles.maintenanceUrgent,
                ]}>
                  <View style={styles.maintenanceTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.maintenanceTitle}>{m.title}</Text>
                      {m.description && (
                        <Text style={styles.maintenanceDesc} numberOfLines={2}>{m.description}</Text>
                      )}
                    </View>
                    <View style={[styles.priorityPill, { borderColor: PRIORITY_COLOR[m.priority] }]}>
                      <Text style={[styles.priorityText, { color: PRIORITY_COLOR[m.priority] }]}>
                        {m.priority.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.maintenanceMeta}>
                    <Text style={styles.maintenanceStatus}>{STATUS_LABEL[m.status] ?? m.status}</Text>
                    <Text style={styles.maintenanceDot}>·</Text>
                    <Text style={styles.maintenanceDate}>
                      {new Date(m.requested_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                    {m.estimated_cost != null && (
                      <>
                        <Text style={styles.maintenanceDot}>·</Text>
                        <Text style={styles.maintenanceCost}>Est. {fmt(m.estimated_cost)}</Text>
                      </>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* DOCS TAB */}
        {tab === 'docs' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DOCUMENTS</Text>
            <TouchableOpacity
              style={styles.ctaRow}
              onPress={() => router.push({ pathname: '/(app)/portfolio/[id]/documents', params: { id } })}
              activeOpacity={0.8}
            >
              <View style={styles.ctaIcon}>
                <Text style={styles.ctaIconText}>📁</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ctaTitle}>View Documents</Text>
                <Text style={styles.ctaSub}>Leases, inspection reports & mortgage docs</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
            <WebSetupNudge
              propertyId={property.id}
              title="Upload documents on assetbrain.app"
              subtitle="AI reads your leases, mortgage & inspection reports automatically"
            />
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* CRUD sheets */}
      <LogExpenseSheet
        propertyId={id ?? ''}
        propertyName={property?.name ?? ''}
        visible={showExpense}
        onClose={() => setShowExpense(false)}
        onSuccess={() => { setShowExpense(false); loadExpenses(); }}
      />
      <NewTicketSheet
        propertyId={id ?? ''}
        propertyName={property?.name ?? ''}
        visible={showTicket}
        onClose={() => setShowTicket(false)}
        onSuccess={() => { setShowTicket(false); loadMaintenance(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  errorText: { color: Colors.red, padding: 16 },

  // Hero
  hero: {
    paddingHorizontal: 16,
    paddingBottom:     16,
  },
  backBtn:   { marginBottom: 10 },
  backLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  heroName:  { color: Colors.white, fontSize: 20, fontWeight: '700', marginBottom: 2 },
  heroAddr:  { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginBottom: 2 },
  heroMeta:  { color: 'rgba(255,255,255,0.6)', fontSize: 10 },

  // Stats bar
  statsBar: {
    flexDirection:     'row',
    backgroundColor:   Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statItem: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
  },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.border },
  statContent: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  statValue:   { color: Colors.text, fontSize: 13, fontWeight: '700' },
  statLabel:   { color: Colors.textMuted, fontSize: 8, marginTop: 1 },

  // Health Score Card
  healthCard: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   Colors.aiDark,
    borderBottomWidth: 1,
    borderBottomColor: Colors.aiBorder,
    paddingHorizontal: 16,
    paddingVertical:   10,
    gap:               16,
  },
  healthLeft: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           4,
    flexShrink:    0,
  },
  healthNum:      { fontSize: 26, fontWeight: '800' },
  healthDenom:    { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  healthBadge: {
    borderRadius:      4,
    borderWidth:       1,
    paddingHorizontal: 5,
    paddingVertical:   2,
    marginLeft:        4,
    alignSelf:         'center',
  },
  healthBadgeText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.4 },
  healthAxes:  { flex: 1, gap: 4 },
  axisRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  axisLabel:   { color: Colors.textMuted, fontSize: 9, width: 60, flexShrink: 0 },
  axisTrack: {
    flex:            1,
    height:          4,
    backgroundColor: Colors.border,
    borderRadius:    2,
    overflow:        'hidden',
  },
  axisFill:    { height: 4, borderRadius: 2 },
  axisPts:     { color: Colors.textMuted, fontSize: 9, width: 26, textAlign: 'right', flexShrink: 0 },

  // Tabs
  tabBar: {
    backgroundColor:   Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabScroll: { paddingHorizontal: 4 },
  tabBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 14,
    paddingVertical:   11,
    gap:            4,
  },
  tabBtnActive:  { borderBottomWidth: 2, borderBottomColor: Colors.indigo },
  tabLabel:      { color: Colors.textMuted, fontSize: 13 },
  tabLabelActive:{ color: Colors.indigo, fontWeight: '600' },
  tabBadge: {
    backgroundColor: Colors.red,
    borderRadius:    8,
    minWidth:        16,
    height:          16,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: { color: Colors.white, fontSize: 9, fontWeight: '700' },

  content: { flex: 1, backgroundColor: Colors.bg },

  nudgeWrap: { paddingHorizontal: 16, paddingTop: 16 },

  // Sections
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionHeaderRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-end',
    marginBottom:   12,
  },
  sectionLabel: {
    color:         Colors.textMuted,
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 0.8,
    marginBottom:  4,
  },
  sectionSub: { color: Colors.textMuted, fontSize: 11, marginBottom: 12 },

  // Units
  unitRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.card,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         14,
    marginBottom:    8,
    gap:             10,
  },
  unitDot:  { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  unitInfo: { flex: 1 },
  unitLabel:{ color: Colors.text, fontSize: 14, fontWeight: '600' },
  unitSub:  { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  unitRent:        { color: Colors.text, fontSize: 13, fontWeight: '700' },
  createLeaseHint: { color: Colors.indigo, fontSize: 11, fontWeight: '700' },
  chevron:         { color: Colors.textMuted, fontSize: 18 },

  // Rent CTA
  ctaRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.card,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         16,
    gap:             12,
  },
  ctaIcon: {
    width:           40,
    height:          40,
    borderRadius:    10,
    backgroundColor: Colors.aiCard,
    alignItems:      'center',
    justifyContent:  'center',
  },
  ctaIconText: { fontSize: 18 },
  ctaTitle:    { color: Colors.text, fontSize: 15, fontWeight: '600' },
  ctaSub:      { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  // Maintenance
  maintenanceRow: {
    backgroundColor: Colors.card,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         14,
    marginBottom:    8,
    gap:             8,
  },
  maintenanceUrgent: {
    borderColor:     Colors.redBd,
    backgroundColor: Colors.redBg,
  },
  maintenanceTop: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  maintenanceTitle:{ color: Colors.text, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  maintenanceDesc: { color: Colors.textMuted, fontSize: 11, lineHeight: 16 },
  priorityPill: {
    borderRadius:      6,
    borderWidth:       1,
    paddingHorizontal: 6,
    paddingVertical:   2,
    flexShrink:        0,
  },
  priorityText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.4 },
  maintenanceMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  maintenanceStatus:{ color: Colors.textMuted, fontSize: 10 },
  maintenanceDot:   { color: Colors.border, fontSize: 10 },
  maintenanceDate:  { color: Colors.textMuted, fontSize: 10 },
  maintenanceCost:  { color: Colors.textMuted, fontSize: 10 },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 48, gap: 8, paddingBottom: 24 },
  emptyIcon:  { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptySub:   { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },

  // Section add button
  addBtn: {
    backgroundColor:   Colors.indigo,
    borderRadius:      8,
    paddingHorizontal: 12,
    paddingVertical:   6,
  },
  addBtnLabel: { color: Colors.white, fontSize: 12, fontWeight: '700' },
});
