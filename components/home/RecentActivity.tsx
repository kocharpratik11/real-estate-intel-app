import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

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
          <Text style={[styles.time, { color: item.timeColor ?? Colors.textMuted }]}>
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
    color:      Colors.textMuted,
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
    backgroundColor: Colors.card,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         14,
    gap:             10,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.04,
    shadowRadius:    3,
    elevation:       1,
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
    color:      Colors.text,
    fontSize:   13,
    fontWeight: '600',
  },
  sub: {
    color:    Colors.textMuted,
    fontSize: 10,
  },
  time: {
    fontSize: 10,
  },
  chevron: {
    color:    Colors.textMuted,
    fontSize: 16,
  },
});
