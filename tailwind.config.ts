import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,js,jsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#bcdaff",
          300: "#8ec3ff",
          400: "#599fff",
          500: "#3578fb",
          600: "#1f58e6",
          700: "#1846c4",
          800: "#173b9a",
          900: "#13357a",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)",
        card: "0 4px 12px rgba(16,24,40,.08)",
      },
    },
  },
  plugins: [],
};

export default config;
