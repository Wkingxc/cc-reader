/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        base: "var(--c-base)",
        side: "var(--c-side)",
        surface: "var(--c-surface)",
        edge: "var(--c-edge)",
        ink: "var(--c-ink)",
        dim: "var(--c-dim)",
        accent: "var(--c-accent)",
        "accent-soft": "var(--c-accent-soft)",
        "sel-bg": "var(--c-sel-bg)",
        "sel-ink": "var(--c-sel-ink)",
      },
    },
  },
  plugins: [],
};
