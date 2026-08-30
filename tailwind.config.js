/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // TODO: add Arabic-friendly premium font (e.g. IBM Plex Sans Arabic / Cairo)
        sans: ['"Cairo"', 'sans-serif'],
      },
      colors: {
        // TODO: define brand palette (placeholder premium neutral/gold tones)
        brand: {
          DEFAULT: '#111111',
          gold: '#C6A15B',
          light: '#F5F1EA',
        },
      },
    },
  },
  plugins: [],
}
