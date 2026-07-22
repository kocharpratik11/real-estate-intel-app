import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getPrimaryResidenceDetail } from '@/lib/api/properties';
import { refreshValuation } from '@/lib/api/valuations';
import { computeMortgageBalance, calcPaymentsMade } from '@/lib/utils/mortgage';
import { openPropertyOnWeb } from '@/lib/utils/propertySetup';
import { supabase } from '@/lib/supabase';
import { hapticSuccess, hapticError } from '@/lib/haptics';
import { Colors } from '@/constants/colors';
import { Card } from '@/components/ui/Card';

type Loan = {
  id: string;
  lender_name: string | null;
  loan_amount: number | null;
  current_balance: number | null;
  interest_rate: number | null;
  loan_term_months: number | null;
  monthly_payment: number | null;
  origination_date: string | null;
  maturity_date: string | null;
  is_interest_only: boolean | null;
  payoff_date: string | null;
  effectiveBalance: number;
};

type Doc = { id: string; filename: string; document_type: string | null; document_date: string | null };

const fmt    = (n: number) => `$${Math.round(n).toLocaleString()}`;
const fmtOpt = (n: number | null | undefined) => n != null ? fmt(n) : '—';

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  return new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

type Props = { propertyId: string };

export function PrimaryResidenceDetail({ propertyId }: Props) {
  const [property,    setProperty]    = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isOwner,     setIsOwner]     = useState(false);
  const [refreshingValuation, setRefreshingValuation] = useState(false);

  const load = useCallback(async () => {
    const data = await getPrimaryResidenceDetail(propertyId).catch(() => null);
    setProperty(data);
    setLoading(false);
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setWorkspaceId(user.user_metadata?.current_workspace_id ?? null);
      setIsOwner((user.user_metadata?.current_workspace_role ?? 'owner') === 'owner');
    })();
  }, []);

  const handleRefreshValuation = async () => {
    if (!workspaceId || refreshingValuation) return;
    setRefreshingValuation(true);
    try {
      const { results } = await refreshValuation(workspaceId, propertyId);
      const result = results[0];
      hapticSuccess();
      if (!result || result.skipped) {
        Alert.alert('No update available', "Couldn't find a fresh estimate for this address right now.");
      } else if (!result.changed) {
        Alert.alert('Already up to date', 'The current value already reflects the latest estimate.');
      } else {
        Alert.alert('Valuation updated', `New value: $${Math.round(result.effectiveValue ?? 0).toLocaleString()}`);
      }
      await load();
    } catch (e: any) {
      hapticError();
      Alert.alert('Refresh failed', e.message ?? 'Could not refresh valuation.');
    } finally {
      setRefreshingValuation(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 40 }} color={Colors.purple} />;
  }
  if (!property) {
    return <Text style={styles.error}>Could not load property details</Text>;
  }

  const today = new Date();
  const marketValue = property.current_market_value ?? 0;

  const allLoans: Loan[] = ((property.financing_structures ?? []) as any[]).map(l => ({
    ...l,
    effectiveBalance: (l.loan_amount != null && l.origination_date)
      ? computeMortgageBalance(l.loan_amount, l.interest_rate ?? 0, l.monthly_payment ?? 0, l.origination_date, {
          isInterestOnly: l.is_interest_only ?? false,
          loanTermMonths: l.loan_term_months,
        })
      : (l.current_balance ?? 0),
  }));
  const activeLoans = allLoans.filter(l => !l.payoff_date || new Date(l.payoff_date) > today);
  const totalDebt   = allLoans.reduce((s, l) => s + l.effectiveBalance, 0);
  const homeEquity  = Math.max(0, marketValue - totalDebt);
  const ltv         = marketValue > 0 ? (totalDebt / marketValue) * 100 : 0;

  // Payoff timeline from the primary loan
  const primaryLoan = activeLoans[0] ?? null;
  let payoffLabel = '—';
  if (primaryLoan?.origination_date && primaryLoan?.loan_term_months) {
    const term = primaryLoan.loan_term_months;
    const paid = calcPaymentsMade(primaryLoan.origination_date, term);
    const remaining = Math.max(0, term - paid);
    if (remaining === 0) {
      payoffLabel = 'Paid off';
    } else {
      const years = Math.floor(remaining / 12);
      const remMonths = remaining % 12;
      const payoffYear = new Date(today.getFullYear(), today.getMonth() + remaining, 1).getFullYear();
      payoffLabel = years > 0 ? `${years}y ${remMonths}m (${payoffYear})` : `${remMonths} months (${payoffYear})`;
    }
  }

  // Equity growth
  const purchasePrice = property.purchase_price ?? null;
  const appreciationGain = purchasePrice != null ? marketValue - purchasePrice : null;
  const appreciationPct  = purchasePrice != null && purchasePrice > 0
    ? ((marketValue - purchasePrice) / purchasePrice) * 100
    : null;

  // Extractable equity at 80% LTV
  const extractableEquity = Math.max(0, marketValue * 0.80 - totalDebt);
  const showEquityOpportunity = extractableEquity > 50_000 && ltv < 80;

  const documents: Doc[] = ((property.documents ?? []) as Doc[]);

  return (
    <View style={styles.container}>
      {/* Key numbers */}
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>HOME EQUITY</Text>
          <Text style={[styles.statValue, { color: Colors.purple }]}>{fmt(homeEquity)}</Text>
          <Text style={styles.statSub}>{ltv > 0 ? `${ltv.toFixed(1)}% LTV` : 'No mortgage'}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>MORTGAGE BALANCE</Text>
          <Text style={styles.statValue}>{fmt(totalDebt)}</Text>
          {primaryLoan?.monthly_payment ? (
            <Text style={styles.statSub}>{fmt(primaryLoan.monthly_payment)}/mo</Text>
          ) : (
            <Text style={styles.statSubMuted}>No loan on record</Text>
          )}
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>PAYOFF TIMELINE</Text>
          <Text style={styles.statValue}>{payoffLabel}</Text>
          <Text style={styles.statSub}>At current payment</Text>
        </Card>
      </View>

      {isOwner && (
        <TouchableOpacity
          style={styles.refreshRow}
          onPress={handleRefreshValuation}
          disabled={refreshingValuation}
          activeOpacity={0.8}
        >
          {refreshingValuation
            ? <ActivityIndicator size="small" color={Colors.purple} />
            : <Text style={styles.refreshIcon}>↻</Text>
          }
          <View style={{ flex: 1 }}>
            <Text style={styles.refreshTitle}>Refresh Valuation</Text>
            <Text style={styles.refreshSub}>
              {property.value_updated_at
                ? `Last updated ${new Date(property.value_updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : 'Pull the latest estimated market value'}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Equity Growth */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Equity Growth</Text>
        <View style={styles.growthGrid}>
          <View style={styles.growthCell}>
            <Text style={styles.growthLabel}>Market Value</Text>
            <Text style={styles.growthValue}>{fmt(marketValue)}</Text>
          </View>
          {purchasePrice != null && (
            <View style={styles.growthCell}>
              <Text style={styles.growthLabel}>Purchase Price</Text>
              <Text style={styles.growthValue}>{fmt(purchasePrice)}</Text>
            </View>
          )}
          {appreciationGain != null && (
            <View style={styles.growthCell}>
              <Text style={styles.growthLabel}>Appreciation</Text>
              <Text style={[styles.growthValue, { color: appreciationGain >= 0 ? Colors.green : Colors.red }]}>
                {appreciationGain >= 0 ? '+' : ''}{fmt(appreciationGain)}
              </Text>
            </View>
          )}
          {appreciationPct != null && (
            <View style={styles.growthCell}>
              <Text style={styles.growthLabel}>Total Return</Text>
              <Text style={[styles.growthValue, { color: appreciationPct >= 0 ? Colors.green : Colors.red }]}>
                {appreciationPct >= 0 ? '+' : ''}{appreciationPct.toFixed(1)}%
              </Text>
            </View>
          )}
        </View>
      </Card>

      {/* Equity Opportunity */}
      {showEquityOpportunity && (
        <TouchableOpacity
          style={styles.opportunityCard}
          onPress={() => openPropertyOnWeb(propertyId)}
          activeOpacity={0.85}
        >
          <Text style={styles.opportunityIcon}>💡</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.opportunityTitle}>
              You have {fmt(extractableEquity)} in accessible equity
            </Text>
            <Text style={styles.opportunitySub}>
              Based on 80% LTV. Explore refinance & investment options on the web app →
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Mortgage Details */}
      {activeLoans.length > 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Mortgage Details</Text>
          {activeLoans.map(loan => (
            <View key={loan.id} style={styles.loanGrid}>
              <View style={styles.loanCell}>
                <Text style={styles.growthLabel}>Lender</Text>
                <Text style={styles.loanValue}>{loan.lender_name || '—'}</Text>
              </View>
              <View style={styles.loanCell}>
                <Text style={styles.growthLabel}>Balance</Text>
                <Text style={styles.loanValue}>{fmt(loan.effectiveBalance)}</Text>
              </View>
              <View style={styles.loanCell}>
                <Text style={styles.growthLabel}>Rate</Text>
                <Text style={styles.loanValue}>{loan.interest_rate ? `${loan.interest_rate}%` : '—'}</Text>
              </View>
              <View style={styles.loanCell}>
                <Text style={styles.growthLabel}>Matures</Text>
                <Text style={styles.loanValue}>{fmtDate(loan.maturity_date)}</Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      {/* Property Details (collapsible) */}
      <Card style={{ overflow: 'hidden' }}>
        <TouchableOpacity
          style={styles.collapseHeader}
          onPress={() => setDetailsOpen(v => !v)}
          activeOpacity={0.8}
        >
          <Text style={styles.sectionTitle}>Property Details</Text>
          <Text style={styles.collapseChevron}>{detailsOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {detailsOpen && (
          <View style={styles.growthGrid}>
            <View style={styles.growthCell}>
              <Text style={styles.growthLabel}>Address</Text>
              <Text style={styles.loanValue}>
                {property.address_line1}{property.address_line2 ? `, ${property.address_line2}` : ''}
                {'\n'}{property.city}, {property.state} {property.zip}
              </Text>
            </View>
            <View style={styles.growthCell}>
              <Text style={styles.growthLabel}>Purchase Date</Text>
              <Text style={styles.loanValue}>{fmtDate(property.purchase_date)}</Text>
            </View>
            <View style={styles.growthCell}>
              <Text style={styles.growthLabel}>Annual Property Tax</Text>
              <Text style={styles.loanValue}>{fmtOpt(property.annual_property_tax)}</Text>
            </View>
            <View style={styles.growthCell}>
              <Text style={styles.growthLabel}>Monthly HOA</Text>
              <Text style={styles.loanValue}>{fmtOpt(property.monthly_hoa_fee)}</Text>
            </View>
          </View>
        )}
      </Card>

      {/* Documents */}
      {documents.length > 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Documents</Text>
          {documents.map(doc => (
            <View key={doc.id} style={styles.docRow}>
              <Text style={styles.docName} numberOfLines={1}>{doc.filename}</Text>
              <Text style={styles.docDate}>{fmtDate(doc.document_date)}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* Manage on web — conversion, refinance & investment scenarios all live on web */}
      <TouchableOpacity
        style={styles.webCta}
        onPress={() => openPropertyOnWeb(propertyId)}
        activeOpacity={0.85}
      >
        <Text style={styles.webCtaIcon}>✦</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.webCtaTitle}>Manage on assetbrain.app</Text>
          <Text style={styles.webCtaSub}>Convert to rental, refinance options & mortgage docs</Text>
        </View>
        <Text style={styles.webCtaArrow}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  error: { color: Colors.red, padding: 16 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, padding: 12, gap: 4 },
  statLabel: { color: Colors.textMuted, fontSize: 8, fontWeight: '700', letterSpacing: 0.6 },
  statValue: { color: Colors.text, fontSize: 17, fontWeight: '800' },
  statSub:   { color: Colors.textMuted, fontSize: 10 },
  statSubMuted: { color: Colors.purple, fontSize: 10, fontWeight: '600' },

  section: { padding: 16, gap: 12 },
  sectionTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },

  refreshRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.card,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         14,
    gap:             12,
  },
  refreshIcon:  { color: Colors.purple, fontSize: 18, fontWeight: '700', width: 20, textAlign: 'center' },
  refreshTitle: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  refreshSub:   { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  growthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  growthCell: { minWidth: '40%', gap: 4 },
  growthLabel: { color: Colors.textMuted, fontSize: 10 },
  growthValue: { color: Colors.text, fontSize: 15, fontWeight: '700' },

  opportunityCard: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             10,
    backgroundColor: Colors.purpleBg,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.purpleBd,
    padding:         16,
  },
  opportunityIcon:  { fontSize: 20 },
  opportunityTitle: { color: Colors.text, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  opportunitySub:   { color: Colors.textMuted, fontSize: 11, lineHeight: 16 },

  loanGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           16,
    marginBottom:  4,
  },
  loanCell:  { minWidth: '40%', gap: 3 },
  loanValue: { color: Colors.text, fontSize: 13, fontWeight: '600' },

  collapseHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    padding:        16,
  },
  collapseChevron: { color: Colors.textMuted, fontSize: 13 },

  docRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingVertical: 8,
    borderTopWidth:  1,
    borderTopColor:  Colors.border,
    gap:             8,
  },
  docName: { color: Colors.text, fontSize: 13, flex: 1 },
  docDate: { color: Colors.textMuted, fontSize: 11 },

  webCta: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  Colors.aiCard,
    borderRadius:     12,
    borderWidth:      1,
    borderColor:      Colors.aiBorder,
    padding:          14,
    gap:              10,
    marginBottom:     24,
  },
  webCtaIcon:  { color: Colors.indigo, fontSize: 16, fontWeight: '700' },
  webCtaTitle: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  webCtaSub:   { color: Colors.indigo, fontSize: 11, marginTop: 2 },
  webCtaArrow: { color: Colors.textMuted, fontSize: 18 },
});
