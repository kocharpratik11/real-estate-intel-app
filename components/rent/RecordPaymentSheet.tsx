"use client";
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import { recordPayment } from '@/lib/api/rent';
import type { RentPayment } from '@/types';

type Props = {
  payment:   RentPayment;
  visible:   boolean;
  onClose:   () => void;
  onSuccess: () => void;
};

const METHODS = ['Bank Transfer', 'Check', 'Cash', 'Zelle', 'Venmo'] as const;
type Method = typeof METHODS[number];

const today = () => new Date().toISOString().slice(0, 10);

export function RecordPaymentSheet({ payment, visible, onClose, onSuccess }: Props) {
  const [amount, setAmount]   = useState(String(payment.amount_due));
  const [date,   setDate]     = useState(today());
  const [method, setMethod]   = useState<Method>('Bank Transfer');
  const [notes,  setNotes]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleSubmit = async () => {
    const paid = parseFloat(amount);
    if (isNaN(paid) || paid <= 0) { setError('Enter a valid amount'); return; }
    setLoading(true);
    setError(null);
    try {
      await recordPayment(payment.id, paid, date, method, notes || undefined);
      onSuccess();
    } catch (e: any) {
      setError(e.message ?? 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>Record Rent Payment</Text>

            {/* Tenant context */}
            <View style={styles.contextRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {payment.units?.label?.slice(0, 2).toUpperCase() ?? 'U'}
                </Text>
              </View>
              <View>
                <Text style={styles.contextName}>{payment.units?.label ?? 'Unit'}</Text>
                <Text style={styles.contextSub}>
                  {payment.charge_description ?? 'Monthly Rent'} — Due {payment.due_date}
                </Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Amount */}
              <Text style={styles.fieldLabel}>AMOUNT</Text>
              <View style={styles.amountRow}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholderTextColor={Colors.textMuted}
                  selectionColor={Colors.blue}
                />
                <Text style={styles.expected}>
                  Expected: ${payment.amount_due.toLocaleString()}
                </Text>
              </View>

              {/* Date */}
              <Text style={styles.fieldLabel}>PAYMENT DATE</Text>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                selectionColor={Colors.blue}
              />

              {/* Method */}
              <Text style={styles.fieldLabel}>PAYMENT METHOD</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.methodRow}>
                {METHODS.map(m => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setMethod(m)}
                    style={[styles.methodChip, m === method && styles.methodChipActive]}
                  >
                    <Text style={[styles.methodLabel, m === method && styles.methodLabelActive]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Notes */}
              <Text style={styles.fieldLabel}>NOTE (optional)</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add a note..."
                placeholderTextColor={Colors.textMuted}
                multiline
                selectionColor={Colors.blue}
              />

              {error && <Text style={styles.error}>{error}</Text>}

              <Button label="Record Payment" onPress={handleSubmit} loading={loading} style={styles.submitBtn} />
              <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
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
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent:  'flex-end',
  },
  sheetWrap: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom:     36,
    maxHeight:         '88%',
  },
  handle: {
    width:           40,
    height:          4,
    backgroundColor: Colors.border,
    borderRadius:    2,
    alignSelf:       'center',
    marginTop:       12,
    marginBottom:    16,
  },
  title: {
    color:      Colors.text,
    fontSize:   18,
    fontWeight: '700',
    marginBottom: 16,
  },
  contextRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.bg,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         12,
    gap:             12,
    marginBottom:    20,
  },
  avatar: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: Colors.blue,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  contextName: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  contextSub:  { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  fieldLabel: {
    color:      Colors.textMuted,
    fontSize:   9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop:   16,
  },
  amountRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.bg,
    borderRadius:    10,
    borderWidth:     1.5,
    borderColor:     Colors.blue,
    padding:         14,
    gap:             4,
  },
  dollarSign: { color: Colors.textMuted, fontSize: 20, fontWeight: '600' },
  amountInput: {
    flex:      1,
    color:     Colors.text,
    fontSize:  26,
    fontWeight:'700',
  },
  expected: { color: Colors.textMuted, fontSize: 11 },
  input: {
    backgroundColor: Colors.bg,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         14,
    color:           Colors.text,
    fontSize:        13,
  },
  notesInput: { minHeight: 60, textAlignVertical: 'top' },
  methodRow: { marginBottom: 4 },
  methodChip: {
    backgroundColor: Colors.bg,
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     Colors.border,
    paddingHorizontal: 12,
    paddingVertical:   8,
    marginRight:     8,
  },
  methodChipActive: { backgroundColor: Colors.blue, borderColor: Colors.blue },
  methodLabel:       { color: Colors.textMuted, fontSize: 12 },
  methodLabelActive: { color: Colors.white, fontWeight: '600' },
  error: { color: Colors.red, fontSize: 12, marginTop: 8 },
  submitBtn: { marginTop: 20 },
  cancelBtn: { alignItems: 'center', marginTop: 12 },
  cancelLabel: { color: Colors.textMuted, fontSize: 13 },
});
