import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Brand blue (primary action) ──────────────────────────────
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // ── Navy (structure, dark surfaces, hero) ────────────────────
        navy: {
          50:  '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d6fe',
          300: '#a5b8fd',
          400: '#8092f9',
          500: '#2A4178',
          600: '#1E325F',
          700: '#17264A',
          800: '#101B36',
          900: '#0A1228',
          950: '#060B1A',
        },
        // ── Cyan (live data, GPS pulses) ─────────────────────────────
        cyan: {
          50:  '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
        // ── Teal (verified, growth, success-adjacent) ────────────────
        teal: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        // ── Special context accents ──────────────────────────────────
        auditor:     { DEFAULT: '#8b5cf6', 50: '#f5f3ff', 100: '#ede9fe' },
        delegate:    { DEFAULT: '#a855f7', 50: '#faf5ff', 100: '#f3e8ff' },
        impersonate: { DEFAULT: '#eab308', 50: '#fefce8', 100: '#fef9c3' },
        // ── ShadCN tokens (preserved) ────────────────────────────────
        border:      'hsl(var(--border))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        card:        'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-foreground))',
        primary:     'hsl(var(--primary))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
        muted:       'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        ring:        'hsl(var(--ring))',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: '6px', md: '10px', lg: '14px', xl: '20px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'monospace'],
      },
      boxShadow: {
        xs:         '0 1px 2px rgba(15,23,42,0.05)',
        glow:       '0 0 0 4px rgba(37,99,235,0.15)',
        'glow-cyan':'0 0 24px rgba(6,182,212,0.35)',
        dark:       '0 20px 60px rgba(0,0,0,0.45)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'marker-pulse': {
          '0%':   { transform: 'scale(0.5)', opacity: '0.7' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        'geofence-pulse': {
          '0%':   { transform: 'scale(0.5)', opacity: '0.5' },
          '70%':  { transform: 'scale(1.5)', opacity: '0' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
        'radar-ping': {
          '0%':   { transform: 'scale(0.3)', opacity: '0.9' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-500px 0' },
          '100%': { backgroundPosition: '500px 0' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(100%)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-up':        'fade-up 200ms cubic-bezier(0.16,1,0.3,1) both',
        'marker-pulse':   'marker-pulse 2s ease-out infinite',
        'geofence-pulse': 'geofence-pulse 3.2s ease-out infinite',
        'radar-ping':     'radar-ping 2.4s ease-out infinite',
        shimmer:          'shimmer 1.5s linear infinite',
        'slide-in':       'slide-in 300ms cubic-bezier(0.16,1,0.3,1) both',
      },
    },
  },
  plugins: [],
};
export default config;
