/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "../src/views/**/*.html",
    "../src/renderer/**/*.js",
    "../src/preload/**/*.js"
  ],
  darkMode: 'class', // Enable dark mode with class strategy
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["light", "dark"], // Keep just light and dark themes
    darkTheme: "dark", // name of one of the included themes for dark mode
    base: true, // applies background color and foreground color for root element by default
    styled: true, // include daisyUI colors and design decisions for all components
    utils: true, // adds responsive and modifier utility classes
  },
}
