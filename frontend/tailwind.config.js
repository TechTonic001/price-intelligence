/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  'hsl(230, 100%, 97%)',
          100: 'hsl(230, 95%, 93%)',
          200: 'hsl(230, 90%, 85%)',
          300: 'hsl(230, 85%, 72%)',
          400: 'hsl(230, 80%, 60%)',
          500: 'hsl(230, 75%, 50%)',
          600: 'hsl(230, 78%, 42%)',
          700: 'hsl(230, 80%, 34%)',
          800: 'hsl(230, 82%, 24%)',
          900: 'hsl(230, 84%, 16%)',
        },
        surface: {
          DEFAULT: 'hsl(220, 20%, 10%)',
          raised: 'hsl(220, 18%, 14%)',
          overlay: 'hsl(220, 16%, 18%)',
          border: 'hsl(220, 15%, 22%)',
        },
        accent: {
          green:  'hsl(142, 71%, 45%)',
          red:    'hsl(0, 72%, 51%)',
          yellow: 'hsl(45, 93%, 47%)',
          purple: 'hsl(270, 70%, 60%)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, hsl(230,75%,50%), hsl(270,70%,60%))',
        'gradient-dark':  'linear-gradient(180deg, hsl(220,20%,10%), hsl(220,22%,7%))',
      },
      boxShadow: {
        'glow-brand': '0 0 20px hsl(230,75%,50% / 0.35)',
        'glow-green': '0 0 20px hsl(142,71%,45% / 0.35)',
      },
      animation: {
        'fade-in':  'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};

