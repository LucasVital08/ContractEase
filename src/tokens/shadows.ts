/**
 * Shadow and Effects Tokens for ContractEase
 * Box shadows, backdrop filters, and visual effects
 */

export const shadows = {
  // Box shadows (Tailwind scale)
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',

  // Premium/Custom shadows
  premium: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',

  // Subtle shadows (for cards, modals)
  subtle: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  medium: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',

  // Focus shadows (for interactive elements)
  focus: '0 0 0 3px rgba(16, 185, 129, 0.1)',
  focusRing: '0 0 0 3px rgba(16, 185, 129, 0.3)',

  // Elevated shadows (for floating elements)
  elevated: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',

  // Inset shadows (for depth effect)
  insetSm: 'inset 0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  insetBase: 'inset 0 1px 3px 0 rgba(0, 0, 0, 0.1)',

  // Multiple shadows (stacked effect)
  stack: `0 1px 3px 0 rgba(0, 0, 0, 0.1),
           0 4px 6px -2px rgba(0, 0, 0, 0.05)`,
} as const;

export const effects = {
  // Backdrop filters
  blurSm: 'blur(4px)',
  blur: 'blur(12px)',
  blurMd: 'blur(16px)',
  blurLg: 'blur(20px)',

  // Opacity values
  opacityFull: '1',
  opacityHigh: '0.95',
  opacityMedium: '0.7',
  opacityLow: '0.5',
  opacityVeryLow: '0.3',
  opacityHover: '0.08',
  opacityFocus: '0.1',

  // Transitions
  transitionFast: 'all 0.15s ease-in-out',
  transitionBase: 'all 0.3s ease-in-out',
  transitionSlow: 'all 0.5s ease-in-out',

  // Ease functions
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
  easeLinear: 'linear',

  // Glass effect (modal/overlay style)
  glass: {
    background: 'rgba(23, 23, 23, 0.7)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },

  // Grain texture (decorative)
  grain: `
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    opacity: 0.05;
  `,
} as const;

export type Shadows = typeof shadows;
export type Effects = typeof effects;
