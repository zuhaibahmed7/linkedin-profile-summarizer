/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./popup.html', './options.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#0a66c2',
          600: '#004182',
          700: '#003060',
        },
      },
    },
  },
  plugins: [],
};