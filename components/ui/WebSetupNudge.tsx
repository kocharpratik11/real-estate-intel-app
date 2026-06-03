import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { openPropertyOnWeb } from '@/lib/utils/propertySetup';

type Props = {
  propertyId: string;
  title?: string;
  subtitle?: string;
};

export function WebSetupNudge({ propertyId, title, subtitle }: Props) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => openPropertyOnWeb(propertyId)}
      activeOpacity={0.8}
    >
      <Text style={styles.icon}>✦</Text>
      <View style={styles.text}>
        <Text style={styles.title}>{title ?? 'Complete setup on web'}</Text>
        <Text style={styles.sub}>{subtitle ?? 'Unlock AI insights, mortgage & docs on assetbrain.app'}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  Colors.aiCard,
    borderRadius:     12,
    borderWidth:      1,
    borderColor:      Colors.aiBorder,
    padding:          14,
    gap:              10,
  },
  icon:  { color: Colors.indigo, fontSize: 16, fontWeight: '700', flexShrink: 0 },
  text:  { flex: 1 },
  title: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  sub:   { color: Colors.indigo, fontSize: 11, marginTop: 2 },
  arrow: { color: Colors.textMuted, fontSize: 18, flexShrink: 0 },
});
