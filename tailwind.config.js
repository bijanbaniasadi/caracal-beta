/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary dark automotive palette
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // CaracalTech brand dark base
        dark: {
          base: '#0F1419',      // Primary background
          card: '#151B24',      // Secondary/card background
          border: '#1F2937',    // Border/separator color
          hover: '#1A2332',     // Hover state background
        },
        // Accent orange - energetic but professional
        orange: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#FF8A34',       // Brand accent (primary orange)
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        // Success - vehicle green
        green: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#20C65E',       // Vehicle green
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#145231',
          950: '#051e0f',
        },
        // Warning - diagnostic amber
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#FFB842',       // Diagnostic amber
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        // Error - red
        red: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#FF5757',       // Error red
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        // Neutral grays
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#0a0a0a',
        },
      },
      fontFamily: {
        // Inter for display and body text
        display: ['Inter', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        // JetBrains Mono for code/logs
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        // Tailored for automotive/technical interface
        xs: ['12px', { lineHeight: '16px', letterSpacing: '0.5px' }],
        sm: ['13px', { lineHeight: '18px', letterSpacing: '0.3px' }],
        base: ['14px', { lineHeight: '20px', letterSpacing: '0px' }],
        lg: ['15px', { lineHeight: '22px', letterSpacing: '0px' }],
        xl: ['16px', { lineHeight: '24px', letterSpacing: '0px' }],
        '2xl': ['18px', { lineHeight: '28px', letterSpacing: '-0.5px' }],
        '3xl': ['20px', { lineHeight: '32px', letterSpacing: '-0.5px' }],
        '4xl': ['24px', { lineHeight: '36px', letterSpacing: '-1px' }],
        '5xl': ['28px', { lineHeight: '40px', letterSpacing: '-1px' }],
        '6xl': ['32px', { lineHeight: '44px', letterSpacing: '-1.5px' }],
      },
      fontWeight: {
        thin: '100',
        extralight: '200',
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
        black: '900',
      },
      spacing: {
        // 8px grid system
        0: '0px',
        1: '8px',
        2: '16px',
        3: '24px',
        4: '32px',
        5: '40px',
        6: '48px',
        7: '56px',
        8: '64px',
        9: '72px',
        10: '80px',
      },
      borderRadius: {
        none: '0px',
        sm: '4px',
        DEFAULT: '8px',    // Standard 8px radius
        md: '8px',
        lg: '12px',        // Large container radius
        xl: '16px',
        '2xl': '20px',
        '3xl': '24px',
        full: '9999px',
      },
      boxShadow: {
        // Subtle elevation for automotive aesthetic
        none: 'none',
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.2)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.25)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.35)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.3)',
      },
      opacity: {
        0: '0',
        5: '0.05',
        10: '0.1',
        20: '0.2',
        25: '0.25',
        30: '0.3',
        40: '0.4',
        50: '0.5',
        60: '0.6',
        70: '0.7',
        75: '0.75',
        80: '0.8',
        90: '0.9',
        95: '0.95',
        100: '1',
      },
      transitionDuration: {
        0: '0ms',
        75: '75ms',
        100: '100ms',
        150: '150ms',
        200: '200ms',
        300: '300ms',
        500: '500ms',
        700: '700ms',
        1000: '1000ms',
      },
      transitionTimingFunction: {
        linear: 'linear',
        in: 'cubic-bezier(0.4, 0, 1, 1)',
        out: 'cubic-bezier(0, 0, 0.2, 1)',
        'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
        bounce: {
          '0%, 100%': {
            transform: 'translateY(0)',
            animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)',
          },
          '50%': {
            transform: 'translateY(-10px)',
            animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
          },
        },
        slideInRight: {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        slideOutRight: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(100%)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        fadeOut: {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
      },
      animation: {
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        spin: 'spin 1s linear infinite',
        bounce: 'bounce 1s infinite',
        'slide-in-right': 'slideInRight 300ms ease-out',
        'slide-out-right': 'slideOutRight 300ms ease-in',
        'fade-in': 'fadeIn 300ms ease-in-out',
        'fade-out': 'fadeOut 300ms ease-in-out',
      },
      backdropFilter: {
        none: 'none',
        blur: 'blur(10px)',
      },
      zIndex: {
        0: '0',
        10: '10',
        20: '20',
        30: '30',
        40: '40',
        50: '50',
        auto: 'auto',
        modal: '1000',
        dropdown: '1001',
        sticky: '100',
      },
      maxWidth: {
        none: 'none',
        xs: '320px',
        sm: '384px',
        md: '448px',
        lg: '512px',
        xl: '576px',
        '2xl': '672px',
        '3xl': '768px',
        '4xl': '896px',
        '5xl': '1024px',
        '6xl': '1152px',
        '7xl': '1280px',
        full: '100%',
        min: 'min-content',
        max: 'max-content',
        fit: 'fit-content',
      },
      minHeight: {
        0: '0px',
        full: '100%',
        screen: '100vh',
      },
    },
  },
  plugins: [
    // Custom plugin for utility classes and component patterns
    function({ addComponents, theme }) {
      addComponents({
        // Base input/form styles
        '.input-base': {
          '@apply bg-dark-hover border border-dark-border rounded text-white placeholder-gray-500 text-base px-3 py-2 transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500': {},
        },
        // Button base styles
        '.btn-base': {
          '@apply inline-flex items-center justify-center rounded font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-base': {},
        },
        '.btn-primary': {
          '@apply btn-base bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed': {},
        },
        '.btn-secondary': {
          '@apply btn-base bg-gray-700 text-white hover:bg-gray-600 active:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed': {},
        },
        '.btn-success': {
          '@apply btn-base bg-green-500 text-white hover:bg-green-600 active:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed': {},
        },
        '.btn-danger': {
          '@apply btn-base bg-red-500 text-white hover:bg-red-600 active:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed': {},
        },
        '.btn-ghost': {
          '@apply btn-base bg-transparent text-gray-400 hover:text-white hover:bg-dark-hover active:bg-dark-card disabled:opacity-50 disabled:cursor-not-allowed': {},
        },
        // Card base styles
        '.card': {
          '@apply bg-dark-card border border-dark-border rounded-lg p-4 shadow-sm': {},
        },
        '.card-lg': {
          '@apply bg-dark-card border border-dark-border rounded-lg p-6 shadow-sm': {},
        },
        // Badge styles
        '.badge': {
          '@apply inline-flex items-center px-2 py-1 rounded text-xs font-semibold': {},
        },
        '.badge-success': {
          '@apply badge bg-green-500 bg-opacity-20 text-green-400': {},
        },
        '.badge-warning': {
          '@apply badge bg-amber-500 bg-opacity-20 text-amber-400': {},
        },
        '.badge-danger': {
          '@apply badge bg-red-500 bg-opacity-20 text-red-400': {},
        },
        '.badge-info': {
          '@apply badge bg-blue-500 bg-opacity-20 text-blue-400': {},
        },
        // Status indicator dot
        '.status-dot': {
          '@apply inline-block w-2 h-2 rounded-full': {},
        },
        '.status-idle': {
          '@apply status-dot bg-gray-500': {},
        },
        '.status-active': {
          '@apply status-dot bg-orange-500 animate-pulse': {},
        },
        '.status-success': {
          '@apply status-dot bg-green-500': {},
        },
        '.status-error': {
          '@apply status-dot bg-red-500': {},
        },
        // Banner/alert styles
        '.banner': {
          '@apply border-l-4 rounded-r p-4 flex items-start gap-3': {},
        },
        '.banner-info': {
          '@apply banner border-blue-500 bg-blue-500 bg-opacity-10': {},
        },
        '.banner-success': {
          '@apply banner border-green-500 bg-green-500 bg-opacity-10': {},
        },
        '.banner-warning': {
          '@apply banner border-amber-500 bg-amber-500 bg-opacity-10': {},
        },
        '.banner-error': {
          '@apply banner border-red-500 bg-red-500 bg-opacity-10': {},
        },
        // Text utilities
        '.text-muted': {
          '@apply text-gray-500': {},
        },
        '.text-label': {
          '@apply text-gray-400 text-sm font-medium': {},
        },
        '.text-mono': {
          '@apply font-mono text-sm': {},
        },
        // Links
        '.link': {
          '@apply text-orange-500 hover:text-orange-400 underline transition-colors': {},
        },
        '.link-ghost': {
          '@apply text-gray-400 hover:text-white no-underline transition-colors': {},
        },
      });
    },
  ],
  // Dark mode configuration
  darkMode: 'class',
  // Variant order
  variantOrder: [
    'first',
    'last',
    'odd',
    'even',
    'visited',
    'checked',
    'empty',
    'read-only',
    'group-hover',
    'group-focus',
    'focus-within',
    'hover',
    'focus',
    'focus-visible',
    'active',
    'disabled',
  ],
};
