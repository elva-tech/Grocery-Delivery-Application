/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9f4',
          100: '#dcf1e3',
          200: '#bbe3cb',
          600: '#0F2C1D',
          700: '#0a1f14',
          900: '#05100a',
        },
        danger: {
          50: '#fef2f2',
          200: '#fecaca',
          600: '#dc2626',
        }
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
      }
    },
  },
  plugins: [],
};
