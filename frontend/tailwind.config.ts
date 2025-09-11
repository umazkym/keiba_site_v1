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
          light: "var(--color-primary-light)",
          DEFAULT: "var(--color-primary)",
          dark: "var(--color-primary-dark)",
        },
        secondary: {
          light: "var(--color-secondary-light)",
          DEFAULT: "var(--color-secondary)",
          dark: "var(--color-secondary-dark)",
        },
        accent: {
          light: "var(--color-accent-light)",
          DEFAULT: "var(--color-accent)",
          dark: "var(--color-accent-dark)",
        },
        // CSS変数に合わせて追加
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        muted: 'var(--muted)',
        border: 'var(--border)',
        text: 'var(--text)',
      },
      borderRadius: {
        lg: "0.75rem",
        xl: "1rem",
      },
      boxShadow: {
        // CSS変数に合わせて修正
        card: "var(--soft-shadow)",
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