/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#2F70FE', dark: '#1f4dc1' },
      },
    },
  },
  plugins: [],
}
