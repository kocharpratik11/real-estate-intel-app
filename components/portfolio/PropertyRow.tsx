import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import type { Property } from '@/types';

type HealthStatus = 'healthy' | 'warning' | 'critical';

export type PropertyRowData = Property & {
  cashFlow:       number;
  collectionRate: number;  // 0–1
  badgeLabel:     string;
  health:         HealthStatus;
  vacancies?:     number;
  healthScore?:   number;  // 0–100, Phase 2
};

type Props = {
  property: PropertyRowData;
  onPress:  () => void;
};

const HEALTH_COLOR: Record<HealthStatus, string> = {
  healthy:  Colors.green,
  warning:  Colors.yellow,
  critical: Colors.red,
};

const HEALTH_BADGE_BG: Record<HealthStatus, string> = {
  healthy:  Colors.greenBg,
  warning:  Colors.yellowBg,
  critical: Colors.redBg,
};

const HEALTH_BADGE_BD: Record<HealthStatus, string> = {
  healthy:  Colors.greenBd,
  warning:  Colors.yellowBd,
  critical: Colors.redBd,
};

function ScoreChip({ score }: { score: number }) {
  const color = score >= 80 ? Colors.green : score >= 60 ? Colors.yellow : Colors.red;
  const bg    = score >= 80 ? Colors.greenBg : score >= 60 ? Colors.yellowBg : Colors.redBg;
  const bd    = score >= 80 ? Colors.greenBd : score >= 60 ? Colors.yellowBd : Colors.redBd;
  return (
    <View style={[styles.scoreChip, { backgroundColor: bg, borderColor: bd }]}>
      <Text style={[styles.scoreNum, { color }]}>{score}</Text>
      <Text style={[styles.scoreDenom, { color }]}>/100</Text>
    </View>
  );
}

export function PropertyRow({ property: p, onPress }: Props) {
  const accentColor = HEALTH_COLOR[p.health];
  const pct         = Math.round(p.collectionRate * 100);
  const cfColor     = p.cashFlow < 0 ? Colors.red : Colors.green;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.card, { borderLeftColor: accentColor }]}>
        {/* name row */}
        <View style={styles.nameRow}>
          <Text style={styles.name}>{p.name}</Text>
          {p.healthScore != null
            ? <ScoreChip score={p.healthScore} />
            : (
              <View style={[styles.badge, {
                backgroundColor: HEALTH_BADGE_BG[p.health],
                borderColor:     HEALTH_BADGE_BD[p.health],
              }]}>
                <Text style={[styles.badgeText, { color: accentColor }]}>{p.badgeLabel}</Text>
              </View>
            )
          }
        </View>

        {/* address + units */}
        <Text style={styles.address}>{p.address_line1}, {p.city}</Text>
        <Text style={styles.units}>{p.unit_count} units</Text>

        {/* progress bar */}
        <View style={styles.barTrack}>
          <View style={[
            styles.barFill,
            { width: `${pct}%`, backgroundColor: pct >= 80 ? Colors.green : pct >= 60 ? Colors.yellow : Colors.red }
          ]} />
        </View>
        <View style={styles.bottomRow}>
          <Text style={styles.pct}>{pct}% collected</Text>
          <Text style={[styles.cf, { color: cfColor }]}>
            {p.cashFlow >= 0 ? '↑' : '↓'} ${Math.round(Math.abs(p.cashFlow)).toLocaleString()}/mo
          </Text>
        </View>

        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor:  Colors.card,
    borderRadius:     14,
    borderWidth:      1,
    borderColor:      Colors.border,
    borderLeftWidth:  4,
    padding:          16,
    marginHorizontal: 16,
    marginBottom:     10,
    position:         'relative',
    shadowColor:      '#000',
    shadowOffset:     { width: 0, height: 1 },
    shadowOpacity:    0.05,
    shadowRadius:     4,
    elevation:        2,
  },
  nameRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   4,
  },
  name: {
    color:       Colors.text,
    fontSize:    15,
    fontWeight:  '700',
    flex:        1,
    marginRight: 8,
  },
  badge: {
    borderRadius:      4,
    borderWidth:       1,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  badgeText: {
    fontSize:      9,
    fontWeight:    '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  scoreChip: {
    flexDirection:     'row',
    alignItems:        'baseline',
    borderRadius:      6,
    borderWidth:       1,
    paddingHorizontal: 7,
    paddingVertical:   3,
    gap:               1,
  },
  scoreNum:   { fontSize: 14, fontWeight: '700' },
  scoreDenom: { fontSize: 9,  fontWeight: '600' },
  address: {
    color:        Colors.textMuted,
    fontSize:     11,
    marginBottom: 2,
  },
  units: {
    color:        Colors.textMuted,
    fontSize:     10,
    marginBottom: 10,
  },
  barTrack: {
    height:          4,
    backgroundColor: Colors.border,
    borderRadius:    2,
    overflow:        'hidden',
    marginBottom:    6,
  },
  barFill: {
    height:       4,
    borderRadius: 2,
  },
  bottomRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  pct: {
    color:    Colors.textMuted,
    fontSize: 9,
  },
  cf: {
    fontSize:   13,
    fontWeight: '700',
  },
  chevron: {
    position: 'absolute',
    right:    14,
    top:      '50%',
    color:    Colors.textMuted,
    fontSize: 18,
  },
});
