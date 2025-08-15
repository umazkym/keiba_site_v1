import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#60a5fa', // blue-400
          DEFAULT: '#2563eb', // blue-600
          dark: '#1e40af',  // blue-800
        },
        secondary: {
          light: '#4ade80', // green-400
          DEFAULT: '#16a34a', // green-600
          dark: '#14532d',  // green-900
        },
        accent: {
          light: '#fcd34d', // amber-300
          DEFAULT: '#f59e0b', // amber-500
          dark: '#b45309',  // amber-700
        }
      }
    },
  },
  plugins: [],
};
export default config;