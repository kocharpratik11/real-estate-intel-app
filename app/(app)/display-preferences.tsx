import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Gradients } from '@/constants/colors';
import { getPreferences, updatePreferences, type UserPreferences } from '@/lib/api/preferences';
import { hapticSuccess } from '@/lib/haptics';

const CURRENCIES: { value: string; label: string }[] = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
];

const DATE_FORMATS: { value: string; label: string }[] = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
];

export default function DisplayPreferencesScreen() {
  const insets = useSafeAreaInsets();
  const [prefs,   setPrefs]   = useState<UserPreferences | null>(null);
  const [saving,  setSaving]  = useState<'currency' | 'date_format' | null>(null);

  const load = useCallback(async () => {
    const p = await getPreferences();
    setPrefs(p);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setCurrency = async (currency: string) => {
    if (!prefs) return;
    setSaving('currency');
    setPrefs({ ...prefs, currency });
    try {
      await updatePreferences({ currency });
      hapticSuccess();
    } catch {
      setPrefs(prefs);
    } finally {
      setSaving(null);
    }
  };

  const setDateFormat = async (date_format: string) => {
    if (!prefs) return;
    setSaving('date_format');
    setPrefs({ ...prefs, date_format });
    try {
      await updatePreferences({ date_format });
      hapticSuccess();
    } catch {
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
        <Text style={styles.heroTitle}>Currency & Date Format</Text>
        <Text style={styles.heroSub}>Choose how numbers and dates are displayed</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 24, paddingBottom: insets.bottom + 40 }}
      >
        {!prefs ? (
          <ActivityIndicator color={Colors.blue} style={{ margin: 24 }} />
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>CURRENCY</Text>
              <View style={styles.card}>
                {CURRENCIES.map((c, i) => (
                  <TouchableOpacity
                    key={c.value}
                    onPress={() => setCurrency(c.value)}
                    style={[styles.row, i < CURRENCIES.length - 1 && styles.rowBorder]}
                  >
                    <Text style={styles.rowLabel}>{c.label}</Text>
                    {saving === 'currency' && prefs.currency === c.value ? (
                      <ActivityIndicator size="small" color={Colors.blue} />
                    ) : prefs.currency === c.value ? (
                      <View style={styles.checkDot} />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>DATE FORMAT</Text>
              <View style={styles.card}>
                {DATE_FORMATS.map((d, i) => (
                  <TouchableOpacity
                    key={d.value}
                    onPress={() => setDateFormat(d.value)}
                    style={[styles.row, i < DATE_FORMATS.length - 1 && styles.rowBorder]}
                  >
                    <Text style={styles.rowLabel}>{d.label}</Text>
                    {saving === 'date_format' && prefs.date_format === d.value ? (
                      <ActivityIndicator size="small" color={Colors.blue} />
                    ) : prefs.date_format === d.value ? (
                      <View style={styles.checkDot} />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}
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
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
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
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowLabel:  { color: Colors.text, fontSize: 14 },
  checkDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.blue,
  },
});
