/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Chunky toy palette (tactile, not babyish).
        ink: '#15131f',
        panel: '#221d33',
        panel2: '#2c2542',
        edge: '#3d3458',
        hi: '#ffd34e',
        bass: '#ff6b9d',
        lead: '#4ee0ff',
        chord: '#9b7bff',
        drum: '#ff924e',
      },
      fontFamily: {
        display: ['"Baloo 2"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        chunky: '0 4px 0 0 rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
};
