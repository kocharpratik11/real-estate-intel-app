import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import { Colors } from '@/constants/colors';

type Props = {
  width:   number | `${number}%`;
  height:  number;
  radius?: number;
  style?:  ViewStyle;
};

export function Skeleton({ width, height, radius = 6, style }: Props) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        { width: width as any, height, borderRadius: radius, opacity },
        style,
      ]}
    />
  );
}

// Pre-built skeleton layouts for common screens

export function PropertyRowSkeleton() {
  return (
    <View style={styles.rowSkeleton}>
      <View style={styles.rowSkeletonLeft}>
        <Skeleton width="60%" height={14} radius={4} style={styles.mb6} />
        <Skeleton width="40%" height={10} radius={4} />
      </View>
      <Skeleton width={48} height={20} radius={4} />
    </View>
  );
}

export function StatCardSkeleton() {
  return (
    <View style={styles.statCard}>
      <Skeleton width={48} height={22} radius={4} style={styles.mb6} />
      <Skeleton width={36} height={10} radius={4} />
    </View>
  );
}

export function HomeSkeletonScreen() {
  return (
    <View style={styles.homeSkeleton}>
      {/* Hero card */}
      <View style={styles.heroCard}>
        <Skeleton width="70%" height={16} radius={4} style={styles.mb10} />
        <Skeleton width="90%" height={12} radius={4} style={styles.mb6} />
        <Skeleton width="50%" height={12} radius={4} />
      </View>
      {/* Stats row */}
      <View style={styles.statsRow}>
        {[1,2,3,4].map(i => <StatCardSkeleton key={i} />)}
      </View>
      {/* List items */}
      {[1,2,3].map(i => <PropertyRowSkeleton key={i} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.border,
  },
  mb6:  { marginBottom: 6 },
  mb10: { marginBottom: 10 },
  rowSkeleton: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.card,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         14,
    marginHorizontal: 16,
    marginBottom:    8,
    justifyContent:  'space-between',
  },
  rowSkeletonLeft: { flex: 1, marginRight: 12 },
  statCard: {
    flex:             1,
    alignItems:       'center',
    paddingVertical:  10,
  },
  statsRow: {
    flexDirection:    'row',
    backgroundColor:  Colors.card,
    borderRadius:     14,
    borderWidth:      1,
    borderColor:      Colors.border,
    marginHorizontal: 16,
    marginBottom:     12,
    paddingVertical:  2,
  },
  heroCard: {
    backgroundColor:  Colors.card,
    borderRadius:     16,
    borderWidth:      1,
    borderColor:      Colors.border,
    marginHorizontal: 16,
    padding:          16,
    marginBottom:     12,
  },
  homeSkeleton: {
    paddingTop: 16,
  },
});
