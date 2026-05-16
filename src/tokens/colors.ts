/**
 * Color Tokens for ContractEase
 * Centralized color definitions for consistent theming
 */

export const colors = {
  // Neutral palette
  neutral: {
    950: '#0a0a0a', // Main background
    900: '#171717', // Panels, secondary background
    800: '#2a2a2a',
    700: '#3f3f3f',
    600: '#525252',
    500: '#737373',
    400: '#a3a3a3', // Secondary text
    300: '#d4d4d4',
    200: '#e5e5e5',
    100: '#f5f5f5',
  },

  // Semantic colors - Success/Active
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#145231',
    // Primary semantic (emerald)
    primary: '#10b981',
    primaryLight: '#d1fae5',
    primaryDark: '#047857',
  },

  // Semantic colors - Warning/Pending
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    // Secondary semantic (amber)
    secondary: '#f59e0b',
    secondaryLight: '#fef3c7',
    secondaryDark: '#d97706',
  },

  // Semantic colors - Error/Danger
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    // Tertiary semantic (red)
    tertiary: '#ef4444',
    tertiaryLight: '#fee2e2',
    tertiaryDark: '#dc2626',
  },

  // Semantic colors - Info
  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    // Info semantic (blue)
    primary: '#3b82f6',
    primaryLight: '#dbeafe',
    primaryDark: '#1d4ed8',
  },

  // White and black
  white: '#ffffff',
  black: '#000000',

  // Transparent variants (glass effect)
  glass: {
    bg: 'rgba(23, 23, 23, 0.7)', // Neutral-900 with alpha
    border: 'rgba(255, 255, 255, 0.05)',
  },

  // Text colors
  text: {
    primary: '#ffffff',
    secondary: '#a3a3a3', // neutral-400
    tertiary: '#737373', // neutral-500
    disabled: '#525252', // neutral-600
    inverse: '#0a0a0a', // neutral-950
  },

  // Background colors
  background: {
    primary: '#0a0a0a', // neutral-950
    secondary: '#171717', // neutral-900
    tertiary: '#2a2a2a', // neutral-800
    input: 'rgba(0, 0, 0, 0.5)', // black/50
    hover: 'rgba(255, 255, 255, 0.05)',
    focus: 'rgba(255, 255, 255, 0.1)',
  },

  // Border colors
  border: {
    light: 'rgba(255, 255, 255, 0.05)', // white/5
    default: 'rgba(255, 255, 255, 0.1)', // white/10
    strong: 'rgba(255, 255, 255, 0.15)', // white/15
    focus: '#10b981', // emerald-500 on focus
  },

  // Opacity variants (for Tailwind class generation)
  opacity: {
    5: 'rgba(255, 255, 255, 0.05)',
    10: 'rgba(255, 255, 255, 0.1)',
    15: 'rgba(255, 255, 255, 0.15)',
    20: 'rgba(255, 255, 255, 0.2)',
    50: 'rgba(0, 0, 0, 0.5)',
  },

  // Status badges
  status: {
    active: {
      bg: 'rgba(16, 185, 129, 0.1)', // emerald/10
      border: 'rgba(16, 185, 129, 0.3)', // emerald/30
      text: '#10b981', // emerald
    },
    pending: {
      bg: 'rgba(245, 158, 11, 0.1)', // amber/10
      border: 'rgba(245, 158, 11, 0.3)', // amber/30
      text: '#f59e0b', // amber
    },
    failed: {
      bg: 'rgba(239, 68, 68, 0.1)', // red/10
      border: 'rgba(239, 68, 68, 0.3)', // red/30
      text: '#ef4444', // red
    },
    completed: {
      bg: 'rgba(34, 197, 94, 0.1)', // green/10
      border: 'rgba(34, 197, 94, 0.3)', // green/30
      text: '#22c55e', // green
    },
  },
} as const;

export type Colors = typeof colors;
