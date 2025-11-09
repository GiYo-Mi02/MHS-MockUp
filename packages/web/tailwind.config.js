/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1.5rem",
        lg: "2rem",
        xl: "3rem",
      },
    },
    extend: {
      colors: {
        brand: {
          DEFAULT: "#275996",
          dark: "#01061c",
          focus: "#1e4675",
          light: "#3f75bc",
          softer: "#5e90d1",
        },
        surface: {
          DEFAULT: "#0f1f3a",
          light: "#15294a",
          softer: "#1d345b",
        },
        neutral: {
          50: "#f8f9fc",
          100: "#edf0f8",
          200: "#d8def0",
          700: "#1f2937",
          900: "#01061c",
        },
      },
      boxShadow: {
        elevated: "0 18px 45px rgba(1, 6, 28, 0.25)",
      },
    },
  },
  plugins: [],
};
