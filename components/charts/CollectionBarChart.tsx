import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { Colors } from '@/constants/colors';

export type MonthlyCollection = {
  month: number;         // 1–12
  year:  number;
  collected: number;
  expected:  number;
  label?: string;        // override x-axis label (e.g. "Jan")
};

type Props = {
  data:  MonthlyCollection[];
  title?: string;
};

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtK(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n}`;
}

export function CollectionBarChart({ data, title = 'Rent Collection' }: Props) {
  const { width } = useWindowDimensions();
  const chartWidth = width - 32 - 48; // 16px side padding * 2 + 48 for y-axis labels

  if (!data.length) return null;

  // Build bar data: grouped bars — collected (indigo) + gap (expected baseline)
  const maxVal = Math.max(...data.map(d => Math.max(d.collected, d.expected)), 1);

  const barData = data.flatMap(d => {
    const month = SHORT_MONTHS[(d.month - 1) % 12];
    return [
      {
        value:     d.collected,
        label:     month,
        frontColor: d.collected >= d.expected ? Colors.green : Colors.indigo,
        topLabelComponent: () => null,
      },
      {
        value:     d.expected,
        frontColor: 'transparent',
        // Show expected as a ghost bar — only the unfilled portion matters visually
        // We render expected as a second bar; the collected bar overlaps it at its own height
        topLabelComponent: () => null,
      },
    ];
  });

  // Simpler single-bar approach: show collected amount, tint by rate
  const singleBarData = data.map(d => {
    const rate  = d.expected > 0 ? d.collected / d.expected : 1;
    const color = rate >= 0.9 ? Colors.green : rate >= 0.6 ? Colors.yellow : Colors.red;
    return {
      value:      d.collected,
      label:      d.label ?? SHORT_MONTHS[(d.month - 1) % 12],
      frontColor: color,
      topLabelComponent: () => (
        <Text style={styles.barTopLabel}>{Math.round(rate * 100)}%</Text>
      ),
    };
  });

  return (
    <View style={styles.container}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <BarChart
        data={singleBarData}
        width={chartWidth}
        height={140}
        maxValue={maxVal * 1.15}
        noOfSections={4}
        barWidth={chartWidth / Math.max(data.length * 1.8, 6)}
        spacing={chartWidth / Math.max(data.length * 3.6, 8)}
        roundedTop
        hideRules={false}
        rulesColor={Colors.border}
        rulesType="dashed"
        yAxisThickness={0}
        xAxisThickness={1}
        xAxisColor={Colors.border}
        xAxisLabelTextStyle={styles.xLabel}
        yAxisTextStyle={styles.yLabel}
        yAxisLabelPrefix="$"
        formatYLabel={(v: string) => {
          const n = parseInt(v, 10);
          if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
          return String(n);
        }}
        isAnimated
        animationDuration={600}
        initialSpacing={8}
        endSpacing={8}
      />

      {/* Legend */}
      <View style={styles.legend}>
        {[
          { color: Colors.green,  label: '≥90% collected' },
          { color: Colors.yellow, label: '60–89%' },
          { color: Colors.red,    label: '<60%' },
        ].map(l => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: l.color }]} />
            <Text style={styles.legendLabel}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         16,
    marginBottom:    12,
  },
  title: {
    color:        Colors.text,
    fontSize:     13,
    fontWeight:   '700',
    marginBottom: 12,
  },
  barTopLabel: {
    color:      Colors.textMuted,
    fontSize:   8,
    fontWeight: '600',
    marginBottom: 2,
  },
  xLabel: { color: Colors.textMuted, fontSize: 9 },
  yLabel: { color: Colors.textMuted, fontSize: 9 },
  legend: {
    flexDirection:  'row',
    gap:            12,
    marginTop:      10,
    flexWrap:       'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendLabel:{ color: Colors.textMuted, fontSize: 10 },
});
