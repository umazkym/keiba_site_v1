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
          DEFAULT: "#0f172a", // Midnight Blue Base (Slate 900)
          light: "#1e293b",   // Slate 800
          dark: "#020617",    // Deepest Slate 950
        },
        secondary: {
          DEFAULT: "#64748b", // Slate 500
          light: "#94a3b8",   // Slate 400
          dark: "#475569",    // Slate 600
        },
        accent: {
          DEFAULT: "#f59e0b", // Amber 500 (Brighter for glow)
          light: "#fbbf24",   // Amber 400
          dark: "#d97706",    // Amber 600
        },
        background: "#ffffff", // Pure White
        surface: "#f8fafc",    // Slate 50
        text: {
          DEFAULT: "#0f172a",  // Slate 900
          primary: "#0f172a",  // Slate 900
          secondary: "#475569",// Slate 600
          muted: "#94a3b8",    // Slate 400
        },
        border: "#f1f5f9",     // Slate 100 (Softer border)
      },
      fontFamily: {
        sans: [
          '"Inter"',
          '"Noto Sans JP"',
          '"Hiragino Kaku Gothic ProN"',
          '"Hiragino Sans"',
          "sans-serif",
        ],
        mono: [
          '"Roboto Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "monospace"
        ]
      },
      borderRadius: {
        xl: "1rem",
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem",
      },
      boxShadow: {
        soft: "0 4px 20px -2px rgba(15, 23, 42, 0.05)",
        elevated: "0 10px 30px -5px rgba(15, 23, 42, 0.08)",
        glow: "0 0 15px rgba(245, 158, 11, 0.3)",
      },
      animation: {
        'slide-up': 'slide-up 0.4s ease-out forwards',
      },
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    }
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
  ],
};

export default config;