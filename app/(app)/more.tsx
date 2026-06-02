import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert as RNAlert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

function initials(name: string) {
  return name.split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const [displayName,   setDisplayName]   = useState('');
  const [email,         setEmail]         = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceRole, setWorkspaceRole] = useState('');

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const first = user.user_metadata?.first_name ?? '';
    const last  = user.user_metadata?.last_name  ?? '';
    const name  = [first, last].filter(Boolean).join(' ') || user.email?.split('@')[0] || 'User';
    setDisplayName(name);
    setEmail(user.email ?? '');
    setWorkspaceName(user.user_metadata?.current_workspace_name ?? '');
    setWorkspaceRole(user.user_metadata?.current_workspace_role ?? 'owner');
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const soon = (label: string) => () =>
    RNAlert.alert(label, 'This feature is not available yet.');

  const handleSignOut = () => {
    RNAlert.alert('Sign Out', 'Are you sure?', [
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

  const roleLabel = workspaceRole.charAt(0).toUpperCase() + workspaceRole.slice(1);

  return (
    <View style={[styles.root, { backgroundColor: Colors.indigo }]}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Profile hero */}
        <LinearGradient
          colors={['#6366F1', '#7C3AED']}
          style={[styles.hero, { paddingTop: insets.top + 20 }]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(displayName || 'U')}</Text>
          </View>
          <Text style={styles.profileName}>{displayName || 'Loading…'}</Text>
          <Text style={styles.profileEmail}>{email}</Text>
          {workspaceName ? (
            <View style={styles.wsBadge}>
              <Text style={styles.wsBadgeText}>{workspaceName}  ·  {roleLabel}</Text>
            </View>
          ) : null}
          <TouchableOpacity style={styles.editBtn} onPress={soon('Edit Profile')}>
            <Text style={styles.editLabel}>Edit Profile</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Sections */}
        <View style={styles.content}>
          <Section title="WORKSPACE">
            <Row
              icon="⊞"
              label={workspaceName || 'Select workspace'}
              sub={workspaceName ? roleLabel : 'Tap to choose a workspace'}
              onPress={() => router.push('/workspace-picker')}
            />
            <Row icon="+" label="Add / Join Workspace" sub="Create or accept an invite" onPress={soon('Add / Join Workspace')} />
          </Section>

          <Section title="PREFERENCES">
            <Row icon="🔔" label="Notifications" sub="Alerts, reminders, updates" onPress={() => router.push('/(app)/notification-settings')} />
            <Row icon="💵" label="Currency"      sub="USD — US Dollar"            onPress={soon('Currency')} />
            <Row icon="📅" label="Date Format"   sub="MM/DD/YYYY"                 onPress={soon('Date Format')} />
          </Section>

          <Section title="SUPPORT">
            <Row icon="❓" label="Help Center"   onPress={soon('Help Center')} />
            <Row icon="💬" label="Send Feedback" onPress={soon('Send Feedback')} />
            <Row icon="⭐" label="Rate the App"  onPress={soon('Rate the App')} />
          </Section>

          <Section title="ACCOUNT">
            <Row icon="🔒" label="Change Password" onPress={soon('Change Password')} />
            <Row icon="🚪" label="Sign Out"         onPress={handleSignOut} danger />
          </Section>

          <Text style={styles.version}>Asset Brain  v0.1.0</Text>
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  hero: {
    alignItems:        'center',
    paddingBottom:     28,
    paddingHorizontal: 24,
    gap:               8,
  },
  avatar: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth:     2,
    borderColor:     'rgba(255,255,255,0.4)',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    4,
  },
  avatarText:   { color: Colors.white, fontSize: 22, fontWeight: '700' },
  profileName:  { color: Colors.white, fontSize: 18, fontWeight: '700' },
  profileEmail: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: -2 },
  wsBadge: {
    backgroundColor:   'rgba(255,255,255,0.15)',
    borderRadius:      12,
    paddingHorizontal: 12,
    paddingVertical:   5,
    marginTop:         4,
  },
  wsBadgeText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600' },
  editBtn: {
    backgroundColor:   'rgba(255,255,255,0.15)',
    borderRadius:      8,
    paddingHorizontal: 16,
    paddingVertical:   8,
    marginTop:         8,
  },
  editLabel: { color: Colors.white, fontSize: 12, fontWeight: '600' },
  content:   { backgroundColor: Colors.bg, paddingTop: 20 },
  section:   { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: {
    color:         Colors.textMuted,
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 0.8,
    marginBottom:  8,
  },
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.border,
    overflow:        'hidden',
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap:               12,
  },
  rowIcon:    { fontSize: 16, width: 22 },
  rowText:    { flex: 1 },
  rowLabel:   { color: Colors.text, fontSize: 14 },
  rowSub:     { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  rowChevron: { color: Colors.textMuted, fontSize: 18 },
  version:    { color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8 },
});
