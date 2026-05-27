import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

type Insight = {
  title: string;
  body: string;
  primaryAction: string;
  secondaryAction?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
};

type Props = {
  insight: Insight;
  total: number;
  current: number;
  onDotPress: (i: number) => void;
};

export function AIHeroCard({ insight, total, current, onDotPress }: Props) {
  return (
    <View style={styles.container}>
      {/* gradient top strip */}
      <View style={styles.gradientStrip} />

      <View style={styles.inner}>
        {/* label */}
        <View style={styles.labelPill}>
          <Text style={styles.labelText}>✦  PRIORITY ACTION</Text>
        </View>

        {/* headline */}
        <Text style={styles.headline}>{insight.title}</Text>

        {/* body */}
        <Text style={styles.body}>{insight.body}</Text>

        {/* actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.btnPrimary} onPress={insight.onPrimary} activeOpacity={0.8}>
            <Text style={styles.btnPrimaryLabel}>{insight.primaryAction}</Text>
          </TouchableOpacity>
          {insight.secondaryAction && (
            <TouchableOpacity style={styles.btnSecondary} onPress={insight.onSecondary} activeOpacity={0.8}>
              <Text style={styles.btnSecondaryLabel}>{insight.secondaryAction}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* dot nav */}
        <View style={styles.dots}>
          {Array.from({ length: total }).map((_, i) => (
            <TouchableOpacity key={i} onPress={() => onDotPress(i)} hitSlop={8}>
              <View style={[styles.dot, i === current && styles.dotActive]} />
            </TouchableOpacity>
          ))}
          {total > 1 && (
            <Text style={styles.moreLabel}>{total - 1} more insights  ›</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.aiCard,
    borderRadius:    16,
    borderWidth:     1.5,
    borderColor:     Colors.aiBorder,
    overflow:        'hidden',
    marginHorizontal: 16,
    marginTop:       8,
  },
  gradientStrip: {
    height:          4,
    backgroundColor: Colors.blue,
  },
  inner: {
    padding: 16,
    gap:     10,
  },
  labelPill: {
    backgroundColor: Colors.aiDark,
    borderRadius:    11,
    borderWidth:     1,
    borderColor:     Colors.aiBorder,
    paddingHorizontal: 10,
    paddingVertical:   4,
    alignSelf:       'flex-start',
  },
  labelText: {
    color:      Colors.blue,
    fontSize:   9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headline: {
    color:      Colors.text,
    fontSize:   18,
    fontWeight: '700',
    lineHeight: 24,
  },
  body: {
    color:     Colors.textMuted,
    fontSize:  12,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap:           10,
    marginTop:     4,
  },
  btnPrimary: {
    backgroundColor: Colors.blue,
    borderRadius:    10,
    paddingHorizontal: 16,
    paddingVertical:   9,
  },
  btnPrimaryLabel: {
    color:      Colors.white,
    fontSize:   13,
    fontWeight: '600',
  },
  btnSecondary: {
    backgroundColor: Colors.aiDark,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     Colors.border,
    paddingHorizontal: 16,
    paddingVertical:   9,
  },
  btnSecondaryLabel: {
    color:    Colors.textSub,
    fontSize: 13,
  },
  dots: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    marginTop:     4,
  },
  dot: {
    width:        6,
    height:       3,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width:           20,
    backgroundColor: Colors.blue,
  },
  moreLabel: {
    color:    Colors.textMuted,
    fontSize: 10,
    marginLeft: 8,
  },
});
