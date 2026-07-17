import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { createProperty, PROPERTY_TYPES } from '@/lib/api/properties_write';
import { hapticSuccess, hapticError, hapticLight } from '@/lib/haptics';
import { openWebApp } from '@/lib/utils/propertySetup';
import { Colors, Gradients } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import type { Property } from '@/types';

export default function AddPropertyScreen() {
  const insets = useSafeAreaInsets();

  const [name,          setName]          = useState('');
  const [address,       setAddress]       = useState('');
  const [city,          setCity]          = useState('');
  const [state,         setState]         = useState('');
  const [zip,           setZip]           = useState('');
  const [propType,      setPropType]      = useState<Property['property_type']>('sfh');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim())    { setError('Property name is required'); return; }
    if (!address.trim()) { setError('Address is required'); return; }
    if (!city.trim())    { setError('City is required'); return; }
    if (!state.trim())   { setError('State is required'); return; }

    const purchase = purchasePrice ? parseFloat(purchasePrice.replace(/,/g, '')) : null;
    if (purchasePrice && (isNaN(purchase!) || purchase! < 0)) {
      setError('Enter a valid purchase price');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/(auth)/login'); return; }
      const wsId = user.user_metadata?.current_workspace_id;
      if (!wsId) { setError('No workspace selected. Switch workspaces first.'); setLoading(false); return; }

      const prop = await createProperty({
        workspace_id:  wsId,
        name:          name.trim(),
        address_line1: address.trim(),
        city:          city.trim(),
        state:         state.trim().toUpperCase().slice(0, 2),
        zip:           zip.trim() || null,
        property_type: propType,
        unit_count:    1,
        purchase_price: purchase,
      });

      hapticSuccess();
      router.replace({ pathname: '/(app)/portfolio/[id]', params: { id: prop.id } });
    } catch (e: any) {
      hapticError();
      setError(e.message ?? 'Failed to add property');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: Colors.indigo }]}>
      <LinearGradient colors={Gradients.primary} style={[styles.hero, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backLabel}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.heroTitle}>Add Property</Text>
        <Text style={styles.heroSub}>Quick capture — complete setup on web</Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          {/* Basic Info */}
          <Text style={styles.fieldLabel}>PROPERTY NAME</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Oak Street Duplex"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.indigo}
            autoFocus
          />

          <Text style={styles.fieldLabel}>ADDRESS</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="123 Main St"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.indigo}
          />

          <View style={styles.row}>
            <View style={styles.flex2}>
              <Text style={styles.fieldLabel}>CITY</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="Chicago"
                placeholderTextColor={Colors.textMuted}
                selectionColor={Colors.indigo}
              />
            </View>
            <View style={styles.stateCol}>
              <Text style={styles.fieldLabel}>STATE</Text>
              <TextInput
                style={styles.input}
                value={state}
                onChangeText={v => setState(v.toUpperCase().slice(0, 2))}
                placeholder="IL"
                placeholderTextColor={Colors.textMuted}
                selectionColor={Colors.indigo}
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>
            <View style={styles.zipCol}>
              <Text style={styles.fieldLabel}>ZIP</Text>
              <TextInput
                style={styles.input}
                value={zip}
                onChangeText={setZip}
                placeholder="60601"
                placeholderTextColor={Colors.textMuted}
                selectionColor={Colors.indigo}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
          </View>

          {/* Property Type */}
          <Text style={styles.fieldLabel}>PROPERTY TYPE</Text>
          <View style={styles.typeGrid}>
            {PROPERTY_TYPES.map(t => (
              <TouchableOpacity
                key={t.value}
                onPress={() => { hapticLight(); setPropType(t.value); }}
                style={[styles.typeBtn, propType === t.value && styles.typeBtnActive]}
              >
                <Text style={[styles.typeLabel, propType === t.value && styles.typeLabelActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Purchase Price */}
          <Text style={styles.fieldLabel}>PURCHASE PRICE (optional)</Text>
          <View style={styles.amountRow}>
            <Text style={styles.dollarSign}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={purchasePrice}
              onChangeText={setPurchasePrice}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.indigo}
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Button label="Add Property" onPress={handleSubmit} loading={loading} style={styles.submitBtn} />

          {/* Web CTA */}
          <TouchableOpacity style={styles.webCta} onPress={openWebApp} activeOpacity={0.7}>
            <Text style={styles.webCtaText}>
              ✦  For mortgage docs, full financials & AI setup — visit{' '}
              <Text style={styles.webCtaLink}>assetbrain.app</Text>
            </Text>
          </TouchableOpacity>

          <View style={{ height: insets.bottom + 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    paddingHorizontal: 16,
    paddingBottom:     20,
  },
  backBtn:   { alignSelf: 'flex-end', padding: 4, marginBottom: 8 },
  backLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 18 },
  heroTitle: { color: Colors.white, fontSize: 22, fontWeight: '700' },
  heroSub:   { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },

  body:    { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 20 },

  fieldLabel: {
    color: Colors.textMuted, fontSize: 9, fontWeight: '700',
    letterSpacing: 0.8, marginBottom: 6, marginTop: 18,
  },
  input: {
    backgroundColor: Colors.card, borderRadius: 10, borderWidth: 1,
    borderColor: Colors.border, padding: 14, color: Colors.text, fontSize: 13,
  },
  row:      { flexDirection: 'row', gap: 10 },
  flex2:    { flex: 2 },
  stateCol: { width: 58 },
  zipCol:   { width: 80 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  typeBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  typeBtnActive:   { backgroundColor: Colors.indigo, borderColor: Colors.indigo },
  typeLabel:       { color: Colors.textMuted, fontSize: 13 },
  typeLabelActive: { color: Colors.white, fontWeight: '700' },

  amountRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 4,
  },
  dollarSign:  { color: Colors.textMuted, fontSize: 18, fontWeight: '600' },
  amountInput: { flex: 1, color: Colors.text, fontSize: 18, fontWeight: '700' },

  error:     { color: Colors.red, fontSize: 12, marginTop: 12 },
  submitBtn: { marginTop: 24 },

  webCta: {
    marginTop:   20,
    paddingVertical: 14,
    alignItems:  'center',
  },
  webCtaText: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  webCtaLink: { color: Colors.indigo, fontWeight: '600' },
});
