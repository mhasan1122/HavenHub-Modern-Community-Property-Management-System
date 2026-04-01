/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ['./App.tsx', './components/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // Ensure dynamic classes used at runtime are not purged by Tailwind's JIT
  safelist: [
    'bg-paymentPartialBg', 'text-paymentPartial',
    'bg-paymentPaid', 'text-white',
    'bg-paymentFailedBg', 'text-paymentFailed',
    'bg-paymentRefundedBg', 'text-paymentRefunded',
    'bg-paymentUnknownBg', 'text-paymentUnknown',
    'bg-paymentDueBg', 'text-paymentDue',
    'bg-paymentCompletedBg', 'text-paymentCompleted'
  ],
  theme: {
    extend: {
      fontFamily: {
        oxanium: ['Oxanium-Regular', 'System', 'sans-serif'],
        'oxanium-medium': ['Oxanium-Medium', 'System', 'sans-serif'],
        'oxanium-semibold': ['Oxanium-SemiBold', 'System', 'sans-serif'],
        'oxanium-bold': ['Oxanium-Bold', 'System', 'sans-serif'],
        lato: ['Lato-Regular', 'System', 'sans-serif'],
        'lato-thin': ['Lato-Thin', 'System', 'sans-serif'],
        'lato-light': ['Lato-Light', 'System', 'sans-serif'],
        'lato-regular': ['Lato-Regular', 'System', 'sans-serif'],
        'lato-bold': ['Lato-Bold', 'System', 'sans-serif'],
        'lato-black': ['Lato-Black', 'System', 'sans-serif'],
      },
      colors: {
        primary: "#3C9D9B", // Teal - Primary brand color
        primaryHover: "#34877A", // Darker teal - Primary hover state
        primaryDark: "#2A7A78", // Even darker teal - Primary dark variant
        primaryLight: "#EBF5F5", // Light teal - Primary light background
        primaryTransparent: "#3C9D9B1A", // Primary with 10% opacity
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
        green: "#3C9D9B", // Teal again - repeated as 'green'
        disabledInput: "#E8E8E8", // Light grey for disabled inputs
        borderCheckbox: "#B6C1CA", // Border color for checkboxes
        label: "#F5F5F5", // Light Grey - Used for labels
        labelBg: "#F5F5F5",
        placeholder: "#9CA3AF",
        textPrimary: "#090909", // Primary text color
        backgroundInput: "#FFFFFF", // Input background color
        textSecondary: "#666666", // Secondary text color
        border: "#E5E7EB", // Default border color
        mintGreen: '#D1FAE5', // Light mint green background
        // Payment status colors
        paymentPartial: '#F59E0B', // Amber/Orange for partial payments
        paymentPartialBg: '#FEF3C7', // Light amber background
        paymentPaid: '#3D9D9B', // Teal for paid status
        paymentFailed: '#EF4444', // Red for failed payments
        paymentFailedBg: '#FEE2E2', // Light red background
        paymentRefunded: '#8B5CF6', // Purple for refunded
        paymentRefundedBg: '#EDE9FE', // Light purple background
        paymentUnknown: '#6B7280', // Gray for unknown status
        paymentUnknownBg: '#F3F4F6', // Light gray background
        paymentDue: '#3B82F6', // Blue for due status
        paymentDueBg: '#DBEAFE', // Light blue background
        paymentCompleted: '#10B981', // Green for completed/paid status
        paymentCompletedBg: '#D1FAE5', // Light green background
        termsAndPrivacy: '#FBFFC4', // Light yellow for terms and privacy
      },
    },
  },
  plugins: [],
};
