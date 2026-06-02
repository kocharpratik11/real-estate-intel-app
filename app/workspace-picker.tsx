import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useWorkspaces } from '@/hooks/useWorkspace';
import { Colors } from '@/constants/colors';

const INITIALS = (name: string) =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

const ACCENT_PAIRS: [string, string][] = [
  [Colors.blue,   Colors.purple],
  [Colors.purple, Colors.indigo],
  [Colors.green,  Colors.blue],
  [Colors.indigo, Colors.blue],
];

export default function WorkspacePickerScreen() {
  const { workspaces, loading } = useWorkspaces();
  const [selecting, setSelecting] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const selectWorkspace = async (wsId: string, wsName: string) => {
    setSelecting(wsId);
    await supabase.auth.updateUser({
      data: { current_workspace_id: wsId, current_workspace_name: wsName },
    });
    setSelecting(null);
    router.replace('/(app)');
  };

  return (
    <View style={[styles.root, { backgroundColor: Colors.indigo }]}>
      {/* Gradient hero */}
      <LinearGradient
        colors={['#6366F1', '#7C3AED']}
        style={[styles.hero, { paddingTop: insets.top + 24 }]}
      >
        <View style={styles.logoMark}>
          <Text style={styles.logoMarkText}>✦</Text>
        </View>
        <Text style={styles.appName}>ASSET BRAIN</Text>
        <Text style={styles.heading}>Choose a workspace</Text>
        <Text style={styles.sub}>Select the portfolio you want to manage</Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator color={Colors.white} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
        >
          {workspaces.map((ws, i) => {
            const [c1] = ACCENT_PAIRS[i % ACCENT_PAIRS.length];
            const isSelecting = selecting === ws.id;
            return (
              <TouchableOpacity
                key={ws.id}
                onPress={() => selectWorkspace(ws.id, ws.name)}
                disabled={!!selecting}
                activeOpacity={0.8}
              >
                <View style={styles.card}>
                  <View style={[styles.avatar, { backgroundColor: c1 }]}>
                    <Text style={styles.avatarText}>{INITIALS(ws.name)}</Text>
                  </View>
                  <View style={styles.info}>
                    <View style={styles.nameRow}>
                      <Text style={styles.wsName}>{ws.name}</Text>
                      <View style={[
                        styles.roleBadge,
                        { borderColor: ws.role === 'owner' ? Colors.aiBorder : Colors.greenBd }
                      ]}>
                        <Text style={[
                          styles.roleText,
                          { color: ws.role === 'owner' ? Colors.blue : Colors.green }
                        ]}>
                          {ws.role.charAt(0).toUpperCase() + ws.role.slice(1)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.wsSub}>{ws.role === 'owner' ? 'Owner' : 'Manager'}</Text>
                  </View>
                  {isSelecting
                    ? <ActivityIndicator size="small" color={Colors.blue} />
                    : <Text style={styles.chevron}>›</Text>
                  }
                </View>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={styles.createBtn}
            activeOpacity={0.8}
            onPress={() => router.push('/onboarding')}
          >
            <Text style={styles.createLabel}>+   Create new workspace</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.switchBtn} onPress={async () => {
            await supabase.auth.signOut();
            router.replace('/(auth)/login');
          }}>
            <Text style={styles.switchLabel}>Sign in to another account</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  hero: {
    alignItems:        'center',
    paddingBottom:     28,
    paddingHorizontal: 24,
    gap:               6,
  },
  logoMark: {
    width:           44,
    height:          44,
    borderRadius:    14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    8,
  },
  logoMarkText: { color: Colors.white, fontSize: 20 },
  appName: {
    color:         'rgba(255,255,255,0.65)',
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.5,
    marginTop:     -2,
  },
  heading: { color: Colors.white, fontSize: 20, fontWeight: '700', marginTop: 4 },
  sub:     { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' },
  list:    { paddingHorizontal: 16, paddingTop: 20, gap: 12 },
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.aiDark,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     Colors.aiBorder,
    padding:         16,
    gap:             14,
  },
  avatar: {
    width:           52,
    height:          52,
    borderRadius:    26,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  info:       { flex: 1 },
  nameRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  wsName:     { color: Colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  roleBadge: {
    borderRadius:      4,
    borderWidth:       1,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  roleText:    { fontSize: 9, fontWeight: '700' },
  wsSub:       { color: Colors.textMuted, fontSize: 11 },
  chevron:     { color: Colors.textMuted, fontSize: 20 },
  createBtn: {
    backgroundColor: Colors.bg,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         16,
    alignItems:      'center',
    marginTop:       4,
  },
  createLabel: { color: Colors.textMuted, fontSize: 14 },
  switchBtn:   { alignItems: 'center', paddingVertical: 12 },
  switchLabel: { color: Colors.blue, fontSize: 13 },
});
