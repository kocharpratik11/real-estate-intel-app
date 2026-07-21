import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import { recordLumpSumPayment } from '@/lib/api/rent';
import { hapticSuccess, hapticError } from '@/lib/haptics';
import type { RentPayment } from '@/types';

type Props = {
  leaseId:            string;
  propertyId:         string;
  unitLabel:          string;
  outstandingCharges: RentPayment[];  // pending/partial/late charges for this lease, excluding credits
  visible:            boolean;
  onClose:            () => void;
  onSuccess:          () => void;
};

const today = () => new Date().toISOString().slice(0, 10);

const chargeLabel = (p: RentPayment) => {
  if (p.charge_description) return p.charge_description;
  const LABELS: Record<string, string> = {
    rent:             'Monthly Rent',
    late_fee:         'Late Fee',
    security_deposit: 'Security Deposit',
    pet_fee:          'Pet Fee',
    other:            'Other Charge',
  };
  const label = LABELS[p.charge_type] ?? 'Charge';
  if (p.period_month && p.period_year) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${label} — ${months[p.period_month - 1]} ${p.period_year}`;
  }
  return label;
};

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function RecordPaymentSheet({
  leaseId, propertyId, unitLabel, outstandingCharges, visible, onClose, onSuccess,
}: Props) {
  const [amount,  setAmount]  = useState('');
  const [date,    setDate]    = useState(today());
  const [notes,   setNotes]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Outstanding charges in FIFO (due_date) order, same as the web app.
  const outstanding = useMemo(() => (
    [...outstandingCharges]
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .map(p => ({ ...p, remaining: p.amount_due - (p.amount_paid ?? 0) }))
  ), [outstandingCharges]);

  const totalOutstanding = outstanding.reduce((s, p) => s + p.remaining, 0);
  const enteredAmount = parseFloat(amount) || 0;
  const overpayment = Math.max(0, enteredAmount - totalOutstanding);

  // Live allocation preview: how this payment will be applied, oldest-first.
  const preview = useMemo(() => {
    let remaining = enteredAmount;
    return outstanding
      .map(charge => {
        const applying = Math.min(remaining, charge.remaining);
        remaining -= applying;
        return { charge, applying };
      })
      .filter(x => x.applying > 0);
  }, [outstanding, enteredAmount]);

  const handleSubmit = async () => {
    const paid = parseFloat(amount);
    if (isNaN(paid) || paid <= 0) { setError('Enter a valid amount'); return; }
    setLoading(true);
    setError(null);
    try {
      await recordLumpSumPayment({
        leaseId, propertyId,
        amount: paid,
        paymentDate: date,
        notes: notes || undefined,
      });
      hapticSuccess();
      onSuccess();
    } catch (e: any) {
      hapticError();
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
            <Text style={styles.title}>Record Payment</Text>
            <Text style={styles.subtitle}>Unit {unitLabel} — payment will be applied oldest-first</Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Outstanding charges */}
              {outstanding.length > 0 ? (
                <View style={styles.box}>
                  <Text style={styles.boxLabel}>OUTSTANDING CHARGES</Text>
                  {outstanding.map(p => (
                    <View key={p.id} style={styles.boxRow}>
                      <Text style={styles.boxRowLabel} numberOfLines={1}>{chargeLabel(p)}</Text>
                      <Text style={styles.boxRowValue}>${fmt(p.remaining)}</Text>
                    </View>
                  ))}
                  <View style={[styles.boxRow, styles.boxTotalRow]}>
                    <Text style={styles.boxTotalLabel}>Total outstanding</Text>
                    <Text style={styles.boxTotalValue}>${fmt(totalOutstanding)}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.box}>
                  <Text style={styles.boxEmpty}>
                    No outstanding charges. Payment will be recorded as a prepayment credit.
                  </Text>
                </View>
              )}

              {/* Amount */}
              <Text style={styles.fieldLabel}>AMOUNT RECEIVED</Text>
              <View style={styles.amountRow}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={Colors.textMuted}
                  selectionColor={Colors.blue}
                  autoFocus
                />
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

              {/* Allocation preview */}
              {enteredAmount > 0 && (
                <View style={styles.box}>
                  <Text style={styles.boxLabel}>HOW THIS WILL BE APPLIED</Text>
                  {preview.map(({ charge, applying }) => (
                    <View key={charge.id} style={styles.boxRow}>
                      <Text style={styles.boxRowLabel} numberOfLines={1}>{chargeLabel(charge)}</Text>
                      <Text style={[styles.boxRowValue, { color: Colors.green }]}>−${fmt(applying)}</Text>
                    </View>
                  ))}
                  {overpayment > 0.005 && (
                    <View style={[styles.boxRow, styles.boxTotalRow]}>
                      <Text style={[styles.boxTotalLabel, { color: Colors.yellow }]}>Prepayment credit</Text>
                      <Text style={[styles.boxTotalValue, { color: Colors.yellow }]}>−${fmt(overpayment)}</Text>
                    </View>
                  )}
                  {preview.length === 0 && overpayment <= 0.005 && (
                    <Text style={styles.boxEmpty}>Amount does not cover any charge.</Text>
                  )}
                </View>
              )}

              {/* Notes */}
              <Text style={styles.fieldLabel}>NOTE (optional)</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. check #1042, Zelle transfer"
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
  },
  subtitle: {
    color:        Colors.textMuted,
    fontSize:     12,
    marginTop:    2,
    marginBottom: 16,
  },
  box: {
    backgroundColor: Colors.bg,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         12,
    marginBottom:    16,
  },
  boxLabel: {
    color:         Colors.textMuted,
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 0.8,
    marginBottom:  8,
  },
  boxRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    gap:            8,
    marginBottom:   4,
  },
  boxRowLabel: { color: Colors.textSub, fontSize: 12, flex: 1 },
  boxRowValue: { color: Colors.text,    fontSize: 12, fontWeight: '600' },
  boxTotalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop:      6,
    paddingTop:     6,
    marginBottom:   0,
  },
  boxTotalLabel: { color: Colors.textSub, fontSize: 12, fontWeight: '700' },
  boxTotalValue: { color: Colors.red,     fontSize: 13, fontWeight: '700' },
  boxEmpty: { color: Colors.textMuted, fontSize: 12 },
  fieldLabel: {
    color:      Colors.textMuted,
    fontSize:   9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop:   4,
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
    marginBottom:    16,
  },
  dollarSign: { color: Colors.textMuted, fontSize: 20, fontWeight: '600' },
  amountInput: {
    flex:      1,
    color:     Colors.text,
    fontSize:  26,
    fontWeight:'700',
  },
  input: {
    backgroundColor: Colors.bg,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         14,
    color:           Colors.text,
    fontSize:        13,
    marginBottom:    16,
  },
  notesInput: { minHeight: 60, textAlignVertical: 'top' },
  error: { color: Colors.red, fontSize: 12, marginBottom: 8 },
  submitBtn: { marginTop: 4 },
  cancelBtn: { alignItems: 'center', marginTop: 12 },
  cancelLabel: { color: Colors.textMuted, fontSize: 13 },
});
