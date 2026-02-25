/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#4b6f9e", // Your EXACT Mobile BRAND_BLUE
          light: "#f0f9ff", // leafBanner background
          bg: "#f1f5f9",    // App background
        },
        text: {
          main: "#1e293b", // brandName color
          muted: "#64748b", // brandTagline color
          slate: "#334155", // productName color
        }
      }
    },
  },
  plugins: [],
}