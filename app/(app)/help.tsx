import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Linking } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Gradients } from '@/constants/colors';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How is a property’s Health Score calculated?',
    a: 'Health Score is out of 100, made up of four parts: Collection (40 pts, % of this month’s rent collected), Occupancy (20 pts, % of units currently leased), Lease Health (20 pts, deducts for leases expiring within 60 days), and Maintenance (20 pts, deducts for open urgent/high-priority tickets). 80+ reads healthy, 60–79 needs attention, below 60 is critical.',
  },
  {
    q: 'What does "% collected" mean if a unit is vacant?',
    a: 'If a unit has no active lease, there’s nothing due, so it doesn’t count against your collection rate — it’s treated as neutral rather than a missed payment. Vacancy itself is reflected separately in the Occupancy score and the vacant units count.',
  },
  {
    q: 'How do I record a rent payment?',
    a: 'Open a property → Rent tab → View Rent Ledger. Any unpaid, late, or partial charge shows a "Record Payment" button directly on its row — tap it to log the amount, date, and method.',
  },
  {
    q: 'How is Cash Flow different from Net Income?',
    a: 'Both are NOI minus debt service (mortgage payment) — the actual money left over after your loan payment, not just gross rent collected. They should generally match at the portfolio level.',
  },
  {
    q: 'Why is a loan’s balance different from what I expect?',
    a: 'Remaining mortgage balance is calculated from the loan’s original amount, rate, and origination date using standard amortization — not a manually tracked figure — so it updates automatically as time passes.',
  },
  {
    q: 'How do I see a unit’s full payment history?',
    a: 'On the Rent Ledger, tap a specific unit in the filter row instead of "All Units" — it switches to that unit’s complete history across every month instead of just the one you’re viewing.',
  },
  {
    q: 'Where do I add mortgage details, documents, or full financials?',
    a: 'Mobile is built for day-to-day operations. Full property setup — mortgage terms, document uploads, AI financial extraction — happens on the web app at assetbrain.app.',
  },
  {
    q: 'How do I invite someone to my workspace?',
    a: 'Workspace member management happens on the web app. From More → Invite Members, we’ll take you there.',
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity style={styles.faqCard} onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
      <View style={styles.faqHeader}>
        <Text style={styles.faqQ}>{q}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
      </View>
      {open && <Text style={styles.faqA}>{a}</Text>}
    </TouchableOpacity>
  );
}

export default function HelpScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <LinearGradient colors={Gradients.primary} style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={styles.heroTop}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backBtn}>‹ More</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.heroTitle}>Help Center</Text>
        <Text style={styles.heroSub}>Common questions about Asset Brain</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
      >
        {FAQS.map(f => <FAQItem key={f.q} q={f.q} a={f.a} />)}

        <TouchableOpacity
          style={styles.contactCard}
          onPress={() => Linking.openURL('mailto:support@assetbrain.app?subject=Asset%20Brain%20Support')}
          activeOpacity={0.8}
        >
          <Ionicons name="mail" size={18} color={Colors.blue} />
          <View style={{ flex: 1 }}>
            <Text style={styles.contactTitle}>Still need help?</Text>
            <Text style={styles.contactSub}>Email support@assetbrain.app</Text>
          </View>
        </TouchableOpacity>
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
  faqCard: {
    backgroundColor: Colors.card,
    borderRadius:    12,
    borderWidth:      1,
    borderColor:      Colors.border,
    padding:          14,
    marginBottom:     10,
  },
  faqHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    gap:            8,
  },
  faqQ: { color: Colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  faqA: { color: Colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 10 },
  contactCard: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    backgroundColor: Colors.aiCard,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.aiBorder,
    padding:         14,
    marginTop:       12,
  },
  contactTitle: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  contactSub:   { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
});
