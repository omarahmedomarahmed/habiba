import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0A2342",
          50: "#E8EEF5",
          100: "#C5D3E8",
          200: "#9FB5D6",
          300: "#7A97C4",
          400: "#5579B2",
          500: "#0A2342",
          600: "#091E3B",
          700: "#071830",
          800: "#051225",
          900: "#030C1A",
        },
        secondary: {
          DEFAULT: "#1F5EFF",
          50: "#E8EEFF",
          100: "#C5D5FF",
          200: "#99AEFF",
          300: "#6D87FF",
          400: "#4170FF",
          500: "#1F5EFF",
          600: "#1A4FD6",
          700: "#1540AD",
          800: "#103184",
          900: "#0B225B",
        },
        accent: {
          DEFAULT: "#24C8DB",
          50: "#E8FAFB",
          100: "#C5F2F6",
          200: "#99E7EF",
          300: "#6DDCE8",
          400: "#41D1E1",
          500: "#24C8DB",
          600: "#1EA9B9",
          700: "#188A97",
          800: "#126B75",
          900: "#0C4C53",
        },
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        info: "#3B82F6",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 16px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)",
        sidebar: "2px 0 8px rgba(0,0,0,0.08)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
        "pulse-soft": "pulseSoft 2s infinite",
        "typing": "typing 1.5s steps(3) infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        slideIn: { from: { transform: "translateX(-10px)", opacity: "0" }, to: { transform: "translateX(0)", opacity: "1" } },
        pulseSoft: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.5" } },
        typing: { "0%, 100%": { opacity: "0" }, "50%": { opacity: "1" } },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;

// Reviewed: 2026-06-13 — 24Therapy audit
