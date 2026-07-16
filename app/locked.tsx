import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Gradients } from '@/constants/theme';

export default function LockedScreen() {
  const insets = useSafeAreaInsets();
  const { unlockWithBiometrics, signOut, biometricLabel } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Auto-fire biometric prompt as soon as the screen mounts
  useEffect(() => {
    triggerBiometrics();
  }, []);

  const triggerBiometrics = async () => {
    setLoading(true);
    setError(null);
    const result = await unlockWithBiometrics();
    setLoading(false);

    if (result === 'success') {
      // AuthContext state is now 'authenticated' — _layout will re-render
      return;
    }
    if (result === 'unavailable') {
      // Hardware not available — just unlock (shouldn't reach here normally)
      setError('Biometrics unavailable. Use password to sign in.');
    }
    // 'cancelled' — user dismissed, show retry UI
  };

  const handleUsePassword = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <LinearGradient
        colors={Gradients.primary}
        style={styles.hero}
      >
        <View style={styles.logoMark}>
          <Text style={styles.logoSpark}>✦</Text>
        </View>
        <Text style={styles.appName}>Asset Brain</Text>
        <Text style={styles.tagline}>Your portfolio is waiting</Text>
      </LinearGradient>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.blue} />
        ) : (
          <>
            <TouchableOpacity
              style={styles.biometricBtn}
              onPress={triggerBiometrics}
              activeOpacity={0.8}
            >
              <Text style={styles.biometricIcon}>󾓦</Text>
              <Text style={styles.biometricLabel}>Unlock with {biometricLabel}</Text>
            </TouchableOpacity>

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              onPress={handleUsePassword}
              activeOpacity={0.7}
              style={styles.passwordBtn}
            >
              <Text style={styles.passwordLabel}>Use Password Instead</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: Colors.bgPrimary,
  },
  hero: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 24,
    gap:               8,
  },
  logoMark: {
    width:           72,
    height:          72,
    borderRadius:    22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    8,
  },
  logoSpark: { color: '#FFFFFF', fontSize: 32, fontWeight: '700' },
  appName:   { color: '#FFFFFF', fontSize: 26, fontWeight: '700' },
  tagline:   { color: 'rgba(255,255,255,0.7)', fontSize: 14 },

  content: {
    paddingHorizontal: 32,
    paddingVertical:   48,
    alignItems:        'center',
    gap:               16,
  },

  biometricBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    backgroundColor: Colors.blue,
    borderRadius:    14,
    paddingVertical: 16,
    paddingHorizontal: 28,
    width:           '100%',
    justifyContent:  'center',
  },
  biometricIcon:  { fontSize: 22, color: '#FFFFFF' },
  biometricLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  error: {
    color:     Colors.error,
    fontSize:  12,
    textAlign: 'center',
  },

  passwordBtn:   { paddingVertical: 12 },
  passwordLabel: { color: Colors.textTertiary, fontSize: 14 },
});
