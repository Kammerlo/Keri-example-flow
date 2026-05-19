/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui"],
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        ink: "#11161c",
        paper: "#f7f8f8",
        accent: "#0d7d74",
        "accent-soft": "#e7f2f0",
      },
      keyframes: {
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "rise-in": "rise-in 0.45s cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [],
};
