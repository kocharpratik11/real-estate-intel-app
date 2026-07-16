import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

export type ActivityItem = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  time: string;
  rawDate?: string;   // ISO date string (YYYY-MM-DD) for filtering
  timeColor?: string;
  onPress?: () => void;
};

type Props = {
  items: ActivityItem[];
  onSeeAll?: () => void;
};

export function RecentActivity({ items, onSeeAll }: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={styles.seeAll}>See all →</Text>
        </TouchableOpacity>
      </View>

      {items.map(item => (
        <TouchableOpacity
          key={item.id}
          style={styles.row}
          onPress={item.onPress}
          activeOpacity={0.7}
        >
          <Text style={styles.icon}>{item.icon}</Text>
          <View style={styles.text}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.sub}>{item.subtitle}</Text>
          </View>
          <Text style={[styles.time, { color: item.timeColor ?? Colors.textTertiary }]}>
            {item.time}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
    gap: 8,
  },
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   4,
  },
  sectionLabel: {
    color:      Colors.textTertiary,
    fontSize:   9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  seeAll: {
    color:    Colors.blue,
    fontSize: 10,
  },
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.glassBg,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.glassBorder,
    padding:         14,
    gap:             10,
  },
  icon: {
    fontSize: 18,
    width:    24,
  },
  text: {
    flex: 1,
    gap:  2,
  },
  title: {
    color:      Colors.textPrimary,
    fontSize:   13,
    fontWeight: '600',
  },
  sub: {
    color:    Colors.textTertiary,
    fontSize: 10,
  },
  time: {
    fontSize: 10,
  },
  chevron: {
    color:    Colors.textTertiary,
    fontSize: 16,
  },
});
