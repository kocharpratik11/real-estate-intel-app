import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator, KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getPortfolioSummary } from '@/lib/api/properties';
import { generateAlerts } from '@/lib/api/alerts';
import { Colors } from '@/constants/colors';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const NOW   = new Date();
const YEAR  = NOW.getFullYear();
const MONTH = NOW.getMonth() + 1;

const ANTHROPIC_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

async function askClaude(
  messages: { role: string; content: string }[],
  systemPrompt: string,
): Promise<string> {
  if (!ANTHROPIC_KEY) {
    return "AI chat is not configured. Add EXPO_PUBLIC_ANTHROPIC_API_KEY to your .env file to enable this feature.";
  }
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system:     systemPrompt,
      messages,
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return data.content[0]?.text ?? 'No response';
}

const WELCOME: Message = {
  id:      'welcome',
  role:    'assistant',
  content: "Hi! I'm your REI assistant. Ask me anything about your portfolio — rent collection, vacancies, expenses, or what to do next.",
};

export default function ChatModal() {
  const [messages,  setMessages]  = useState<Message[]>([WELCOME]);
  const [input,     setInput]     = useState('');
  const [thinking,  setThinking]  = useState(false);
  const [systemCtx, setSystemCtx] = useState('You are a helpful real estate portfolio assistant.');
  const scrollRef = useRef<ScrollView>(null);

  // Build a system prompt with live portfolio context
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const wsId = user.user_metadata?.current_workspace_id;
      if (!wsId) return;

      const [summary, alerts] = await Promise.all([
        getPortfolioSummary(wsId, YEAR, MONTH).catch(() => null),
        generateAlerts(wsId, YEAR, MONTH).catch(() => []),
      ]);

      const lines: string[] = [
        'You are an AI assistant embedded in a real estate portfolio management app called REI.',
        'Answer questions concisely and actionably. Format numbers with commas.',
        '',
        '## Current Portfolio Snapshot',
      ];

      if (summary) {
        lines.push(`- Properties: ${summary.total_properties}`);
        lines.push(`- Collection rate: ${Math.round(summary.collection_rate * 100)}%`);
        lines.push(`- Monthly collected: $${summary.monthly_collected.toLocaleString()}`);
        lines.push(`- Monthly expected:  $${summary.monthly_expected.toLocaleString()}`);
        lines.push(`- Net income:        $${summary.net_income.toLocaleString()}`);
        lines.push(`- Vacancies:         ${summary.vacancies}`);
        lines.push(`- Health score:      ${summary.health_score}/100`);
      }

      if (alerts.length > 0) {
        lines.push('', '## Active Alerts');
        alerts.forEach(a => lines.push(`- [${a.severity.toUpperCase()}] ${a.title}: ${a.body}`));
      }

      lines.push('', `Today is ${NOW.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`);
      setSystemCtx(lines.join('\n'));
    })();
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setThinking(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const history = [...messages.filter(m => m.id !== 'welcome'), userMsg].map(m => ({
        role:    m.role,
        content: m.content,
      }));
      const reply = await askClaude(history, systemCtx);
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: reply };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      const errMsg: Message = {
        id:      (Date.now() + 1).toString(),
        role:    'assistant',
        content: 'Sorry, I ran into an error. Please try again.',
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setThinking(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [input, thinking, messages, systemCtx]);

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarDot} />
          <View>
            <Text style={styles.headerTitle}>REI Assistant</Text>
            <Text style={styles.headerSub}>Powered by Claude</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

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
                <Text style={styles.aiLabel}>✦ REI</Text>
              )}
              <Text style={[styles.bubbleText, m.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAI]}>
                {m.content}
              </Text>
            </View>
          ))}
          {thinking && (
            <View style={[styles.bubble, styles.bubbleAI]}>
              <Text style={styles.aiLabel}>✦ REI</Text>
              <View style={styles.typingRow}>
                <ActivityIndicator size="small" color={Colors.blue} />
                <Text style={styles.typingText}>Thinking…</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputRow}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.bg },
  flex:  { flex: 1 },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor:   Colors.card,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarDot:  {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: Colors.blue,
    alignItems:      'center',
    justifyContent:  'center',
  },
  headerTitle: { color: Colors.text,     fontSize: 15, fontWeight: '700' },
  headerSub:   { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  closeBtn:    { color: Colors.textMuted, fontSize: 18 },
  messages:    { flex: 1 },
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
    alignSelf:       'flex-end',
    backgroundColor: Colors.blue,
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    alignSelf:       'flex-start',
    backgroundColor: Colors.card,
    borderWidth:     1,
    borderColor:     Colors.border,
    borderBottomLeftRadius: 4,
  },
  aiLabel:        { color: Colors.blue, fontSize: 10, fontWeight: '700', marginBottom: 2 },
  bubbleText:     { fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: Colors.white },
  bubbleTextAI:   { color: Colors.text },
  typingRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText:     { color: Colors.textMuted, fontSize: 13 },
  inputRow: {
    flexDirection:     'row',
    alignItems:        'flex-end',
    paddingHorizontal: 16,
    paddingVertical:   12,
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
  input:   { color: Colors.text, fontSize: 14, maxHeight: 100 },
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
