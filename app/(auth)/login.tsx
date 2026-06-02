import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';

export default function LoginScreen() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) { setError('Enter your email and password'); return; }
    setLoading(true);
    setError(null);
    const { data: authData, error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    // If user has no workspace yet, send them through onboarding
    const wsId = authData.user?.user_metadata?.current_workspace_id;
    if (!wsId) {
      router.replace('/onboarding');
    } else {
      router.replace('/workspace-picker');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      {/* Hero gradient */}
      <LinearGradient colors={['#6366F1', '#7C3AED']} style={styles.hero}>
        <View style={styles.logoMark}>
          <Text style={styles.logoSpark}>✦</Text>
        </View>
        <Text style={styles.appName}>Asset Brain</Text>
        <Text style={styles.tagline}>Your portfolio, intelligently managed</Text>
      </LinearGradient>

      {/* Form card */}
      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formInner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Sign in to your account</Text>

        <Text style={styles.fieldLabel}>EMAIL</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={t => { setEmail(t); setError(null); }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="you@example.com"
          placeholderTextColor={Colors.textMuted}
          selectionColor={Colors.indigo}
        />

        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>PASSWORD</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={t => { setPassword(t); setError(null); }}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={Colors.textMuted}
          selectionColor={Colors.indigo}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Button label="Sign In" onPress={handleLogin} loading={loading} style={styles.btn} />

        <TouchableOpacity style={styles.forgotBtn} activeOpacity={0.7}>
          <Text style={styles.forgotLabel}>Forgot password?</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  hero: {
    paddingTop:      72,
    paddingBottom:   40,
    alignItems:      'center',
    gap:             8,
  },
  logoMark: {
    width:           64,
    height:          64,
    borderRadius:    20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    8,
  },
  logoSpark: { color: Colors.white, fontSize: 28, fontWeight: '700' },
  appName:   { color: Colors.white, fontSize: 24, fontWeight: '700' },
  tagline:   { color: 'rgba(255,255,255,0.75)', fontSize: 13 },

  formScroll: { flex: 1, backgroundColor: Colors.bg },
  formInner: {
    padding:     24,
    paddingTop:  28,
  },
  sectionTitle: {
    color:        Colors.text,
    fontSize:     18,
    fontWeight:   '700',
    marginBottom: 24,
  },
  fieldLabel: {
    color:        Colors.textMuted,
    fontSize:     9,
    fontWeight:   '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         14,
    color:           Colors.text,
    fontSize:        15,
  },
  error: { color: Colors.red, fontSize: 12, marginTop: 10 },
  btn:   { marginTop: 24 },
  forgotBtn:   { alignItems: 'center', marginTop: 16, paddingVertical: 8 },
  forgotLabel: { color: Colors.indigo, fontSize: 13 },
});
