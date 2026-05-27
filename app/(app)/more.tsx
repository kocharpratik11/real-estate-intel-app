import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

type RowProps = { icon: string; label: string; sub?: string; onPress: () => void; danger?: boolean };

function Row({ icon, label, sub, onPress, danger }: RowProps) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.row} activeOpacity={0.7}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger && { color: Colors.red }]}>{label}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      {!danger && <Text style={styles.rowChevron}>›</Text>}
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

export default function MoreScreen() {
  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>More</Text>
        </View>

        {/* Profile */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileInitials}>PK</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Pratik Kochar</Text>
            <Text style={styles.profileEmail}>kocharpratik11@gmail.com</Text>
          </View>
          <TouchableOpacity style={styles.editBtn}>
            <Text style={styles.editLabel}>Edit</Text>
          </TouchableOpacity>
        </View>

        <Section title="WORKSPACE">
          <Row icon="⊞" label="Kochar Properties"    sub="8 properties  •  Owner"      onPress={() => router.push('/workspace-picker')} />
          <Row icon="+"  label="Add / Join Workspace" sub="Create or accept an invite"   onPress={() => {}} />
        </Section>

        <Section title="PREFERENCES">
          <Row icon="🔔" label="Notifications" sub="Alerts, reminders, updates" onPress={() => {}} />
          <Row icon="💵" label="Currency"      sub="USD — US Dollar"            onPress={() => {}} />
          <Row icon="📅" label="Date Format"   sub="MM/DD/YYYY"                 onPress={() => {}} />
        </Section>

        <Section title="SUPPORT">
          <Row icon="❓" label="Help Center"    onPress={() => {}} />
          <Row icon="💬" label="Send Feedback"  onPress={() => {}} />
          <Row icon="⭐" label="Rate the App"   onPress={() => {}} />
        </Section>

        <Section title="ACCOUNT">
          <Row icon="🔒" label="Change Password" onPress={() => {}} />
          <Row icon="🚪" label="Sign Out"         onPress={handleSignOut} danger />
        </Section>

        <Text style={styles.version}>Real Estate Intel  v0.1.0</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  title:  { color: Colors.text, fontSize: 22, fontWeight: '700' },
  profileCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.card,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     Colors.border,
    marginHorizontal: 16,
    marginVertical:  12,
    padding:         16,
    gap:             12,
  },
  profileAvatar: {
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: Colors.blue,
    alignItems:      'center',
    justifyContent:  'center',
  },
  profileInitials: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  profileInfo:     { flex: 1 },
  profileName:     { color: Colors.text, fontSize: 15, fontWeight: '700' },
  profileEmail:    { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  editBtn:  { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  editLabel:{ color: Colors.textSub, fontSize: 12 },
  section:  { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: {
    color:      Colors.textMuted,
    fontSize:   9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.border,
    overflow:        'hidden',
  },
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap:             12,
  },
  rowIcon:    { fontSize: 16, width: 22 },
  rowText:    { flex: 1 },
  rowLabel:   { color: Colors.text, fontSize: 14 },
  rowSub:     { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  rowChevron: { color: Colors.textMuted, fontSize: 18 },
  version:    { color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8 },
});
