import { Tabs, router } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

function TabIcon({ label, emoji, focused }: { label: string; emoji: string; focused: boolean }) {
  return (
    <View style={styles.tabIcon}>
      <Text style={[styles.emoji, { opacity: focused ? 1 : 0.5 }]}>{emoji}</Text>
      <Text style={[styles.tabLabel, { color: focused ? Colors.blue : Colors.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

function FloatingChatButton() {
  return (
    <TouchableOpacity
      style={styles.fab}
      onPress={() => router.push('/chat')}
      activeOpacity={0.85}
    >
      <Text style={styles.fabIcon}>✦</Text>
    </TouchableOpacity>
  );
}

export default function AppLayout() {
  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown:     false,
          tabBarStyle:     styles.tabBar,
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon label="Home"      emoji="⌂"  focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="portfolio"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon label="Portfolio" emoji="⊞"  focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="alerts"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon label="Alerts"    emoji="🔔" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon label="More"      emoji="☰"  focused={focused} />,
          }}
        />
      </Tabs>
      <FloatingChatButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fab: {
    position:        'absolute',
    bottom:          96,
    right:           16,
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: Colors.blue,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     Colors.blue,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.35,
    shadowRadius:    10,
    elevation:       8,
  },
  fabIcon: { color: Colors.white, fontSize: 20, fontWeight: '700' },
  tabBar: {
    backgroundColor: Colors.card,
    borderTopColor:  Colors.border,
    borderTopWidth:  1,
    height:          80,
    paddingBottom:   16,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: -2 },
    shadowOpacity:   0.04,
    shadowRadius:    8,
    elevation:       8,
  },
  tabIcon: {
    alignItems: 'center',
    gap:        2,
    marginTop:  8,
  },
  emoji: {
    fontSize: 20,
  },
  tabLabel: {
    fontSize:   10,
    fontWeight: '500',
  },
});
