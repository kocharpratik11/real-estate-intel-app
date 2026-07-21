import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Colors, Gradients } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import { hapticSuccess, hapticError } from '@/lib/haptics';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setFirstName(user.user_metadata?.first_name ?? '');
    setLastName(user.user_metadata?.last_name ?? '');
    setEmail(user.email ?? '');
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSave = async () => {
    if (!firstName.trim()) { setError('First name is required'); return; }
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const { error: err } = await supabase.auth.updateUser({
        data: { first_name: firstName.trim(), last_name: lastName.trim() || null },
      });
      if (err) throw err;
      hapticSuccess();
      setSaved(true);
    } catch (e: any) {
      hapticError();
      setError(e.message ?? 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <LinearGradient colors={Gradients.primary} style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={styles.heroTop}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backBtn}>‹ More</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.heroTitle}>Edit Profile</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.fieldLabel}>FIRST NAME</Text>
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={t => { setFirstName(t); setSaved(false); }}
          placeholder="First name"
          placeholderTextColor={Colors.textMuted}
          selectionColor={Colors.blue}
        />

        <Text style={styles.fieldLabel}>LAST NAME</Text>
        <TextInput
          style={styles.input}
          value={lastName}
          onChangeText={t => { setLastName(t); setSaved(false); }}
          placeholder="Last name"
          placeholderTextColor={Colors.textMuted}
          selectionColor={Colors.blue}
        />

        <Text style={styles.fieldLabel}>EMAIL</Text>
        <View style={[styles.input, styles.inputDisabled]}>
          <Text style={styles.disabledText}>{email}</Text>
        </View>
        <Text style={styles.hint}>Email can't be changed here. Contact support if you need to update it.</Text>

        {error && <Text style={styles.error}>{error}</Text>}
        {saved && <Text style={styles.success}>Profile updated</Text>}

        <Button label="Save Changes" onPress={handleSave} loading={loading} style={styles.submitBtn} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  hero: {
    paddingHorizontal: 16,
    paddingBottom:     16,
    gap:               4,
  },
  heroTop:   { marginBottom: 8 },
  backBtn:   { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  scroll:    { flex: 1 },
  fieldLabel: {
    color: Colors.textMuted, fontSize: 9, fontWeight: '700',
    letterSpacing: 0.8, marginBottom: 6, marginTop: 16,
  },
  input: {
    backgroundColor: Colors.card, borderRadius: 10, borderWidth: 1,
    borderColor: Colors.border, padding: 14, color: Colors.text, fontSize: 15,
  },
  inputDisabled: { opacity: 0.6 },
  disabledText:  { color: Colors.textMuted, fontSize: 15 },
  hint:  { color: Colors.textMuted, fontSize: 11, marginTop: 6 },
  error:   { color: Colors.red,   fontSize: 12, marginTop: 16 },
  success: { color: Colors.green, fontSize: 12, marginTop: 16 },
  submitBtn: { marginTop: 24 },
});
