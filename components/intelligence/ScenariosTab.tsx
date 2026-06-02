import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, TextInput,
} from 'react-native';
import { buildSnapshots } from '@/lib/api/scenarios';
import {
  computeHold, computeCashOutRefi, computeSell, computeBuyAnother,
} from '@/lib/scenarios/engine';
import { Colors } from '@/constants/colors';
import type { PropertySnapshot } from '@/lib/scenarios/types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `$${Math.round(n / 1_000)}k`
    : `$${n.toLocaleString()}`;
}

function MetricRow({ label, value, sub, positive }: {
  label: string; value: string; sub?: string; positive?: boolean;
}) {
  return (
    <View style={mStyles.row}>
      <Text style={mStyles.label}>{label}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[mStyles.value, positive === true && { color: Colors.green }, positive === false && { color: Colors.red }]}>
          {value}
        </Text>
        {sub ? <Text style={mStyles.sub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

const mStyles = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingVertical: 5 },
  label: { color: Colors.textMuted, fontSize: 12, flex: 1 },
  value: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  sub:   { color: Colors.textMuted, fontSize: 10, marginTop: 1 },
});

// ─── horizon selector ─────────────────────────────────────────────────────────

function HorizonSelector({
  value, onChange,
}: { value: 1 | 5 | 10; onChange: (v: 1 | 5 | 10) => void }) {
  return (
    <View style={hz.row}>
      {([1, 5, 10] as const).map(h => (
        <TouchableOpacity
          key={h}
          style={[hz.btn, value === h && hz.active]}
          onPress={() => onChange(h)}
          activeOpacity={0.8}
        >
          <Text style={[hz.label, value === h && hz.labelActive]}>{h}yr</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const hz = StyleSheet.create({
  row:        { flexDirection: 'row', gap: 6, marginBottom: 12 },
  btn:        { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  active:     { backgroundColor: Colors.indigo, borderColor: Colors.indigo },
  label:      { color: Colors.textMuted, fontSize: 12 },
  labelActive:{ color: Colors.white, fontWeight: '600', fontSize: 12 },
});

// ─── Scenario cards ───────────────────────────────────────────────────────────

function HoldCard({ snap }: { snap: PropertySnapshot }) {
  const [horizon, setHorizon] = useState<1 | 5 | 10>(5);
  const r = computeHold(snap, { horizon, appreciationRate: 0.03, rentGrowthRate: 0.02 });
  const delta = r.projectedCashFlow - snap.monthlyCashFlow;
  return (
    <View style={card.box}>
      <View style={card.header}>
        <Text style={card.icon}>📈</Text>
        <Text style={card.title}>Hold</Text>
      </View>
      <HorizonSelector value={horizon} onChange={setHorizon} />
      <MetricRow label="Projected equity"    value={fmt(r.projectedEquity)} />
      <MetricRow label="Appreciation gain"   value={fmt(r.appreciationGain)} positive={r.appreciationGain >= 0} />
      <MetricRow label="Projected cash flow" value={`${delta >= 0 ? '+' : ''}${fmt(delta)}/mo vs today`} positive={delta >= 0} />
      {r.projectedROE != null && (
        <MetricRow label="Projected ROE" value={`${r.projectedROE}%`} />
      )}
    </View>
  );
}

function RefiCard({ snap }: { snap: PropertySnapshot }) {
  const [ltvPct, setLtvPct] = useState('75');
  const ltv = Math.min(0.9, Math.max(0.1, (parseFloat(ltvPct) || 75) / 100));
  const r = computeCashOutRefi(snap, { ltv, newRate: 0.0725, newTermYears: 30 });
  return (
    <View style={card.box}>
      <View style={card.header}>
        <Text style={card.icon}>🏦</Text>
        <Text style={card.title}>Cash-Out Refinance</Text>
      </View>
      <View style={card.inputRow}>
        <Text style={card.inputLabel}>LTV %</Text>
        <TextInput
          style={card.input}
          value={ltvPct}
          onChangeText={setLtvPct}
          keyboardType="numeric"
          placeholder="75"
          placeholderTextColor={Colors.textMuted}
          maxLength={4}
        />
      </View>
      {!r.feasible ? (
        <Text style={card.warn}>Not feasible — outstanding debt already exceeds {ltvPct}% LTV.</Text>
      ) : (
        <>
          <MetricRow label="Cash extracted"      value={fmt(r.cashExtracted)}        positive />
          <MetricRow label="New loan"             value={fmt(r.newLoanAmount)} />
          <MetricRow label="New payment"          value={`${fmt(r.newMonthlyPayment)}/mo`} />
          <MetricRow label="Payment increase"     value={`+${fmt(r.paymentDelta)}/mo`} positive={r.paymentDelta <= 0} />
          <MetricRow label="New cash flow"        value={`${r.newMonthlyCashFlow >= 0 ? '+' : ''}${fmt(r.newMonthlyCashFlow)}/mo`} positive={r.newMonthlyCashFlow >= 0} />
          {r.newROE != null && <MetricRow label="New ROE" value={`${r.newROE}%`} />}
        </>
      )}
    </View>
  );
}

function SellCard({ snap }: { snap: PropertySnapshot }) {
  const [priceK, setPriceK] = useState(String(Math.round((snap.marketValue || 0) / 1000)));
  const salePrice = (parseFloat(priceK) || 0) * 1000;
  const r = computeSell(snap, { salePrice, closingCostPct: 0.07, capitalGainsRatePct: 0.15 });
  return (
    <View style={card.box}>
      <View style={card.header}>
        <Text style={card.icon}>💰</Text>
        <Text style={card.title}>Sell</Text>
      </View>
      <View style={card.inputRow}>
        <Text style={card.inputLabel}>Sale price ($k)</Text>
        <TextInput
          style={card.input}
          value={priceK}
          onChangeText={setPriceK}
          keyboardType="numeric"
          placeholder={String(Math.round((snap.marketValue || 0) / 1000))}
          placeholderTextColor={Colors.textMuted}
          maxLength={6}
        />
      </View>
      <MetricRow label="Gross proceeds"      value={fmt(r.grossProceeds)} />
      <MetricRow label="Closing costs (7%)"  value={`-${fmt(r.closingCosts)}`} />
      <MetricRow label="Loan payoff"         value={`-${fmt(r.loanPayoff)}`} />
      <MetricRow label="Net before tax"      value={fmt(r.netProceedsBeforeTax)} />
      <MetricRow label="Est. cap gains tax"  value={`-${fmt(r.estimatedCapGainsTax)}`} />
      <View style={card.divider} />
      <MetricRow label="Net after tax"       value={fmt(r.netAfterTax)} positive={r.netAfterTax > 0} />
      {r.holdingPeriodYears != null && (
        <MetricRow label="Holding period"    value={`${r.holdingPeriodYears} years`} />
      )}
    </View>
  );
}

function BuyAnotherCard({ snap }: { snap: PropertySnapshot }) {
  const [priceK, setPriceK] = useState('500');
  const purchasePrice = (parseFloat(priceK) || 500) * 1000;
  const r = computeBuyAnother(snap, {
    purchasePrice,
    capRate:        0.055,
    downPaymentPct: 0.25,
    loanRate:       0.0725,
    loanTermYears:  30,
  });
  return (
    <View style={card.box}>
      <View style={card.header}>
        <Text style={card.icon}>🏘️</Text>
        <Text style={card.title}>Buy Another</Text>
      </View>
      <View style={card.inputRow}>
        <Text style={card.inputLabel}>Purchase price ($k)</Text>
        <TextInput
          style={card.input}
          value={priceK}
          onChangeText={setPriceK}
          keyboardType="numeric"
          placeholder="500"
          placeholderTextColor={Colors.textMuted}
          maxLength={6}
        />
      </View>
      <MetricRow label="Down payment (25%)"   value={fmt(r.downPayment)} />
      <MetricRow label="Loan amount"          value={fmt(r.loanAmount)} />
      <MetricRow label="New NOI"              value={`${fmt(r.newNOI)}/yr`} />
      <MetricRow label="New cash flow"        value={`${r.newMonthlyCashFlow >= 0 ? '+' : ''}${fmt(r.newMonthlyCashFlow)}/mo`} positive={r.newMonthlyCashFlow >= 0} />
      {r.newROE != null && <MetricRow label="New property ROE"  value={`${r.newROE}%`} />}
      {r.portfolioROEDelta != null && (
        <MetricRow
          label="Portfolio ROE impact"
          value={`${r.portfolioROEDelta >= 0 ? '+' : ''}${r.portfolioROEDelta}%`}
          positive={r.portfolioROEDelta >= 0}
        />
      )}
    </View>
  );
}

const card = StyleSheet.create({
  box: {
    backgroundColor: Colors.card,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         16,
    marginBottom:    12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  icon:   { fontSize: 18 },
  title:  { color: Colors.text, fontSize: 15, fontWeight: '700' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  inputLabel: { color: Colors.textMuted, fontSize: 12 },
  input: {
    color: Colors.text, fontSize: 14, fontWeight: '600',
    backgroundColor: Colors.bg, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, paddingVertical: 5,
    minWidth: 80, textAlign: 'right',
  },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 6 },
  warn: { color: Colors.yellow, fontSize: 12, lineHeight: 18 },
});

// ─── main component ───────────────────────────────────────────────────────────

export function ScenariosTab({ workspaceId }: { workspaceId: string }) {
  const [snapshots, setSnapshots] = useState<PropertySnapshot[]>([]);
  const [selected,  setSelected]  = useState<PropertySnapshot | null>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!workspaceId) { setLoading(false); return; }
    buildSnapshots(workspaceId).then(snaps => {
      setSnapshots(snaps);
      if (snaps.length > 0) setSelected(snaps[0]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [workspaceId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.indigo} />
        <Text style={styles.loadingText}>Building snapshots...</Text>
      </View>
    );
  }

  if (snapshots.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 32, marginBottom: 8 }}>📊</Text>
        <Text style={styles.emptyTitle}>No properties yet</Text>
        <Text style={styles.emptySub}>Add properties to model refinancing, sales, and acquisitions.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {/* Property picker */}
      <Text style={styles.pickerLabel}>SELECT PROPERTY</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
        {snapshots.map(s => (
          <TouchableOpacity
            key={s.id}
            style={[styles.chip, selected?.id === s.id && styles.chipActive]}
            onPress={() => setSelected(s)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, selected?.id === s.id && styles.chipTextActive]}>
              {s.name}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ width: 16 }} />
      </ScrollView>

      {selected && (
        <>
          {/* Snapshot header */}
          <View style={styles.snapCard}>
            <Text style={styles.snapName}>{selected.name}</Text>
            <View style={styles.snapRow}>
              <View style={styles.snapStat}>
                <Text style={styles.snapVal}>{fmt(selected.marketValue)}</Text>
                <Text style={styles.snapLbl}>Value</Text>
              </View>
              <View style={styles.snapStat}>
                <Text style={styles.snapVal}>{fmt(selected.equity)}</Text>
                <Text style={styles.snapLbl}>Equity</Text>
              </View>
              <View style={styles.snapStat}>
                <Text style={[styles.snapVal, { color: selected.monthlyCashFlow >= 0 ? Colors.green : Colors.red }]}>
                  {selected.monthlyCashFlow >= 0 ? '+' : ''}{fmt(selected.monthlyCashFlow)}/mo
                </Text>
                <Text style={styles.snapLbl}>Cash Flow</Text>
              </View>
              {selected.currentROE != null && (
                <View style={styles.snapStat}>
                  <Text style={styles.snapVal}>{selected.currentROE}%</Text>
                  <Text style={styles.snapLbl}>ROE</Text>
                </View>
              )}
            </View>
          </View>

          {/* 4 scenario cards */}
          <HoldCard       snap={selected} />
          <RefiCard       snap={selected} />
          <SellCard       snap={selected} />
          <BuyAnotherCard snap={selected} />
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:  { flex: 1, backgroundColor: Colors.bg },
  content: { paddingTop: 16 },

  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 8, backgroundColor: Colors.bg,
  },
  loadingText: { color: Colors.textMuted, fontSize: 13, marginTop: 8 },
  emptyTitle:  { color: Colors.text, fontSize: 16, fontWeight: '700' },
  emptySub:    { color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  pickerLabel: {
    color: Colors.textMuted, fontSize: 9, fontWeight: '700',
    letterSpacing: 0.8, marginBottom: 8, paddingHorizontal: 16,
  },
  pickerRow: { paddingLeft: 16, marginBottom: 16 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 16, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.card,
    marginRight: 8,
  },
  chipActive:     { backgroundColor: Colors.indigo, borderColor: Colors.indigo },
  chipText:       { color: Colors.textMuted, fontSize: 13 },
  chipTextActive: { color: Colors.white, fontWeight: '600', fontSize: 13 },

  snapCard: {
    backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, marginHorizontal: 16, marginBottom: 16,
  },
  snapName: { color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 12 },
  snapRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  snapStat: { alignItems: 'center', minWidth: 60 },
  snapVal:  { color: Colors.text, fontSize: 14, fontWeight: '700' },
  snapLbl:  { color: Colors.textMuted, fontSize: 10, marginTop: 2 },

  // Scenario cards rendered inside scroll — use paddingHorizontal from parent
  content2: { paddingHorizontal: 16 },
});
