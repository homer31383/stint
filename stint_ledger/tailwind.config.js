/** @type {import('tailwindcss').Config} */

// Field Journal palette (main app only). The /tickers page defines its own
// colors inline in src/tickers/theme.ts and uses none of these tokens.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Desk and paper
        desk: { 1: '#17211a', 2: '#101710' },
        paper: '#f3ecdc',
        paper2: '#ece2cc',
        paper3: '#e3d8bf',
        sage: '#e2e8d2',
        sagelabel: '#cfd8bf',
        kraft: '#d9c6a3',
        // Ink ramp (darkest to lightest)
        ink: '#2e2a20',
        'ink-2': '#3d3829',
        'ink-3': '#5c5440',
        'ink-dim': '#877e64',
        'ink-faint': '#8f8569',
        // Ink colors
        forest: '#3f6b42',
        oxblood: '#8e3b2f',
        clay: '#b0563b',
        fern: '#5f7d4f',
        pencil: '#a8813a',
        brass: '#8a6a2e',
        umber: '#7a5c2e',
        inkblue: '#3b5a7a',
        sagedeep: '#7d8f6a',
        rule: 'rgba(120,105,70,0.4)',
        // Legacy semantic tokens, remapped onto the Field Journal palette so
        // existing class names keep working.
        surface: {
          0: '#101710',
          1: '#f3ecdc',
          2: '#ece2cc',
          3: '#e3d8bf',
        },
        accent: '#5f7d4f',
        positive: '#3f6b42',
        negative: '#8e3b2f',
        caution: '#a8813a',
        retirement: '#7a5c2e',
        highlight: '#3b5a7a',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        serif: ['Fraunces', 'Georgia', 'serif'],
        hand: ['Caveat', 'cursive'],
      },
    },
  },
  plugins: [],
};
