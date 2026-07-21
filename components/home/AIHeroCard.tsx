import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '@/constants/colors';

export type Insight = {
  id: string;
  title: string;
  body: string;
  primaryAction: string;
  onPrimary: () => void;
};

type Props = {
  insights: Insight[];
  current: number;
  onIndexChange: (i: number) => void;
  onDismiss: (id: string) => void;
};

const H_MARGIN   = 16;
const CARD_WIDTH = Dimensions.get('window').width - H_MARGIN * 2;

export function AIHeroCard({ insights, current, onIndexChange, onDismiss }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const clampedCurrent = Math.min(current, Math.max(insights.length - 1, 0));

  // Keep the scroll position in sync when `current` changes externally (e.g. dot tap, dismiss).
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: clampedCurrent * CARD_WIDTH, animated: true });
  }, [clampedCurrent]);

  const scrollToIndex = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * CARD_WIDTH, animated: true });
    onIndexChange(i);
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
    onIndexChange(i);
  };

  if (insights.length === 0) return null;

  return (
    <View style={styles.container}>
      <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradientStrip} />

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
      >
        {insights.map(insight => (
          <View key={insight.id} style={[styles.inner, { width: CARD_WIDTH }]}>
            <View style={styles.topRow}>
              <View style={styles.labelPill}>
                <Text style={styles.labelText}>✦  PRIORITY ACTION</Text>
              </View>
              <TouchableOpacity
                onPress={() => onDismiss(insight.id)}
                hitSlop={8}
                style={styles.dismissBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.dismissIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.headline}>{insight.title}</Text>
            <Text style={styles.body}>{insight.body}</Text>

            <TouchableOpacity style={styles.btnPrimary} onPress={insight.onPrimary} activeOpacity={0.8}>
              <Text style={styles.btnPrimaryLabel}>{insight.primaryAction}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {insights.length > 1 && (
        <View style={styles.dots}>
          {insights.map((insight, i) => (
            <TouchableOpacity key={insight.id} onPress={() => scrollToIndex(i)} hitSlop={8}>
              <View style={[styles.dot, i === clampedCurrent && styles.dotActive]} />
            </TouchableOpacity>
          ))}
          <Text style={styles.countLabel}>{clampedCurrent + 1} / {insights.length}</Text>
        </View>
      )}
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
    marginHorizontal: H_MARGIN,
    marginTop:       8,
  },
  gradientStrip: { height: 4 },
  inner: { padding: 16, gap: 10 },
  topRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
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
    color:         Colors.blue,
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 0.5,
  },
  dismissBtn: {
    width:           22,
    height:          22,
    borderRadius:    11,
    backgroundColor: Colors.aiDark,
    alignItems:      'center',
    justifyContent:  'center',
  },
  dismissIcon: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  headline: {
    color:      Colors.text,
    fontSize:   18,
    fontWeight: '700',
    lineHeight: 24,
  },
  body: {
    color:      Colors.textSub,
    fontSize:   12,
    lineHeight: 18,
  },
  btnPrimary: {
    backgroundColor:   Colors.blue,
    borderRadius:      10,
    paddingHorizontal: 16,
    paddingVertical:   9,
    alignSelf:         'flex-start',
    marginTop:         4,
  },
  btnPrimaryLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  dots: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  dot: {
    width:           6,
    height:          3,
    borderRadius:    2,
    backgroundColor: Colors.border,
  },
  dotActive: { width: 20, backgroundColor: Colors.blue },
  countLabel: { color: Colors.textMuted, fontSize: 10, marginLeft: 8 },
});
