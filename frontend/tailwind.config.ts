import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
      },
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0f172a", // slate-900 (Main Brand Color)
          light: "#334155",   // slate-700
          dark: "#020617",    // slate-950
        },
        secondary: {
          DEFAULT: "#64748b", // slate-500
          light: "#94a3b8",   // slate-400
          dark: "#475569",    // slate-600
        },
        accent: {
          DEFAULT: "#d97706", // amber-600 (Action/Win)
          light: "#fbbf24",   // amber-400
          dark: "#b45309",    // amber-700
        },
        background: "#ffffff", // Pure White
        surface: "#f8fafc",    // slate-50
        text: {
          DEFAULT: "#0f172a",  // slate-900
          primary: "#0f172a",  // slate-900
          secondary: "#475569",// slate-600
          muted: "#94a3b8",    // slate-400
        },
        border: "#e2e8f0",     // slate-200
      },
      fontFamily: {
        sans: [
          '"Hiragino Kaku Gothic ProN"',
          '"Hiragino Sans"',
          '"Noto Sans JP"',
          "sans-serif",
        ],
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        elevated: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
  ],
};

export default config;