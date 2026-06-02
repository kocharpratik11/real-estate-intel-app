// Light theme design tokens — "intelligence-forward" indigo palette
export const Colors = {
  // Surfaces
  bg:       '#FAFAF9',   // warm near-white (was #F7F8FC)
  card:     '#FFFFFF',
  border:   '#E8E8F0',   // warm-shifted (was #E5E8F2)

  // Brand — indigo as primary (all existing Colors.blue refs get indigo automatically)
  blue:     '#6366F1',   // kept as 'blue' for backward compat; value is now indigo
  indigo:   '#6366F1',   // explicit alias — prefer this in new code
  purple:   '#7C3AED',   // accent, AI gradient endpoint

  // Text
  text:     '#111827',
  textSub:  '#374151',
  textMuted:'#9CA3AF',

  // Status — green (paid / healthy)
  green:    '#059669',
  greenBg:  '#ECFDF5',
  greenBd:  '#A7F3D0',

  // Status — amber (warning / partial)
  yellow:   '#D97706',
  yellowBg: '#FFFBEB',
  yellowBd: '#FDE68A',

  // Status — red (emergency / overdue)
  red:      '#DC2626',
  redBg:    '#FEF2F2',
  redBd:    '#FECACA',

  white:    '#FFFFFF',
  black:    '#000000',

  // AI / intelligence surfaces
  aiCard:   '#EEF2FF',   // indigoBg — AI card fill
  aiBorder: '#C7D2FE',   // indigoBd — AI card border
  aiDark:   '#F0F4FF',   // slightly lighter — summary strips, section fills
} as const;

export type Color = keyof typeof Colors;
