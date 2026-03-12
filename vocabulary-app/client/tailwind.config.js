/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary-accent": "#2c3e50", // Refined charcoal grey/deep blue
        "notebook-beige": "#fdf8f1", // Warm Light Beige
        "ink": "#333333", // Darker ink for better legibility
        "subtle-grey": "#e2e8f0"
      },
      fontFamily: {
        "heading": ["'Montserrat'", "sans-serif"],
        "body": ["'Inter'", "sans-serif"],
        "sans": ["'Inter'", "sans-serif"]
      },
    },
  },
  plugins: [],
}
