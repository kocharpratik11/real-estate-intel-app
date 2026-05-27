// Design tokens — matches Figma screens exactly
export const Colors = {
  bg:       '#0F172A',
  card:     '#1E293B',
  card2:    '#0F1E35',
  border:   '#334155',

  blue:     '#3B82F6',
  purple:   '#8B5CF6',
  indigo:   '#6366F1',

  text:     '#F1F5F9',
  textSub:  '#CBD5E1',
  textMuted:'#94A3B8',

  green:    '#10B981',
  greenBg:  '#052E16',
  greenBd:  '#166534',

  yellow:   '#F59E0B',
  yellowBg: '#1C1400',
  yellowBd: '#854D0E',

  red:      '#EF4444',
  redBg:    '#1C0505',
  redBd:    '#991B1B',

  white:    '#FFFFFF',
  black:    '#000000',

  aiCard:   '#0D1F3C',
  aiBorder: '#2563EB',
  aiDark:   '#0A1628',
} as const;

export type Color = keyof typeof Colors;
