import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Colors, Gradients } from '@/constants/colors';
import { hapticLight } from '@/lib/haptics';

type Message = {
  id:   string;
  role: 'user' | 'assistant';
  content: string;
};

const WELCOME: Message = {
  id:      'welcome',
  role:    'assistant',
  content: "Hi! I'm Asset Brain, your AI portfolio co-pilot. Ask me anything about your portfolio — rent collection, vacancies, expenses, or what to do next.",
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export default function ChatModal() {
  const insets = useSafeAreaInsets();
  const [messages,       setMessages]       = useState<Message[]>([WELCOME]);
  const [input,          setInput]          = useState('');
  const [thinking,       setThinking]       = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [workspaceId,    setWorkspaceId]    = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const wsId = user.user_metadata?.current_workspace_id ?? null;
      setWorkspaceId(wsId);
    })();
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || thinking) return;
    hapticLight();
    setInput('');

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setThinking(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const body: Record<string, unknown> = {
        message:     text,
        workspaceId: workspaceId ?? '',
      };
      if (conversationId) body.conversationId = conversationId;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/mobile-chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type':  'application/json',
          'apikey':        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }

      const aiMsg: Message = {
        id:      (Date.now() + 1).toString(),
        role:    'assistant',
        content: data.reply ?? 'No response.',
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e: any) {
      const isNotConfigured = e.message?.includes('not configured') || e.message?.includes('ANTHROPIC_API_KEY');
      setMessages(prev => [
        ...prev,
        {
          id:      (Date.now() + 1).toString(),
          role:    'assistant',
          content: isNotConfigured
            ? 'AI chat is not yet configured. Ask your admin to set the ANTHROPIC_API_KEY Supabase secret.'
            : `Sorry, I ran into an error: ${e.message}`,
        },
      ]);
    } finally {
      setThinking(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [input, thinking, conversationId, workspaceId]);

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([WELCOME]);
  };

  return (
    <View style={[styles.root, { backgroundColor: Colors.indigo }]}>
      {/* Header */}
      <LinearGradient
        colors={Gradients.primary}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerLeft}>
          <View style={styles.avatarDot}>
            <Text style={styles.avatarIcon}>✦</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Asset Brain</Text>
            <Text style={styles.headerSub}>Powered by Claude</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {conversationId && (
            <TouchableOpacity onPress={startNewConversation} hitSlop={12} style={styles.newChatBtn}>
              <Text style={styles.newChatLabel}>New</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.map(m => (
            <View
              key={m.id}
              style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAI]}
            >
              {m.role === 'assistant' && (
                <Text style={styles.aiLabel}>✦ Asset Brain</Text>
              )}
              <Text style={[styles.bubbleText, m.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAI]}>
                {m.content}
              </Text>
            </View>
          ))}
          {thinking && (
            <View style={[styles.bubble, styles.bubbleAI]}>
              <Text style={styles.aiLabel}>✦ Asset Brain</Text>
              <View style={styles.typingRow}>
                <ActivityIndicator size="small" color={Colors.blue} />
                <Text style={styles.typingText}>Thinking…</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Suggested prompts (shown when no conversation started) */}
        {messages.length === 1 && !thinking && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.suggestions}
            contentContainerStyle={styles.suggestionsContent}
          >
            {[
              'How is my portfolio doing?',
              'Any late rent this month?',
              'Which property has the best ROE?',
              'What needs my attention today?',
            ].map(prompt => (
              <TouchableOpacity
                key={prompt}
                style={styles.suggestionPill}
                onPress={() => { setInput(prompt); }}
                activeOpacity={0.8}
              >
                <Text style={styles.suggestionText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Input bar */}
        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask about your portfolio…"
              placeholderTextColor={Colors.textMuted}
              returnKeyType="send"
              onSubmitEditing={send}
              multiline
              selectionColor={Colors.blue}
              editable={!thinking}
            />
          </View>
          <TouchableOpacity
            onPress={send}
            style={[styles.sendBtn, (!input.trim() || thinking) && styles.sendBtnDisabled]}
            disabled={!input.trim() || thinking}
          >
            <Text style={styles.sendIcon}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingBottom:     14,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarDot: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarIcon:   { color: Colors.white, fontSize: 16 },
  headerTitle:  { color: Colors.white, fontSize: 15, fontWeight: '700' },
  headerSub:    { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 },
  newChatBtn: {
    backgroundColor:   'rgba(255,255,255,0.2)',
    borderRadius:      8,
    paddingHorizontal: 10,
    paddingVertical:   5,
  },
  newChatLabel: { color: Colors.white, fontSize: 11, fontWeight: '600' },
  closeBtn:     { color: 'rgba(255,255,255,0.8)', fontSize: 18 },

  messages:    { flex: 1, backgroundColor: Colors.bg },
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop:        16,
    paddingBottom:     12,
    gap:               12,
  },

  bubble: {
    maxWidth:     '80%',
    borderRadius: 16,
    padding:      12,
    gap:          4,
  },
  bubbleUser: {
    alignSelf:               'flex-end',
    backgroundColor:         Colors.blue,
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    alignSelf:              'flex-start',
    backgroundColor:        Colors.card,
    borderWidth:            1,
    borderColor:            Colors.border,
    borderBottomLeftRadius: 4,
    maxWidth:               '88%',
  },
  aiLabel:        { color: Colors.blue, fontSize: 10, fontWeight: '700', marginBottom: 2 },
  bubbleText:     { fontSize: 14, lineHeight: 21 },
  bubbleTextUser: { color: Colors.white },
  bubbleTextAI:   { color: Colors.text },
  typingRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText:     { color: Colors.textMuted, fontSize: 13 },

  suggestions:       { maxHeight: 44, flexShrink: 0 },
  suggestionsContent:{ paddingHorizontal: 16, paddingVertical: 6, gap: 8 },
  suggestionPill: {
    backgroundColor:   Colors.aiCard,
    borderRadius:      16,
    borderWidth:       1,
    borderColor:       Colors.aiBorder,
    paddingHorizontal: 12,
    paddingVertical:   6,
  },
  suggestionText: { color: Colors.indigo, fontSize: 12 },

  inputRow: {
    flexDirection:     'row',
    alignItems:        'flex-end',
    paddingHorizontal: 16,
    paddingTop:        12,
    gap:               10,
    borderTopWidth:    1,
    borderTopColor:    Colors.border,
    backgroundColor:   Colors.card,
  },
  inputWrap: {
    flex:              1,
    backgroundColor:   Colors.bg,
    borderRadius:      20,
    borderWidth:       1,
    borderColor:       Colors.border,
    paddingHorizontal: 14,
    paddingVertical:   10,
    maxHeight:         120,
  },
  input:           { color: Colors.text, fontSize: 14, maxHeight: 100 },
  sendBtn: {
    width:           42,
    height:          42,
    borderRadius:    21,
    backgroundColor: Colors.blue,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.border },
  sendIcon:        { color: Colors.white, fontSize: 18, fontWeight: '700' },
});
