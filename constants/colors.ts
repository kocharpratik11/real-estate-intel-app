// Dark theme design tokens — single source of truth for all screens.
export const Colors = {
  // Surfaces
  bg:       '#0F172A',   // page background
  card:     '#1E293B',   // card / surface fill
  border:   'rgba(148, 163, 184, 0.16)',

  // Brand — blue as primary
  blue:     '#3B82F6',
  indigo:   '#3B82F6',   // alias kept for existing call sites
  purple:   '#8B5CF6',   // accent, AI gradient endpoint

  // Text
  text:     '#F1F5F9',
  textSub:  '#CBD5E1',
  textMuted:'#94A3B8',

  // Status — green (paid / healthy)
  green:    '#10B981',
  greenBg:  'rgba(16, 185, 129, 0.1)',
  greenBd:  'rgba(16, 185, 129, 0.35)',

  // Status — amber (warning / partial)
  yellow:   '#F59E0B',
  yellowBg: 'rgba(245, 158, 11, 0.1)',
  yellowBd: 'rgba(245, 158, 11, 0.35)',

  // Status — red (emergency / overdue)
  red:      '#EF4444',
  redBg:    'rgba(239, 68, 68, 0.1)',
  redBd:    'rgba(239, 68, 68, 0.35)',

  white:    '#FFFFFF',
  black:    '#000000',

  // AI / intelligence surfaces
  aiCard:   'rgba(30, 41, 59, 0.6)',    // glass card fill
  aiBorder: 'rgba(59, 130, 246, 0.3)',  // glass card border (accent-tinted)
  aiDark:   '#334155',                  // slightly lighter — summary strips, section fills
} as const;

export type Color = keyof typeof Colors;

export const Gradients = {
  primary: ['#3B82F6', '#8B5CF6'] as const,
  success: ['#10B981', '#059669'] as const,
  error:   ['#EF4444', '#DC2626'] as const,
};
