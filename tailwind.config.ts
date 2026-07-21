import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "warm-cream": "#FAF6EE",
        "deep-navy": "#111827",
        "burgundy-wine": "#881337",
        "paypal-gold": "#FFC439",
        "warm-amber": "#F2A716",
        "soft-gray": "#9CA3AF",
        "warm-green": "#22C55E",
        "warm-red": "#EF4444",
        "vintage-burgundy": "#722F37",
        "vintage-gold": "#C9A962",
        "vintage-green": "#4A7C59",
        "vintage-red": "#A52A2A",
        "vintage-stone": "#F5F0E6",
        "vintage-border": "#9A8B7A",
      },
      fontFamily: {
        serif: ['Georgia', 'serif'],
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'retro': '4px 4px 0px 0px #111827',
        'retro-sm': '3px 3px 0px 0px #111827',
        'retro-lg': '6px 6px 0px 0px #111827',
        'card': '2px 2px 0px 0px #111827',
        'vintage': '0 4px 20px -4px rgba(114, 47, 55, 0.15), 0 2px 8px -2px rgba(154, 139, 122, 0.2)',
        'vintage-lg': '0 8px 30px -4px rgba(114, 47, 55, 0.2), 0 4px 12px -2px rgba(154, 139, 122, 0.25)',
      },
      lineHeight: {
        'body': '1.7',
      },
      animation: {
        "gradient": "gradient 8s ease infinite",
        "float": "float 6s ease-in-out infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 8s linear infinite",
        "wave-1": "wave1 0.8s ease-in-out infinite",
        "wave-2": "wave2 0.8s ease-in-out infinite 0.1s",
        "wave-3": "wave3 0.8s ease-in-out infinite 0.2s",
        "wave-4": "wave4 0.8s ease-in-out infinite 0.3s",
        "wave-5": "wave5 0.8s ease-in-out infinite 0.4s",
      },
      keyframes: {
        gradient: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        wave1: {
          "0%, 100%": { transform: "scaleY(0.5)" },
          "50%": { transform: "scaleY(1.5)" },
        },
        wave2: {
          "0%, 100%": { transform: "scaleY(0.7)" },
          "50%": { transform: "scaleY(1.2)" },
        },
        wave3: {
          "0%, 100%": { transform: "scaleY(0.4)" },
          "50%": { transform: "scaleY(1.8)" },
        },
        wave4: {
          "0%, 100%": { transform: "scaleY(0.6)" },
          "50%": { transform: "scaleY(1.4)" },
        },
        wave5: {
          "0%, 100%": { transform: "scaleY(0.8)" },
          "50%": { transform: "scaleY(1.1)" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  daisyui: {
    themes: [
      {
        warmRetro: {
          "primary": "#881337",
          "secondary": "#FFC439",
          "accent": "#881337",
          "neutral": "#111827",
          "base-100": "#FAF6EE",
          "base-200": "#F5F0E6",
          "base-300": "#E8E0D5",
          "base-content": "#111827",
          "info": "#38bdf8",
          "success": "#22C55E",
          "warning": "#F2A716",
          "error": "#EF4444",
        },
      },
      {
        modern: {
          "primary": "#0ea5e9",
          "secondary": "#6366f1",
          "accent": "#0ea5e9",
          "neutral": "#1f2937",
          "base-100": "#111827",
          "base-200": "#1f2937",
          "base-300": "#374151",
          "base-content": "#ffffff",
          "info": "#38bdf8",
          "success": "#22C55E",
          "warning": "#F59E0B",
          "error": "#EF4444",
        },
      },
      {
        vintageWarm: {
          "primary": "#722F37",
          "secondary": "#C9A962",
          "accent": "#722F37",
          "neutral": "#4A4A4A",
          "base-100": "#F5F0E6",
          "base-200": "#E8E0D5",
          "base-300": "#D4CAC0",
          "base-content": "#4A4A4A",
          "info": "#5B8FF9",
          "success": "#4A7C59",
          "warning": "#C9A962",
          "error": "#A52A2A",
        },
      },
      {
        warmVintageGold: {
          "primary": "#B8964E",
          "secondary": "#D4AF37",
          "accent": "#8B7355",
          "neutral": "#5C5040",
          "base-100": "#FDF8E8",
          "base-200": "#F5EED9",
          "base-300": "#E8DCC2",
          "base-content": "#3D352A",
          "info": "#5B8FF9",
          "success": "#6B8E4E",
          "warning": "#D4AF37",
          "error": "#A54A4A",
        },
      },
    ],
  },
  plugins: [require("daisyui")],
};

export default config;