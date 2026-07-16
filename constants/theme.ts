// Dark theme design tokens — used by newly-built screens (dashboard, equity, documents, more, locked).
// Existing light-theme screens continue to use constants/colors.ts (see CLAUDE.md).
export const Colors = {
  // Backgrounds
  bgPrimary: '#0F172A',
  bgSecondary: '#1E293B',
  bgTertiary: '#334155',

  // Glass
  glassBg: 'rgba(30, 41, 59, 0.6)',
  glassBorder: 'rgba(148, 163, 184, 0.1)',
  glassBorderHover: 'rgba(59, 130, 246, 0.3)',

  // Text
  textPrimary: '#F1F5F9',
  textSecondary: '#CBD5E1',
  textTertiary: '#94A3B8',
  textQuaternary: '#64748B',

  // Brand
  blue: '#3B82F6',
  blueDark: '#2563EB',
  purple: '#8B5CF6',
  pink: '#EC4899',

  // Status
  success: '#10B981',
  successBg: 'rgba(16, 185, 129, 0.1)',
  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.1)',
  error: '#EF4444',
  errorBg: 'rgba(239, 68, 68, 0.1)',
  info: '#3B82F6',
  infoBg: 'rgba(59, 130, 246, 0.1)',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const Radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 9999,
} as const;

export const FontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 40,
} as const;

export const FontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  black: '800' as const,
};

// Gradient colors for LinearGradient
export const Gradients = {
  primary: ['#3B82F6', '#8B5CF6'] as const,
  text: ['#60A5FA', '#A78BFA', '#EC4899'] as const,
  background: ['#0F172A', '#1E293B'] as const,
  success: ['#10B981', '#059669'] as const,
  error: ['#EF4444', '#DC2626'] as const,
};
