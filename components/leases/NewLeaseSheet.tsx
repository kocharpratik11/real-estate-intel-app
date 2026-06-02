import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import { createLease } from '@/lib/api/leases_write';
import { hapticSuccess, hapticError } from '@/lib/haptics';

type Props = {
  unitId:       string;
  unitLabel:    string;
  workspaceId:  string;
  visible:      boolean;
  onClose:      () => void;
  onSuccess:    () => void;
};

export function NewLeaseSheet({ unitId, unitLabel, workspaceId, visible, onClose, onSuccess }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const [startDate,     setStartDate]     = useState(today);
  const [endDate,       setEndDate]       = useState('');
  const [monthlyRent,   setMonthlyRent]   = useState('');
  const [deposit,       setDeposit]       = useState('');
  const [status,        setStatus]        = useState<'active' | 'draft'>('active');
  // Optional new tenant
  const [firstName,     setFirstName]     = useState('');
  const [lastName,      setLastName]      = useState('');
  const [tenantEmail,   setTenantEmail]   = useState('');
  const [tenantPhone,   setTenantPhone]   = useState('');
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  const reset = () => {
    setStartDate(today); setEndDate(''); setMonthlyRent(''); setDeposit('');
    setStatus('active'); setFirstName(''); setLastName('');
    setTenantEmail(''); setTenantPhone(''); setError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!startDate) { setError('Start date is required'); return; }
    const rent = parseFloat(monthlyRent);
    if (!monthlyRent || isNaN(rent) || rent <= 0) { setError('Enter a valid monthly rent'); return; }
    if (endDate && endDate < startDate) { setError('End date must be on or after start date'); return; }

    setLoading(true);
    setError(null);
    try {
      await createLease({
        unit_id:           unitId,
        workspace_id:      workspaceId,
        start_date:        startDate,
        end_date:          endDate || null,
        monthly_rent:      rent,
        security_deposit:  deposit ? parseFloat(deposit) || null : null,
        status,
        tenant_first_name: firstName || undefined,
        tenant_last_name:  lastName  || undefined,
        tenant_email:      tenantEmail || undefined,
        tenant_phone:      tenantPhone || undefined,
      });
      hapticSuccess();
      reset();
      onSuccess();
    } catch (e: any) {
      hapticError();
      setError(e.message ?? 'Failed to create lease');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>New Lease</Text>

            <View style={styles.contextRow}>
              <Text style={styles.contextIcon}>🏠</Text>
              <Text style={styles.contextName}>{unitLabel}</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Status */}
              <Text style={styles.fieldLabel}>LEASE STATUS</Text>
              <View style={styles.statusRow}>
                {(['active', 'draft'] as const).map(s => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setStatus(s)}
                    style={[styles.statusBtn, status === s && styles.statusBtnActive]}
                  >
                    <Text style={[styles.statusLabel, status === s && styles.statusLabelActive]}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Start date */}
              <Text style={styles.fieldLabel}>START DATE</Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                selectionColor={Colors.indigo}
              />

              {/* End date */}
              <Text style={styles.fieldLabel}>END DATE (optional — leave blank for month-to-month)</Text>
              <TextInput
                style={styles.input}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                selectionColor={Colors.indigo}
              />

              {/* Monthly rent */}
              <Text style={styles.fieldLabel}>MONTHLY RENT</Text>
              <View style={styles.amountRow}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={monthlyRent}
                  onChangeText={setMonthlyRent}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={Colors.textMuted}
                  selectionColor={Colors.indigo}
                />
              </View>

              {/* Security deposit */}
              <Text style={styles.fieldLabel}>SECURITY DEPOSIT (optional)</Text>
              <View style={styles.amountRow}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={deposit}
                  onChangeText={setDeposit}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={Colors.textMuted}
                  selectionColor={Colors.indigo}
                />
              </View>

              {/* Tenant section */}
              <Text style={[styles.fieldLabel, styles.sectionDivider]}>TENANT (optional)</Text>
              <View style={styles.nameRow}>
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  placeholderTextColor={Colors.textMuted}
                  selectionColor={Colors.indigo}
                />
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  placeholderTextColor={Colors.textMuted}
                  selectionColor={Colors.indigo}
                />
              </View>
              <TextInput
                style={[styles.input, styles.mt8]}
                value={tenantEmail}
                onChangeText={setTenantEmail}
                placeholder="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={Colors.textMuted}
                selectionColor={Colors.indigo}
              />
              <TextInput
                style={[styles.input, styles.mt8]}
                value={tenantPhone}
                onChangeText={setTenantPhone}
                placeholder="Phone"
                keyboardType="phone-pad"
                placeholderTextColor={Colors.textMuted}
                selectionColor={Colors.indigo}
              />

              {error && <Text style={styles.error}>{error}</Text>}

              <Button label="Create Lease" onPress={handleSubmit} loading={loading} style={styles.submitBtn} />
              <TouchableOpacity onPress={handleClose} style={styles.cancelBtn}>
                <Text style={styles.cancelLabel}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheetWrap: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor:      Colors.card,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal:    16,
    paddingBottom:        36,
    maxHeight:            '90%',
  },
  handle: {
    width: 40, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16,
  },
  title: { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 16 },
  contextRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    padding: 12, gap: 10, marginBottom: 20,
  },
  contextIcon: { fontSize: 16 },
  contextName: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  fieldLabel: {
    color: Colors.textMuted, fontSize: 9, fontWeight: '700',
    letterSpacing: 0.8, marginBottom: 6, marginTop: 16,
  },
  sectionDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 16,
  },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg,
  },
  statusBtnActive:  { backgroundColor: Colors.indigo, borderColor: Colors.indigo },
  statusLabel:      { color: Colors.textMuted, fontSize: 13 },
  statusLabelActive:{ color: Colors.white, fontWeight: '700' },
  input: {
    backgroundColor: Colors.bg, borderRadius: 10, borderWidth: 1,
    borderColor: Colors.border, padding: 14, color: Colors.text, fontSize: 13,
  },
  mt8: { marginTop: 8 },
  nameRow: { flexDirection: 'row', gap: 8 },
  halfInput: { flex: 1 },
  amountRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 4,
  },
  dollarSign:  { color: Colors.textMuted, fontSize: 20, fontWeight: '600' },
  amountInput: { flex: 1, color: Colors.text, fontSize: 22, fontWeight: '700' },
  error:       { color: Colors.red, fontSize: 12, marginTop: 8 },
  submitBtn:   { marginTop: 20 },
  cancelBtn:   { alignItems: 'center', marginTop: 12 },
  cancelLabel: { color: Colors.textMuted, fontSize: 13 },
});
