import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

type Variant = 'paid' | 'overdue' | 'partial' | 'vacant' | 'pending'
              | 'active' | 'emergency' | 'high' | 'normal' | 'info' | 'warning';

const MAP: Record<Variant, { bg: string; border: string; text: string }> = {
  paid:      { bg: Colors.greenBg,  border: Colors.greenBd,  text: Colors.green },
  active:    { bg: Colors.greenBg,  border: Colors.greenBd,  text: Colors.green },
  overdue:   { bg: Colors.redBg,    border: Colors.redBd,    text: Colors.red },
  emergency: { bg: Colors.redBg,    border: Colors.redBd,    text: Colors.red },
  high:      { bg: Colors.yellowBg, border: Colors.yellowBd, text: Colors.yellow },
  warning:   { bg: Colors.yellowBg, border: Colors.yellowBd, text: Colors.yellow },
  partial:   { bg: Colors.yellowBg, border: Colors.yellowBd, text: Colors.yellow },
  normal:    { bg: Colors.aiDark,   border: Colors.aiBorder, text: Colors.blue },
  info:      { bg: Colors.aiDark,   border: Colors.aiBorder, text: Colors.blue },
  pending:   { bg: Colors.card,     border: Colors.border,   text: Colors.textMuted },
  vacant:    { bg: Colors.card,     border: Colors.border,   text: Colors.textMuted },
};

type Props = { variant: Variant; label: string };

export function Badge({ variant, label }: Props) {
  const c = MAP[variant];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 4,
    borderWidth:  1,
    paddingHorizontal: 6,
    paddingVertical:   2,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize:   9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
