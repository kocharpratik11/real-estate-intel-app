import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '@/constants/colors';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  accent?: string; // left-border accent color
};

export function Card({ children, style, accent }: Props) {
  return (
    <View style={[styles.card, accent ? { borderLeftColor: accent, borderLeftWidth: 4 } : null, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.border,
    overflow:        'hidden',
  },
});
