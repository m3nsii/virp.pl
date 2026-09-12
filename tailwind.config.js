/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./gta6/**/*.html",
    "./klipy/**/*.html",
    "./toolkit/**/*.html",
    "./streamerzy/**/*.html",
    "./js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#06080F',
        'bg-secondary': '#0D111D',
        'bg-tertiary': '#141A29',
        'neon-pink': '#FF1F7D',
        'neon-amber': '#FF9E00',
        'neon-cyan': '#00F0FF',
        'status-green': '#00FF66',
        'accent-pink': '#FF1F7D',
        'accent-purple': '#a855f7',
        'accent-amber': '#FF9E00',
        'accent-cyan': '#00F0FF',
        'accent-green': '#00FF66',
      },
      fontFamily: {
        'display': ['Teko', 'sans-serif'],
        'data': ['Space Mono', 'monospace'],
        'sans': ['Space Mono', 'system-ui', 'sans-serif'],
        'mono': ['Space Mono', 'JetBrains Mono', 'monospace'],
      }
    }
  },
  plugins: [],
}
