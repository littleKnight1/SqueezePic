/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        // 暗色主题核心色
        ink: {
          900: '#0a0a0a',
          800: '#111111',
          700: '#171717',
          600: '#1f1f1f',
          500: '#2a2a2a',
          400: '#3a3a3a',
        },
        accent: {
          DEFAULT: '#22d3ee', // cyan-400
          glow: '#67e8f9',    // cyan-300
        },
      },
      backgroundImage: {
        'gradient-accent':
          'linear-gradient(135deg, #22d3ee 0%, #06b6d4 50%, #0891b2 100%)',
        'gradient-mask':
          'radial-gradient(circle at 50% 0%, rgba(34,211,238,0.15), transparent 60%)',
      },
      boxShadow: {
        glow: '0 0 20px rgba(34, 211, 238, 0.35)',
        'glow-sm': '0 0 10px rgba(34, 211, 238, 0.25)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        shimmer: 'shimmer 2.5s linear infinite',
      },
    },
  },
  plugins: [],
};
