/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#0a0c10',
          1: '#12151c',
          2: '#1a1e28',
          3: '#232836',
        },
        accent: '#5b8def',
        positive: '#34d399',
        negative: '#f87171',
        caution: '#fbbf24',
        retirement: '#a78bfa',
        highlight: '#22d3ee',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
