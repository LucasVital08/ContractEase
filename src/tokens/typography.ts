/**
 * Typography Tokens for ContractEase
 * Font families, sizes, weights, and line heights
 */

export const typography = {
  // Font families
  fontFamily: {
    sans: '"Inter", sans-serif',
    display: '"Bricolage Grotesque", sans-serif',
    mono: '"Fira Code", monospace',
  },

  // Font sizes (following Tailwind scale)
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }], // 12px
    sm: ['0.875rem', { lineHeight: '1.25rem' }], // 14px
    base: ['1rem', { lineHeight: '1.5rem' }], // 16px
    lg: ['1.125rem', { lineHeight: '1.75rem' }], // 18px
    xl: ['1.25rem', { lineHeight: '1.75rem' }], // 20px
    '2xl': ['1.5rem', { lineHeight: '2rem' }], // 24px
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }], // 36px
    '5xl': ['3rem', { lineHeight: '1' }], // 48px
    '6xl': ['3.75rem', { lineHeight: '1' }], // 60px
    '7xl': ['4.5rem', { lineHeight: '1' }], // 72px
    '8xl': ['6rem', { lineHeight: '1' }], // 96px
  },

  // Font weights
  fontWeight: {
    thin: 100,
    extralight: 200,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },

  // Line heights
  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  // Letter spacing
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },

  // Text transform utilities
  textTransform: {
    uppercase: 'uppercase',
    lowercase: 'lowercase',
    capitalize: 'capitalize',
    normal: 'none',
  },

  // Predefined text styles (semantic usage)
  styles: {
    // Display styles (for headings)
    h1: {
      fontSize: '3.75rem', // 60px
      fontWeight: 700,
      fontFamily: '"Bricolage Grotesque", sans-serif',
      lineHeight: '1',
    },
    h2: {
      fontSize: '3rem', // 48px
      fontWeight: 700,
      fontFamily: '"Bricolage Grotesque", sans-serif',
      lineHeight: '1',
    },
    h3: {
      fontSize: '1.875rem', // 30px
      fontWeight: 700,
      fontFamily: '"Bricolage Grotesque", sans-serif',
      lineHeight: '2.25rem',
    },
    h4: {
      fontSize: '1.5rem', // 24px
      fontWeight: 700,
      fontFamily: '"Bricolage Grotesque", sans-serif',
      lineHeight: '2rem',
    },

    // Body text styles
    body: {
      fontSize: '1rem', // 16px
      fontWeight: 400,
      fontFamily: '"Inter", sans-serif',
      lineHeight: '1.5rem',
    },
    bodySmall: {
      fontSize: '0.875rem', // 14px
      fontWeight: 400,
      fontFamily: '"Inter", sans-serif',
      lineHeight: '1.25rem',
    },
    bodyXSmall: {
      fontSize: '0.75rem', // 12px
      fontWeight: 400,
      fontFamily: '"Inter", sans-serif',
      lineHeight: '1rem',
    },

    // Label / Caption styles
    label: {
      fontSize: '0.875rem', // 14px
      fontWeight: 500,
      fontFamily: '"Inter", sans-serif',
      lineHeight: '1.25rem',
      textTransform: 'none',
    },
    caption: {
      fontSize: '0.75rem', // 12px
      fontWeight: 500,
      fontFamily: '"Inter", sans-serif',
      lineHeight: '1rem',
    },

    // Code / Monospace styles
    code: {
      fontSize: '0.875rem', // 14px
      fontWeight: 400,
      fontFamily: '"Fira Code", monospace',
      lineHeight: '1.25rem',
    },
    codeSmall: {
      fontSize: '0.75rem', // 12px
      fontWeight: 400,
      fontFamily: '"Fira Code", monospace',
      lineHeight: '1rem',
    },

    // Number / Stat styles
    stat: {
      fontSize: '1.875rem', // 30px
      fontWeight: 700,
      fontFamily: '"Bricolage Grotesque", sans-serif',
      lineHeight: '2.25rem',
    },
  },
} as const;

export type Typography = typeof typography;
