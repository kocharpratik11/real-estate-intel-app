import { TouchableOpacity, Text, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/colors';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ label, onPress, variant = 'primary', loading, disabled, style }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.base, styles[variant], (disabled || loading) && styles.disabled, style]}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator size="small" color={variant === 'primary' ? Colors.white : Colors.blue} />
        : <Text style={[styles.label, styles[`${variant}Label` as keyof typeof styles] as any]}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius:   10,
    paddingVertical: 14,
    alignItems:     'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: Colors.blue,
  },
  secondary: {
    backgroundColor: Colors.aiDark,
    borderWidth:     1,
    borderColor:     Colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: Colors.redBg,
    borderWidth:     1,
    borderColor:     Colors.redBd,
  },
  disabled: { opacity: 0.5 },
  label: {
    fontSize:   15,
    fontWeight: '600',
  },
  primaryLabel:   { color: Colors.white },
  secondaryLabel: { color: Colors.textSub },
  ghostLabel:     { color: Colors.textMuted },
  dangerLabel:    { color: Colors.red },
});
