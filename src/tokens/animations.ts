/**
 * Animation & Motion Tokens for ContractEase
 * Using Motion (formerly Framer Motion) library for consistency
 */

export const animations = {
  // Duration values (in seconds)
  durations: {
    instant: 0.05,
    fast: 0.15,
    base: 0.3,
    slow: 0.5,
    slower: 0.7,
  },

  // Easing functions
  easing: {
    easeIn: [0.4, 0, 1, 1],
    easeOut: [0, 0, 0.2, 1],
    easeInOut: [0.4, 0, 0.2, 1],
    easeLinear: [0, 0, 1, 1],
    easeInCubic: [0.32, 0, 0.67, 0],
    easeOutCubic: [0.33, 1, 0.68, 1],
    easeInQuad: [0.11, 0, 0.5, 0],
    easeOutQuad: [0.5, 1, 0.89, 1],
  },

  // Predefined Motion variants (for Framer Motion)
  variants: {
    // Entrance animations
    fadeIn: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.3 },
    },

    slideInFromTop: {
      initial: { opacity: 0, y: -20 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -20 },
      transition: { duration: 0.3 },
    },

    slideInFromBottom: {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 20 },
      transition: { duration: 0.3 },
    },

    slideInFromLeft: {
      initial: { opacity: 0, x: -20 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -20 },
      transition: { duration: 0.3 },
    },

    slideInFromRight: {
      initial: { opacity: 0, x: 20 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: 20 },
      transition: { duration: 0.3 },
    },

    scaleIn: {
      initial: { opacity: 0, scale: 0.95 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.95 },
      transition: { duration: 0.3 },
    },

    zoomIn: {
      initial: { opacity: 0, scale: 0.85 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.85 },
      transition: { duration: 0.4 },
    },

    // List item animations (staggered)
    listItem: {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 20 },
    },

    listContainer: {
      animate: {
        transition: {
          staggerChildren: 0.1,
        },
      },
    },

    // Modal animations
    modalOverlay: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.2 },
    },

    modalContent: {
      initial: { opacity: 0, scale: 0.95, y: 20 },
      animate: { opacity: 1, scale: 1, y: 0 },
      exit: { opacity: 0, scale: 0.95, y: 20 },
      transition: { duration: 0.3 },
    },

    // Hover animations
    hoverLift: {
      whileHover: { y: -4 },
      transition: { duration: 0.2 },
    },

    hoverScale: {
      whileHover: { scale: 1.05 },
      transition: { duration: 0.2 },
    },

    hoverGrow: {
      whileHover: { scale: 1.02 },
      transition: { duration: 0.2 },
    },

    // Tab animations
    tabContent: {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -10 },
      transition: { duration: 0.2 },
    },
  },

  // Transition presets
  transitions: {
    fast: {
      duration: 0.15,
      ease: 'easeOut',
    },
    base: {
      duration: 0.3,
      ease: 'easeOut',
    },
    slow: {
      duration: 0.5,
      ease: 'easeOut',
    },
    smooth: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1], // easeInOut
    },
  },
} as const;

export type Animations = typeof animations;

// Export helper for common motion transitions
export const createMotionTransition = (duration: 'fast' | 'base' | 'slow' = 'base') => {
  const durationMs = {
    fast: 0.15,
    base: 0.3,
    slow: 0.5,
  };

  return {
    duration: durationMs[duration],
    ease: 'easeOut',
  };
};
