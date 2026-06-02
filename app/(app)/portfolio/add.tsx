import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { createProperty, PROPERTY_TYPES, PROPERTY_USAGE_TYPES } from '@/lib/api/properties_write';
import { hapticSuccess, hapticError, hapticLight } from '@/lib/haptics';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import type { Property } from '@/types';

export default function AddPropertyScreen() {
  const insets = useSafeAreaInsets();

  const [name,        setName]        = useState('');
  const [address,     setAddress]     = useState('');
  const [city,        setCity]        = useState('');
  const [state,       setState]       = useState('');
  const [zip,         setZip]         = useState('');
  const [propType,    setPropType]    = useState<Property['property_type']>('sfh');
  const [usage,       setUsage]       = useState<NonNullable<Property['property_usage']>>('long_term_rental');
  const [unitCount,   setUnitCount]   = useState('1');
  const [purchasePrice, setPurchase]  = useState('');
  const [marketValue, setMarketValue] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim())    { setError('Property name is required'); return; }
    if (!address.trim()) { setError('Address is required'); return; }
    if (!city.trim())    { setError('City is required'); return; }
    if (!state.trim())   { setError('State is required'); return; }

    const units = parseInt(unitCount, 10);
    if (isNaN(units) || units < 1) { setError('Unit count must be at least 1'); return; }

    const purchase = purchasePrice ? parseFloat(purchasePrice.replace(/,/g, '')) : null;
    const market   = marketValue   ? parseFloat(marketValue.replace(/,/g, ''))   : null;

    if (purchasePrice && (isNaN(purchase!) || purchase! < 0)) { setError('Enter a valid purchase price'); return; }
    if (marketValue   && (isNaN(market!)   || market!   < 0)) { setError('Enter a valid market value');   return; }

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/(auth)/login'); return; }
      const wsId = user.user_metadata?.current_workspace_id;
      if (!wsId) { setError('No workspace selected. Switch workspaces first.'); setLoading(false); return; }

      const prop = await createProperty({
        workspace_id:        wsId,
        name:                name.trim(),
        address_line1:       address.trim(),
        city:                city.trim(),
        state:               state.trim().toUpperCase().slice(0, 2),
        zip:                 zip.trim() || null,
        property_type:       propType,
        property_usage:      usage,
        unit_count:          units,
        purchase_price:      purchase,
        current_market_value: market,
      });

      hapticSuccess();
      // Navigate straight to the new property detail
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
      {/* Gradient header */}
      <LinearGradient colors={['#6366F1', '#7C3AED']} style={[styles.hero, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backLabel}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.heroTitle}>Add Property</Text>
        <Text style={styles.heroSub}>Enter the details for your new property</Text>
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
          <Text style={styles.sectionLabel}>BASIC INFO</Text>

          <Text style={styles.fieldLabel}>PROPERTY NAME</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Oak Street Duplex"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.indigo}
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
          <Text style={styles.sectionLabel}>PROPERTY TYPE</Text>
          <View style={styles.typeGrid}>
            {PROPERTY_TYPES.map(t => (
              <TouchableOpacity
                key={t.value}
                onPress={() => {
                  setPropType(t.value);
                  // Auto-set unit count for known types
                  if (t.value === 'sfh')      setUnitCount('1');
                  if (t.value === 'duplex')   setUnitCount('2');
                  if (t.value === 'triplex')  setUnitCount('3');
                  if (t.value === 'fourplex') setUnitCount('4');
                }}
                style={[styles.typeBtn, propType === t.value && styles.typeBtnActive]}
              >
                <Text style={[styles.typeLabel, propType === t.value && styles.typeLabelActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>UNIT COUNT</Text>
          <TextInput
            style={styles.input}
            value={unitCount}
            onChangeText={setUnitCount}
            keyboardType="number-pad"
            placeholder="1"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.indigo}
          />

          {/* Usage */}
          <Text style={styles.sectionLabel}>USAGE</Text>
          {PROPERTY_USAGE_TYPES.map(u => (
            <TouchableOpacity
              key={u.value}
              onPress={() => setUsage(u.value)}
              style={[styles.radioRow, usage === u.value && styles.radioRowActive]}
            >
              <View style={[styles.radioCircle, usage === u.value && styles.radioCircleActive]}>
                {usage === u.value && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.radioLabel, usage === u.value && styles.radioLabelActive]}>
                {u.label}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Financials */}
          <Text style={styles.sectionLabel}>FINANCIALS (optional)</Text>

          <Text style={styles.fieldLabel}>PURCHASE PRICE</Text>
          <View style={styles.amountRow}>
            <Text style={styles.dollarSign}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={purchasePrice}
              onChangeText={setPurchase}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.indigo}
            />
          </View>

          <Text style={styles.fieldLabel}>CURRENT MARKET VALUE</Text>
          <View style={styles.amountRow}>
            <Text style={styles.dollarSign}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={marketValue}
              onChangeText={setMarketValue}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.indigo}
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Button label="Add Property" onPress={handleSubmit} loading={loading} style={styles.submitBtn} />
          <View style={{ height: insets.bottom + 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1 },
  hero: {
    paddingHorizontal: 16,
    paddingBottom:     20,
  },
  backBtn:    { alignSelf: 'flex-end', padding: 4, marginBottom: 8 },
  backLabel:  { color: 'rgba(255,255,255,0.8)', fontSize: 18 },
  heroTitle:  { color: Colors.white, fontSize: 22, fontWeight: '700' },
  heroSub:    { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },

  body:    { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 20 },

  sectionLabel: {
    color: Colors.textMuted, fontSize: 9, fontWeight: '700',
    letterSpacing: 0.8, marginTop: 24, marginBottom: 12,
  },
  fieldLabel: {
    color: Colors.textMuted, fontSize: 9, fontWeight: '700',
    letterSpacing: 0.8, marginBottom: 6, marginTop: 14,
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
  typeBtnActive:  { backgroundColor: Colors.indigo, borderColor: Colors.indigo },
  typeLabel:      { color: Colors.textMuted, fontSize: 13 },
  typeLabelActive:{ color: Colors.white, fontWeight: '700' },

  radioRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: 10, borderWidth: 1,
    borderColor: Colors.border, padding: 14, marginBottom: 8, gap: 12,
  },
  radioRowActive: { borderColor: Colors.indigo, backgroundColor: Colors.aiCard },
  radioCircle: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  radioCircleActive: { borderColor: Colors.indigo },
  radioDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.indigo },
  radioLabel:    { color: Colors.text, fontSize: 13 },
  radioLabelActive: { fontWeight: '600', color: Colors.indigo },

  amountRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 4,
  },
  dollarSign:  { color: Colors.textMuted, fontSize: 18, fontWeight: '600' },
  amountInput: { flex: 1, color: Colors.text, fontSize: 18, fontWeight: '700' },

  error:     { color: Colors.red, fontSize: 12, marginTop: 12 },
  submitBtn: { marginTop: 20 },
});
