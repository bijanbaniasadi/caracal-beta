import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Brand dark palette (from legacy site.css) ─────────────────────
        brand: {
          bg: '#071015', // --bg
          deep: '#0b1218', // --bg-deep
          panel: 'rgba(255,255,255,0.05)',
          'panel-strong': 'rgba(255,255,255,0.08)',
          line: 'rgba(255,255,255,0.10)',
          'line-strong': 'rgba(255,255,255,0.18)',
          text: '#ecf2ff', // --text
          muted: '#9aa8bf', // --muted
          orange: '#ff7a18', // --orange
          'orange-soft': '#ffb980', // --orange-soft
          green: '#24c768', // --green
        },
        ecu: {
          base: '#0F1419',
          card: '#151B24',
          border: '#1F2937',
          hover: '#1A2332',
          orange: '#FF8A34',
          green: '#20C65E',
          amber: '#FFB842',
          red: '#FF5757',
        },
      },
      fontFamily: {
        // IBM Plex Sans — body
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        // Exo 2 — display/headings
        display: ['"Exo 2"', 'system-ui', 'sans-serif'],
        // Rajdhani — technical/mono-like labels
        technical: ['Rajdhani', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'orange-gradient': 'linear-gradient(135deg, #ff7a18 0%, #ffb980 100%)',
      },
      boxShadow: {
        brand: '0 30px 70px rgba(0,0,0,0.35)',
        'brand-sm': '0 8px 30px rgba(0,0,0,0.4)',
      },
      borderRadius: {
        brand: '28px',
      },
    },
  },
  plugins: [],
};

export default config;
