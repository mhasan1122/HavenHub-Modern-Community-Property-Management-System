import { motion } from "framer-motion";

// Animation variants for common use cases
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const slideIn = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

export const slideUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export const slideDown = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
};

export const scaleUp = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8 },
};

// Transition presets
export const transition = {
  duration: 0.3,
  ease: [0.4, 0, 0.2, 1], // Custom easing
};

export const transitionFast = {
  duration: 0.2,
  ease: [0.4, 0, 0.2, 1],
};

export const transitionSlow = {
  duration: 0.5,
  ease: [0.4, 0, 0.2, 1],
};

export const springTransition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

export const smoothSpring = {
  type: "spring",
  stiffness: 200,
  damping: 25,
};

// Stagger animations for lists
export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

// Hover animations
export const hoverScale = {
  scale: 1.05,
  transition: transitionFast,
};

export const hoverLift = {
  y: -4,
  transition: transitionFast,
};

export const hoverGlow = {
  boxShadow: "0 0 20px rgba(60, 157, 155, 0.3)",
  transition: transitionFast,
};

// Button animations
export const buttonTap = {
  scale: 0.95,
  transition: transitionFast,
};

// Menu animations
export const menuSlide = {
  initial: { opacity: 0, height: 0 },
  animate: {
    opacity: 1,
    height: "auto",
    transition: {
      height: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
      },
      opacity: {
        duration: 0.2,
        delay: 0.1,
      },
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: {
      height: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
      },
      opacity: {
        duration: 0.2,
      },
    },
  },
};

// Page transition variants
export const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

// Modal animations
export const modalBackdrop = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const modalContent = {
  initial: { opacity: 0, scale: 0.9, y: 20 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 20,
    transition: transitionFast,
  },
};

// Table row animations
export const tableRow = {
  initial: { opacity: 0, x: -10 },
  animate: {
    opacity: 1,
    x: 0,
    transition: transition,
  },
};

// Card animations
export const cardHover = {
  y: -4,
  boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
  transition: transition,
};

// Sidebar animations
export const sidebarSlide = {
  initial: { x: "-100%" },
  animate: {
    x: 0,
    transition: springTransition,
  },
  exit: {
    x: "-100%",
    transition: transition,
  },
};

// Notification/Toast animations
export const toastSlide = {
  initial: { opacity: 0, x: 300, scale: 0.8 },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    x: 300,
    scale: 0.8,
    transition: transitionFast,
  },
};

// Loading spinner animation
export const spinAnimation = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "linear",
    },
  },
};

// Pulse animation
export const pulseAnimation = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// Shake animation
export const shakeAnimation = {
  animate: {
    x: [0, -10, 10, -10, 10, 0],
    transition: {
      duration: 0.5,
    },
  },
};

// Reusable animated components
export const AnimatedDiv = motion.div;
export const AnimatedSpan = motion.span;
export const AnimatedButton = motion.button;
export const AnimatedLi = motion.li;
export const AnimatedUl = motion.ul;
export const AnimatedSection = motion.section;
export const AnimatedArticle = motion.article;
export const AnimatedNav = motion.nav;
export const AnimatedHeader = motion.header;
export const AnimatedFooter = motion.footer;
export const AnimatedMain = motion.main;
export const AnimatedAside = motion.aside;

