import { useState, useCallback } from 'react';
import { View, Text, Switch, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Colors, Gradients } from '@/constants/colors';
import { getPreferences, updatePreferences, type UserPreferences } from '@/lib/api/preferences';
import { hapticSuccess } from '@/lib/haptics';

type ToggleRow = {
  key:     keyof UserPreferences;
  label:   string;
  sub:     string;
};

const TOGGLES: ToggleRow[] = [
  { key: 'notify_late_rent',    label: 'Late Rent Alerts',    sub: 'Notify when rent is overdue or unpaid by the 5th' },
  { key: 'notify_lease_expiry', label: 'Lease Expiry Alerts', sub: 'Notify 30 days before a lease expires' },
  { key: 'notify_maintenance',  label: 'Maintenance Updates', sub: 'Notify when maintenance ticket status changes' },
];

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const [prefs,   setPrefs]   = useState<UserPreferences | null>(null);
  const [saving,  setSaving]  = useState<keyof UserPreferences | null>(null);

  const load = useCallback(async () => {
    const p = await getPreferences();
    setPrefs(p);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (key: keyof UserPreferences, value: boolean) => {
    if (!prefs) return;
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    setSaving(key);
    try {
      await updatePreferences({ [key]: value });
      hapticSuccess();
    } catch {
      // Revert on error
      setPrefs(prefs);
    } finally {
      setSaving(null);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={Gradients.primary} style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={styles.heroTop}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backBtn}>‹ More</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.heroTitle}>Notifications</Text>
        <Text style={styles.heroSub}>Choose what alerts you receive</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 24, paddingBottom: insets.bottom + 40 }}
      >
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PUSH NOTIFICATIONS</Text>

          {!prefs ? (
            <ActivityIndicator color={Colors.indigo} style={{ margin: 24 }} />
          ) : (
            <View style={styles.card}>
              {TOGGLES.map((row, i) => (
                <View
                  key={row.key}
                  style={[styles.toggleRow, i < TOGGLES.length - 1 && styles.toggleRowBorder]}
                >
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>{row.label}</Text>
                    <Text style={styles.toggleSub}>{row.sub}</Text>
                  </View>
                  {saving === row.key ? (
                    <ActivityIndicator size="small" color={Colors.indigo} />
                  ) : (
                    <Switch
                      value={prefs[row.key] as boolean}
                      onValueChange={v => toggle(row.key, v)}
                      trackColor={{ false: Colors.border, true: Colors.indigo }}
                      thumbColor={Colors.white}
                    />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ABOUT PUSH NOTIFICATIONS</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Push notifications are delivered daily at 9:00 AM. Notification delivery requires
              an active internet connection and app permissions granted on your device.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  hero: {
    paddingHorizontal: 16,
    paddingBottom:     20,
    gap:               4,
  },
  heroTop:   { marginBottom: 8 },
  backBtn:   { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  heroTitle: { color: Colors.white, fontSize: 20, fontWeight: '700' },
  heroSub:   { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  scroll:    { flex: 1 },
  section:   { marginHorizontal: 16, marginBottom: 20 },
  sectionLabel: {
    color: Colors.textMuted, fontSize: 9, fontWeight: '700',
    letterSpacing: 0.8, marginBottom: 8,
  },
  card: {
    backgroundColor: Colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  toggleRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:               12,
  },
  toggleRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  toggleInfo:  { flex: 1 },
  toggleLabel: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  toggleSub:   { color: Colors.textMuted, fontSize: 11, marginTop: 2, lineHeight: 15 },
  infoCard: {
    backgroundColor: Colors.aiCard, borderRadius: 10, borderWidth: 1, borderColor: Colors.aiBorder,
    padding: 14,
  },
  infoText: { color: Colors.textSub, fontSize: 12, lineHeight: 18 },
});
