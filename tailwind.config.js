/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // This tells Tailwind to scan all these file types in your src folder
    "./public/index.html",       // Also scan the main HTML file
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

