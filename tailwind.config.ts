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
        "bg-primary": "#0a0a0a",
        "bg-card": "#111111",
        "bg-overlay": "rgba(0,0,0,0.6)",
        accent: "#ff3b5c",
        "text-primary": "#ffffff",
        "text-muted": "#888888",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      maxWidth: {
        mobile: "480px",
      },
      backdropBlur: {
        glass: "12px",
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        nfws: {
          primary: "#ff3b5c",
          "primary-content": "#ffffff",
          secondary: "#222222",
          "secondary-content": "#ffffff",
          accent: "#ff3b5c",
          "accent-content": "#ffffff",
          neutral: "#111111",
          "neutral-content": "#888888",
          "base-100": "#0a0a0a",
          "base-200": "#111111",
          "base-300": "#1a1a1a",
          "base-content": "#ffffff",
          info: "#3abff8",
          success: "#36d399",
          warning: "#fbbd23",
          error: "#f87272",
        },
      },
    ],
    darkTheme: "nfws",
    base: true,
    styled: true,
    utils: true,
  },
};

export default config;
