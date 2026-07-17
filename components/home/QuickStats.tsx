import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import type { PortfolioSummary } from '@/types';

type Props = {
  summary: PortfolioSummary;
  onPress?: () => void;
};

const fmt = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toLocaleString()}`;

export function QuickStats({ summary, onPress }: Props) {
  const pct = Math.round(summary.collection_rate * 100);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={styles.container}>
        <View style={styles.stat}>
          <Text style={styles.value}>{fmt(summary.monthly_collected)}</Text>
          <Text style={styles.label}>collected</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${pct}%` }]} />
          </View>
          <Text style={[styles.pct, { color: pct >= 80 ? Colors.green : pct >= 60 ? Colors.yellow : Colors.red }]}>
            {pct}%
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.stat}>
          <Text style={styles.value}>{fmt(summary.net_income || summary.monthly_collected)}</Text>
          <Text style={styles.label}>net income</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.stat}>
          <Text style={[styles.value, { color: summary.vacancies > 0 ? Colors.red : Colors.text }]}>
            {summary.vacancies} vacant
          </Text>
          <Text style={styles.label}>units</Text>
          {summary.longest_vacancy_days > 0 && (
            <Text style={[styles.trend, { color: Colors.red }]}>
              {summary.longest_vacancy_days}d
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection:   'row',
    backgroundColor: Colors.aiCard,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     Colors.border,
    marginHorizontal: 16,
    paddingVertical:  12,
    marginTop:       10,
  },
  stat: {
    flex:            1,
    paddingHorizontal: 12,
    gap:             2,
  },
  value: {
    color:      Colors.text,
    fontSize:   16,
    fontWeight: '700',
  },
  label: {
    color:    Colors.textMuted,
    fontSize: 9,
    marginTop: 2,
  },
  pct: {
    fontSize:   9,
    fontWeight: '700',
  },
  trend: {
    color:    Colors.green,
    fontSize: 9,
    fontWeight: '600',
  },
  barTrack: {
    height:          3,
    backgroundColor: Colors.border,
    borderRadius:    2,
    marginTop:       4,
    overflow:        'hidden',
  },
  barFill: {
    height:          3,
    backgroundColor: Colors.green,
    borderRadius:    2,
  },
  divider: {
    width:           1,
    backgroundColor: Colors.border,
    marginVertical:  4,
  },
});
