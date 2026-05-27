import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { Badge } from '@/components/ui/Badge';
import type { LedgerEvent, PaymentStatus } from '@/types';

type Props = {
  event:   LedgerEvent;
  onPress: () => void;
};

const STATUS_BADGE: Record<PaymentStatus, 'paid' | 'overdue' | 'partial' | 'pending' | 'vacant'> = {
  paid:    'paid',
  late:    'overdue',
  partial: 'partial',
  pending: 'pending',
  waived:  'vacant',
};

const fmtDate = (d: string) => {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const fmtAmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export function LedgerRow({ event: e, onPress }: Props) {
  const isCharge  = e.type === 'charge';
  const amtColor  = e.isCredit ? Colors.blue : isCharge ? Colors.red : Colors.green;
  const amtPrefix = e.isCredit ? '−' : isCharge ? '+' : '−';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={styles.row}>
        {/* left accent */}
        <View style={[styles.accent, { backgroundColor: isCharge ? Colors.red : Colors.green }]} />

        <View style={styles.body}>
          <View style={styles.topRow}>
            <Text style={styles.description} numberOfLines={1}>{e.description}</Text>
            <Text style={[styles.amount, { color: amtColor }]}>
              {amtPrefix}{fmtAmt(e.amount)}
            </Text>
          </View>

          <View style={styles.bottomRow}>
            <Text style={styles.date}>{fmtDate(e.date)}</Text>
            <View style={styles.right}>
              {e.status && <Badge variant={STATUS_BADGE[e.status]} label={e.status.toUpperCase()} />}
              <Text style={styles.balance}>Balance: {fmtAmt(e.runningBalance)}</Text>
            </View>
          </View>

          {e.sourcePayment.units?.label && (
            <Text style={styles.unit}>{e.sourcePayment.units.label}</Text>
          )}
        </View>

        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:   'row',
    backgroundColor: Colors.card,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     Colors.border,
    marginBottom:    8,
    overflow:        'hidden',
  },
  accent: {
    width: 4,
  },
  body: {
    flex:    1,
    padding: 12,
    gap:     6,
  },
  topRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    gap:            8,
  },
  description: {
    color:      Colors.text,
    fontSize:   13,
    fontWeight: '600',
    flex:        1,
  },
  amount: {
    fontSize:   14,
    fontWeight: '700',
  },
  bottomRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  date: {
    color:    Colors.textMuted,
    fontSize: 10,
  },
  right: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  balance: {
    color:    Colors.textMuted,
    fontSize: 10,
  },
  unit: {
    color:    Colors.textMuted,
    fontSize: 10,
  },
  chevron: {
    color:       Colors.textMuted,
    fontSize:    18,
    paddingRight: 10,
    alignSelf:   'center',
  },
});
