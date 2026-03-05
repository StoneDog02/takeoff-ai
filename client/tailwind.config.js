/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sora: ['Sora', 'sans-serif'],
        'dm-sans': ['DM Sans', 'sans-serif'],
      },
      colors: {
        primary: 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        accent: 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        'accent-glow': 'var(--color-accent-glow)',
        secondary: 'var(--color-secondary)',
        surface: 'var(--color-surface)',
        'surface-elevated': 'var(--color-surface-elevated)',
        border: 'var(--color-border)',
        muted: 'var(--color-muted)',
        dark: 'var(--color-dark)',
        'dark-2': 'var(--color-dark-2)',
        'dark-3': 'var(--color-dark-3)',
        'dark-4': 'var(--color-dark-4)',
        'landing-white': 'var(--color-white)',
        'white-dim': 'var(--color-white-dim)',
        'white-faint': 'var(--color-white-faint)',
        'border-dark': 'var(--color-border-dark)',
        'light-bg': 'var(--color-light-bg)',
        'light-bg-2': 'var(--color-light-bg-2)',
        'text-dark': 'var(--color-text-dark)',
        'text-mid': 'var(--color-text-mid)',
        'text-light': 'var(--color-text-light)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      spacing: {
        'page': 'var(--space-page)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-landing': '0 20px 60px rgba(0,0,0,0.1)',
        'red-glow': '0 0 30px rgba(192,57,43,0.35), 0 4px 20px rgba(0,0,0,0.4)',
        'red-glow-lg': '0 0 50px rgba(192,57,43,0.4), 0 8px 30px rgba(0,0,0,0.5)',
        'card-dark': '0 20px 60px rgba(0,0,0,0.3)',
        'pricing-pop': '0 30px 80px rgba(0,0,0,0.25), 0 0 60px rgba(192,57,43,0.1)',
        mockup: '0 40px 80px rgba(0,0,0,0.6), 0 0 100px rgba(192,57,43,0.08)',
      },
      keyframes: {
        fadeDown: {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-down': 'fadeDown 0.8s ease both',
        'fade-up': 'fadeUp 0.8s ease both',
        'fade-up-1': 'fadeUp 0.8s 0.1s ease both',
        'fade-up-2': 'fadeUp 0.8s 0.2s ease both',
        'fade-up-3': 'fadeUp 0.8s 0.3s ease both',
      },
    },
  },
  plugins: [],
}
