/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Chakra Petch"', "ui-sans-serif", "system-ui"],
        sans: ['"Sora"', "ui-sans-serif", "system-ui"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        ink: "#0b0e14",
        paper: "#f6f4ee",
        accent: "#ff5c28",
        "accent-soft": "#ffe9df",
      },
      keyframes: {
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "sweep": {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(120%)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(255,92,40,0.35)" },
          "70%": { boxShadow: "0 0 0 12px rgba(255,92,40,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(255,92,40,0)" },
        },
        "blink": { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.25" } },
      },
      animation: {
        "rise-in": "rise-in 0.6s cubic-bezier(0.16,1,0.3,1) both",
        sweep: "sweep 2.2s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.8s ease-out infinite",
        blink: "blink 1.4s steps(1) infinite",
      },
    },
  },
  plugins: [],
};
