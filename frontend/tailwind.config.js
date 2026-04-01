/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  // Safelist to ensure form-related Tailwind classes are never purged
  // This prevents styles from disappearing on page refresh when classes are conditionally applied
  safelist: [
    // Form input error states (conditionally applied)
    'border-red-500',
    'focus:border-red-500',
    // Form input disabled states (conditionally applied)
    'bg-disabledInput',
    'cursor-not-allowed',
    'text-black100',
  ],
  theme: {
    extend: {
      colors: {
        primary: "#3C9D9B", // Teal - Primary brand color
        primaryHover: "#34877A", // Darker teal - Primary hover state
        primaryDark: "#2A7A78", // Even darker teal - Primary dark variant
        primaryLight: "#EBF5F5", // Light teal - Primary light background
        primaryTransparent: "#3C9D9B1A", // Primary with 10% opacity
        // subprimary: "#EBF5F5", // Transparent Teal - Primary with low opacity (10%)
        subprimary: "#E6F0F1", // Transparent Teal - Primary with low opacity (10%)
        secondary: "#FF8682", // Light Coral - Secondary accent color
        white: "#FFFFFF", // Pure White
        black: "#000000", // Pure Black
        textDark: "#090909", // Very dark text
        textMedium: "#666666", // Medium gray text
        grey100: "#1B1F26B8", // Dark Grey with ~72% opacity
        stroke: "#F9F9FB", // Very light grey - used for strokes or backgrounds
        borderPrimary: "0000004D", // Black with 30% opacity (for borders)
        borderSecondary: "#79747E", // Medium Grey - Secondary border color
        success: "#28A745", // Green - Indicates success state
        error: "#FF8682", // Red - Indicates error or danger
        urgent: "#EF3232", // Deep Red - For urgent priority notices
        warning: "#EAB305", // Deep Orange/Amber - Used for warning/high priority
        info: "#17A2B8", // Cyan/Blue - Used for info messages or highlights
        green: "#3C9D9B",
        disabledInput: "#E8E8E8", // ✅ Add this        // Teal again - repeated as 'green'
        borderCheckbox: "#B6C1CA",
        label: "#F5F5F5", // Light Grey - Used for labels
        labelBg: "#F5F5F5", // Light gray background for labels
        // Standardized tokens for hardcoded colors found in codebase
        surfaceMuted: "#F9F9FB", // Matches page background (stroke color)
        ink: "#0F172A",
        borderLight: "#E2E8F0",
        borderMid: "#D0D5DD",
        borderPale: "#E4E7EC",
        surfaceAlt: "#F4F6FB",
        surfaceTeal: "#ECF5F5",
        borderNeutral: "#DCE0E5",
        graySurface: "#F3F4F6",
        borderGray: "#E5E7EB",
        inkSecondary: "#475467",
        primaryHoverAlt: "#2f7c7a",
        borderTable: "#DDE1E7", // Light gray border for table borders
        textTable: "#1E1E1E", // Dark text for table content
        textLabel: "#14181F", // Dark text for labels
        greenBillCategory: "#2A7D56"
      },

      spacing: {
        1.5: "6px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "18px",
        6: "20px",
        7: "22px",
        10: "40px",
        12: "48px",
        14: "56px",
        15: "60px",
        18: "72px",
        20: "80px",
        25: "100px",
        30: "120px",
        "1/2": "50%",
        "1/3": "33.333%",
        "2/3": "66.666%",
        "1/4": "25%",
        "3/4": "75%"
      },
      borderRadius: {
        27: "27px",
        8: "8px",
        10: "10px",
        16: "16px",
        full: "9999px",
        lg: "12px"
      },

      rounded: {
        27: "27px",
        8: "8px",
        10: "10px",
        full: "9999px",
        lg: "12px"
      },

      fontFamily: {
        sans: ["Lato", "Inter", "sans-serif"],
        body: ["Lato", "Inter", "sans-serif"],
        heading: ["Poppins", "Lato", "sans-serif"],
        serif: ["Merriweather", "serif"]
      },
      boxShadow: {
        lg: "0 10px 15px rgba(0, 0, 0, 0.1)",
        xl: "0 20px 30px rgba(0, 0, 0, 0.15)",
        "2xl": "0 30px 45px rgba(0, 0, 0, 0.2)",
        inset: "inset 0 2px 4px rgba(0, 0, 0, 0.05)",
        "ring-primary": "0 0 0 3px rgba(61, 157, 155, 0.15)"
      },
      fontSize: {
        base: "1rem", // 16px
        lg: "1.125rem", // 18px
        xl: "1.5rem", // 24px
        xxl: "2.25rem", // 36px
        sm: "0.875rem", // 14px
        xxl2: "3rem" // 48px (Added xxl2 for extra-large font size)
      },

      lineHeight: {
        normal: "1.5",
        relaxed: "1.75",
        tight: "1.25"
      },
      transitionDuration: {
        1000: "1000ms"
      },
      transitionTimingFunction: {
        "ease-in-out": "cubic-bezier(0.4, 0, 0.2, 1)"
      },
      animation: {
        bounce: "bounce 1s infinite",
        fade: "fadeIn 0.5s ease-out"
      },
      container: {
        center: false,
        padding: "1rem"
      },
      screens: {
        xs: "480px",
        xxl: "1440px"
      },

      maxWidth: {
        content: "1082px" // Custom max-width
      }

    }
  },
  plugins: []
};
