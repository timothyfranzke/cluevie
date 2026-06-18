import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F3EAD9",
        surface: "#FCF7EC",
        ink: "#2B1517",
        muted: "#9C8978",
        line: "#E6D9C4",
        accent: "#7C1F2C",
        "accent-ink": "#FBF3E8",
        clue: "#C8902F",
        correct: "#4F9A63",
        incorrect: "#CF4339",
        "slot-empty": "#ECE1CD",
      },
      fontFamily: {
        display: ["Shrikhand", "serif"],
        sans: ["Hanken Grotesk", "system-ui", "sans-serif"],
      },
      borderRadius: {
        slot: "10px",
        card: "18px",
        phone: "46px",
      },
      animation: {
        iris: "irisReveal 4.6s ease-in-out infinite",
        "iris-once": "irisRevealOnce 800ms ease-out both",
        shake: "shake 380ms cubic-bezier(.36,.07,.19,.97) both",
      },
      keyframes: {
        irisReveal: {
          "0%": { clipPath: "circle(0% at 50% 40%)", opacity: ".15" },
          "26%": { clipPath: "circle(150% at 50% 40%)", opacity: "1" },
          "86%": { clipPath: "circle(150% at 50% 40%)", opacity: "1" },
          "100%": { clipPath: "circle(0% at 50% 40%)", opacity: ".15" },
        },
        irisRevealOnce: {
          "0%": { clipPath: "circle(0% at 50% 40%)", opacity: ".15" },
          "100%": { clipPath: "circle(150% at 50% 40%)", opacity: "1" },
        },
        shake: {
          "10%, 90%": { transform: "translateX(-2px)" },
          "20%, 80%": { transform: "translateX(3px)" },
          "30%, 50%, 70%": { transform: "translateX(-6px)" },
          "40%, 60%": { transform: "translateX(6px)" },
        },
      },
      boxShadow: {
        phone: "0 30px 70px -22px rgba(40,20,15,.45)",
        card: "0 8px 20px -12px rgba(40,20,15,.4)",
        dropdown: "0 16px 36px -16px rgba(40,20,15,.5)",
        sheet: "0 -10px 40px -10px rgba(40,20,15,.4)",
      },
    },
  },
  plugins: [],
} satisfies Config;
