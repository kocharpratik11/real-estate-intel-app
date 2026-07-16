import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, FontSize, FontWeight } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

type Loan = {
  id: string;
  loan_type: string;
  lender_name: string | null;
  current_balance: number;
  interest_rate: number;
  monthly_payment: number;
  is_primary: boolean;
};

export default function EquityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [property, setProperty] = useState<any>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('properties')
      .select('current_market_value, total_equity, financing_structures(id, loan_type, lender_name, current_balance, interest_rate, monthly_payment, is_primary)')
      .eq('id', id)
      .single();
    setProperty(data);
    setLoans((data?.financing_structures ?? []) as Loan[]);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.blue} />
      </SafeAreaView>
    );
  }

  if (!property) return null;

  const currentValue = property.current_market_value ?? 0;
  const totalDebt = loans.reduce((sum, l) => sum + (l.current_balance ?? 0), 0);
  const equity = currentValue - totalDebt;
  const ltv = currentValue > 0 ? (totalDebt / currentValue) * 100 : 0;
  const equityPct = 100 - ltv;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Summary Cards */}
        <View style={styles.grid}>
          <SummaryCard label="Current Value" value={formatCurrency(currentValue)} color={Colors.blue} />
          <SummaryCard label="Total Debt" value={formatCurrency(totalDebt)} color={Colors.error} />
          <SummaryCard label="Equity" value={formatCurrency(equity)} color={Colors.success} />
          <SummaryCard label="LTV" value={`${ltv.toFixed(1)}%`} color={Colors.warning} />
        </View>

        {/* Equity Bar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Equity Breakdown</Text>
          <View style={styles.barContainer}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.barSegment, { flex: Math.max(equityPct, 0.01) }]}
            >
              <Text style={styles.barLabel}>{equityPct.toFixed(0)}%</Text>
            </LinearGradient>
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.barSegment, { flex: Math.max(ltv, 0.01) }]}
            >
              <Text style={styles.barLabel}>{ltv.toFixed(0)}%</Text>
            </LinearGradient>
          </View>
          <View style={styles.barLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
              <Text style={styles.legendText}>Equity ({formatCurrency(equity)})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.error }]} />
              <Text style={styles.legendText}>Debt ({formatCurrency(totalDebt)})</Text>
            </View>
          </View>
        </View>

        {/* Loan Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financing Structures ({loans.length})</Text>
          {loans.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyText}>No active loans — cash purchase</Text>
            </View>
          ) : (
            loans.map((loan) => (
              <View key={loan.id} style={styles.card}>
                <View style={styles.loanHeader}>
                  <Text style={styles.loanName}>
                    {loan.loan_type?.replace(/_/g, ' ')}{loan.is_primary ? '  ·  Primary' : ''}
                  </Text>
                  <Text style={styles.loanBalance}>
                    {formatCurrency(loan.current_balance)}
                  </Text>
                </View>
                {loan.lender_name && <Text style={styles.loanLender}>{loan.lender_name}</Text>}
                <View style={styles.loanDetails}>
                  <LoanDetail label="Rate" value={`${loan.interest_rate}%`} />
                  <LoanDetail label="Monthly" value={formatCurrency(loan.monthly_payment)} />
                </View>
              </View>
            ))
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

function LoanDetail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.loanDetailItem}>
      <Text style={styles.loanDetailLabel}>{label}</Text>
      <Text style={styles.loanDetailValue}>{value}</Text>
    </View>
  );
}

function formatCurrency(amount: number): string {
  if (!amount) return '$0';
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.base,
    gap: 12,
  },
  summaryCard: {
    width: '47%',
    backgroundColor: Colors.bgSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.base,
  },
  summaryLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  section: {
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.base,
  },
  barContainer: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  barSegment: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  barLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: 'white',
  },
  barLegend: {
    flexDirection: 'row',
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.base,
    marginBottom: 12,
  },
  loanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  loanName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    textTransform: 'capitalize',
  },
  loanBalance: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.blue,
  },
  loanLender: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
  },
  loanDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  loanDetailItem: { alignItems: 'center' },
  loanDetailLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  loanDetailValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});
