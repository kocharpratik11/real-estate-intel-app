import { useEffect, useRef, useCallback } from 'react';
import { Tabs, router } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { registerForPushNotifications } from '@/lib/notifications';

function TabIcon({ label, icon, focused }: { label: string; icon: keyof typeof Ionicons.glyphMap; focused: boolean }) {
  return (
    <View style={styles.tabIcon}>
      <Ionicons name={icon} size={22} color={focused ? Colors.blue : Colors.textMuted} />
      <Text
        style={[styles.tabLabel, { color: focused ? Colors.blue : Colors.textMuted }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
    </View>
  );
}

function FloatingChatButton() {
  const pushing = useRef(false);
  const handlePress = useCallback(() => {
    if (pushing.current) return;
    pushing.current = true;
    router.push('/chat');
    setTimeout(() => { pushing.current = false; }, 800);
  }, []);
  return (
    <TouchableOpacity style={styles.fab} onPress={handlePress} activeOpacity={0.85}>
      <Text style={styles.fabIcon}>✦</Text>
    </TouchableOpacity>
  );
}

export default function AppLayout() {
  const notifListener   = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Register for push on first mount (after auth gate)
    registerForPushNotifications().catch(() => {});

    // Listen for incoming foreground notifications
    notifListener.current = Notifications.addNotificationReceivedListener(() => {
      // Badge / sound handled by setNotificationHandler above
    });

    // Handle notification taps — deep link into the app
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (data?.type === 'late_rent' && data?.route) {
        router.push(data.route as any);
      } else {
        router.push('/(app)/alerts');
      }
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

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
            tabBarIcon: ({ focused }) => <TabIcon label="Home"      icon="home"          focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="portfolio"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon label="Portfolio" icon="business"      focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="alerts"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon label="Alerts"    icon="notifications" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon label="More"      icon="menu"          focused={focused} />,
          }}
        />
        {/* Push-only screens that live in this same route group — hidden from the tab bar */}
        <Tabs.Screen name="activity" options={{ href: null }} />
        <Tabs.Screen name="notification-settings" options={{ href: null }} />
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
  fabIcon: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
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
  tabLabel: {
    fontSize:   10,
    fontWeight: '500',
  },
});
