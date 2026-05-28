import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        dark: {
          bg:     "#080B10",
          bg2:    "#111622",
          bg3:    "#0D1420",
          border: "#1a2540",
        },
        light: {
          bg:     "#f0f4f8",
          bg2:    "#ffffff",
          bg3:    "#f8fafc",
          border: "#e2e8f0",
        },
        neon: {
          bull: "#00FF9D",
          bear: "#FF0055",
          acc:  "#00C8FF",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-in-out",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};

export default config;
