// Light theme design tokens
export const Colors = {
  // Surfaces
  bg:       '#F7F8FC',
  card:     '#FFFFFF',
  card2:    '#EEF2FF',
  border:   '#E5E8F2',

  // Brand / actions
  blue:     '#4F73FF',
  purple:   '#7C3AED',
  indigo:   '#6366F1',

  // Text
  text:     '#111827',
  textSub:  '#374151',
  textMuted:'#9CA3AF',

  // Status — green
  green:    '#059669',
  greenBg:  '#ECFDF5',
  greenBd:  '#A7F3D0',

  // Status — yellow/amber
  yellow:   '#D97706',
  yellowBg: '#FFFBEB',
  yellowBd: '#FDE68A',

  // Status — red
  red:      '#DC2626',
  redBg:    '#FEF2F2',
  redBd:    '#FECACA',

  white:    '#FFFFFF',
  black:    '#000000',

  // AI / highlight surfaces
  aiCard:   '#EEF2FF',
  aiBorder: '#C7D2FE',
  aiDark:   '#F0F4FF',
} as const;

export type Color = keyof typeof Colors;
