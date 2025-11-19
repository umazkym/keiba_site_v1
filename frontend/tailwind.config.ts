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
          DEFAULT: "#2563eb", // blue-600
          light: "#60a5fa",   // blue-400
          dark: "#1e40af",    // blue-800
        },
        secondary: {
          DEFAULT: "#64748b", // slate-500
          light: "#94a3b8",   // slate-400
          dark: "#475569",    // slate-600
        },
        accent: {
          DEFAULT: "#f59e0b", // amber-500
          light: "#fbbf24",   // amber-400
          dark: "#d97706",    // amber-600
        },
        background: "#f8fafc", // slate-50
        surface: "#ffffff",
        text: "#1e293b",       // slate-800
        muted: "#64748b",      // slate-500
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