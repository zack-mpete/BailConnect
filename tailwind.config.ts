import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101828",
        muted: "#667085",
        brand: {
          50: "#ecfeff",
          100: "#cffafe",
          500: "#06b6d4",
          600: "#0891b2",
          900: "#164e63"
        },
        sand: "#f6f0e8"
      },
      boxShadow: {
        soft: "0 20px 60px rgba(15, 23, 42, .10)",
        card: "0 18px 35px rgba(16, 24, 40, .08)"
      },
      borderRadius: { xxl: "2rem" }
    }
  },
  plugins: []
};
export default config;
