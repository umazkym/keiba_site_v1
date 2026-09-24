import type { Config } from "tailwindcss";

// 色と書体はロゴ（インディゴの円と紺の線の馬）から決めた値。
// lib/brand.ts・app/globals.css・backend/scripts/brand_tokens.py と同じ値にそろえる。
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
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
        // ブランド：ロゴの円。リンク・選択中・主ボタン（旧 blue-* の置き換え先）
        brand: {
          DEFAULT: "#4C4EFF",
          50: "#F3F3FF",
          100: "#E5E6FF",
          200: "#CDCEFF",
          300: "#A9ABFF",
          400: "#7C7EFF",
          500: "#5C5EFF",
          600: "#4C4EFF",
          700: "#3638D6",
          800: "#2B2DAA",
          900: "#1F2180",
          950: "#141655",
        },
        // 紺：ロゴの線。見出し・会場×Rのプレート
        navy: {
          DEFAULT: "#1C2787",
          deep: "#121A5C",
          soft: "#DFE2F4",
        },
        // 夜の紺：フッター・写真の上の幕・SNS・動画の面。sub/faint はその上の文字
        night: {
          DEFAULT: "#0E1440",
          sub: "#C9CDEB",
          faint: "#AEB3D9",
        },
        // 中立の色（青みのある灰）。slate を置き換え、全体をロゴの紺に寄せる
        slate: {
          50: "#F3F5FA",
          100: "#EEF0F7",
          200: "#E2E5EF",
          300: "#CDD2E2",
          400: "#8388A6",
          500: "#5A6183",
          600: "#474E73",
          700: "#3A4063",
          800: "#262C52",
          900: "#151A3D",
          950: "#0E1440",
        },
        // AI偏差値：棒と◎は ai、数字の文字は ai-deep
        ai: {
          DEFAULT: "#F2A516",
          deep: "#865300",
          soft: "#FFF1D1",
        },
        turf: { DEFAULT: "#2E8B57", deep: "#1D6B40", soft: "#E2F2E8" },
        dirt: { DEFAULT: "#A5692F", deep: "#7D4B1C", soft: "#F4E8DA" },
        jump: "#6C54C8",
        grade: { g1: "#1F5FD1", g2: "#D23B3B", g3: "#1E8E4F", local: "#8E5E26" },
        // JRAの枠の色。意味を変えないため、ブランドの色とは独立させる
        waku: {
          1: "#FFFFFF",
          "1-fg": "#151A3D",
          "1-border": "#AEB4C8",
          2: "#1B1C22",
          3: "#E03A2F",
          4: "#2563EB",
          5: "#F5C518",
          "5-fg": "#151A3D",
          "5-border": "#E0B000",
          6: "#26954B",
          7: "#EE7D1F",
          8: "#EC5A96",
        },
        primary: {
          DEFAULT: "#151A3D",
          light: "#1C2787",
          dark: "#0E1440",
        },
        secondary: {
          DEFAULT: "#5A6183",
          light: "#5A6183",
          dark: "#474E73",
        },
        accent: {
          DEFAULT: "#F2A516",
          light: "#FFC24D",
          dark: "#865300",
        },
        background: "#ffffff",
        surface: "#F3F5FA",
        text: {
          DEFAULT: "#151A3D",
          primary: "#151A3D",
          secondary: "#3A4063",
          muted: "#5A6183",
        },
        border: "#E2E5EF",
      },
      fontFamily: {
        // 見出しと数字は next/font で読み込んだ書体を CSS 変数で受ける（app/layout.tsx）
        // 本文は端末の日本語書体（--font-body は globals.css の :root で定義）
        sans: [
          "var(--font-body)",
        ],
        display: [
          "var(--font-display)",
          "var(--font-body)",
        ],
        num: [
          "var(--font-num)",
          "var(--font-body)",
          "sans-serif",
        ],
        mono: [
          "var(--font-num)",
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
        soft: "none",
        elevated: "0 10px 30px -5px rgba(14, 20, 64, 0.10)",
        glow: "none",
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
