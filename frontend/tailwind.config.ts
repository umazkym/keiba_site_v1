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
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Roboto Mono", "monospace"],
      },
      colors: {
        primary: {
          light: "#60a5fa",
          DEFAULT: "#2563eb",
          dark: "#1e40af",
        },
        secondary: {
          light: "#4ade80",
          DEFAULT: "#16a34a",
          dark: "#14532d",
        },
        accent: {
          light: "#fcd34d",
          DEFAULT: "#f59e0b",
          dark: "#b45309",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        xl: "1rem",
      },
      boxShadow: {
        card: "0 6px 18px rgba(16, 24, 40, 0.06)",
        elevated: "0 10px 30px rgba(2, 6, 23, 0.08)",
      },
      fontSize: {
        "2xl": ["1.5rem", { lineHeight: "1.25" }],
        "3xl": ["1.875rem", { lineHeight: "1.15" }],
        "4xl": ["2.25rem", { lineHeight: "1.1" }],
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
  ],
};

export default config;
