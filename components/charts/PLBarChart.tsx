import { View, Text, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { Colors } from '@/constants/colors';
import type { MonthlyPL } from '@/lib/api/financials';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.abs(Math.round(n))}`;

type Props = {
  data:  MonthlyPL[];
  title: string;
};

export function PLBarChart({ data, title }: Props) {
  if (data.length === 0) return null;

  const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expenses)), 1);

  const incomeData = data.map(d => ({
    value:      d.income,
    label:      MONTHS_SHORT[d.month - 1],
    frontColor: Colors.green,
  }));

  const expenseData = data.map(d => ({
    value:      d.expenses,
    label:      MONTHS_SHORT[d.month - 1],
    frontColor: Colors.red,
  }));

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>

      {/* Income row */}
      <Text style={styles.rowLabel}>Income</Text>
      <BarChart
        data={incomeData}
        barWidth={18}
        spacing={12}
        roundedTop
        hideRules
        xAxisLabelTextStyle={styles.axisLabel}
        hideYAxisText
        noOfSections={3}
        maxValue={Math.ceil(maxVal * 1.2)}
        yAxisThickness={0}
        xAxisThickness={1}
        xAxisColor={Colors.border}
        isAnimated
        animationDuration={400}
        barBorderRadius={3}
        height={80}
      />

      {/* Expenses row */}
      <Text style={[styles.rowLabel, styles.rowLabelRed]}>Expenses</Text>
      <BarChart
        data={expenseData}
        barWidth={18}
        spacing={12}
        roundedTop
        hideRules
        xAxisLabelTextStyle={styles.axisLabel}
        hideYAxisText
        noOfSections={3}
        maxValue={Math.ceil(maxVal * 1.2)}
        yAxisThickness={0}
        xAxisThickness={1}
        xAxisColor={Colors.border}
        isAnimated
        animationDuration={400}
        barBorderRadius={3}
        height={80}
      />

      {/* Net row */}
      <View style={styles.netSection}>
        <Text style={styles.netTitle}>Net / Month</Text>
        <View style={styles.netRow}>
          {data.map(d => {
            const isPos = d.net >= 0;
            return (
              <View key={`${d.year}-${d.month}`} style={styles.netCell}>
                <Text style={[styles.netLabel, { color: isPos ? Colors.green : Colors.red }]}>
                  {isPos ? '+' : '-'}{fmt(Math.abs(d.net))}
                </Text>
                <Text style={styles.netMonth}>{MONTHS_SHORT[d.month - 1]}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.card,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         16,
    marginBottom:    12,
    overflow:        'hidden',
  },
  title: {
    color:        Colors.textMuted,
    fontSize:     9,
    fontWeight:   '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  rowLabel: {
    color:      Colors.green,
    fontSize:   9,
    fontWeight: '700',
    marginBottom: 2,
  },
  rowLabelRed: {
    color:    Colors.red,
    marginTop: 8,
  },
  axisLabel: { color: Colors.textMuted, fontSize: 9 },
  netSection:{ marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  netTitle:  { color: Colors.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  netRow:    { flexDirection: 'row' },
  netCell:   { flex: 1, alignItems: 'center', gap: 2 },
  netLabel:  { fontSize: 9, fontWeight: '700' },
  netMonth:  { color: Colors.textMuted, fontSize: 8 },
});
