/** @type {import('tailwindcss').Config} */

/**
 * Design tokens are now centralized in src/tokens/
 * This Tailwind config integrates with the token system
 * but uses standard Tailwind values for compatibility
 */

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Font families (from typography tokens)
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        bricolage: ['Bricolage Grotesque', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },

      // Colors (from colors tokens)
      colors: {
        neutral: {
          950: '#0a0a0a',
          900: '#171717',
          800: '#2a2a2a',
          700: '#3f3f3f',
          600: '#525252',
          500: '#737373',
          400: '#a3a3a3',
          300: '#d4d4d4',
          200: '#e5e5e5',
          100: '#f5f5f5',
        },
      },

      // Box shadows (from shadows tokens)
      boxShadow: {
        premium: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        subtle: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        medium: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        elevated: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      },

      // Opacity values
      opacity: {
        5: '0.05',
        10: '0.1',
        15: '0.15',
        20: '0.2',
        50: '0.5',
      },
    },
  },

  plugins: [
    // Plugin to add custom utilities
    function ({ addUtilities }) {
      addUtilities({
        '.glass-panel': {
          backgroundColor: 'rgba(23, 23, 23, 0.7)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        },
        '.premium-shadow': {
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        },
        '.bg-grain': {
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          opacity: '0.05',
          pointerEvents: 'none',
          position: 'fixed',
          top: '0',
          left: '0',
          width: '100vw',
          height: '100vh',
          zIndex: '0',
        },
        '.focus-ring': {
          boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.3)',
        },
      });
    },
  ],
}
