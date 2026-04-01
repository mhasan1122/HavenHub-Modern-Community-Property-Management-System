import { motion } from "framer-motion";
import PropTypes from "prop-types";
import { transitionFast, buttonTap } from "../../utils/animations";

/**
 * AnimatedTabs Component
 * A modern, animated tab navigation component with smooth transitions
 * 
 * @param {Array} tabs - Array of tab objects with { id, label } structure
 * @param {number|string} activeTab - Currently active tab id
 * @param {Function} onTabChange - Callback function when tab changes
 * @param {boolean} sticky - Whether tabs should be sticky on scroll
 * @param {string} className - Additional CSS classes
 */
const AnimatedTabs = ({
  tabs = [],
  activeTab,
  onTabChange,
  sticky = false,
  className = ""
}) => {
  if (!tabs || tabs.length === 0) {
    return null;
  }

  const baseClasses = "flex relative pt-0 pb-0 bg-white border-b border-gray-100 shadow-sm";
  const marginClass = className.includes("mb-") ? "" : "mb-8";
  const containerClasses = `
    ${sticky ? "sticky top-0 z-20" : ""} 
    ${marginClass} ${baseClasses} ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <div className={containerClasses} role="tablist">
      <div className="relative flex w-full flex-wrap sm:flex-nowrap gap-2 sm:gap-2 overflow-visible sm:overflow-x-auto scrollbar-hide py-2 sm:py-1.5">
        {tabs.map(({ id, label }) => (
          <motion.button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            whileHover={{ y: -2 }}
            whileTap={buttonTap}
            transition={transitionFast}
            className={`relative flex-[0_0_48%] sm:flex-1 sm:min-w-0 px-2 py-2 md:px-4 lg:px-6 md:py-3 text-[11px] sm:text-xs md:text-sm font-semibold transition-all duration-300 rounded-lg whitespace-normal sm:whitespace-nowrap ${activeTab === id
              ? "text-primary"
              : "text-gray-600 bg-gray-200 hover:text-primary hover:bg-gray-300"
              }`}
            onClick={() => onTabChange(id)}
          >
            {activeTab === id && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-primary/10 rounded-lg border-2 border-primary"
                initial={false}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                }}
              />
            )}
            <span className="relative z-10 truncate block">{label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

AnimatedTabs.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
  activeTab: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  onTabChange: PropTypes.func.isRequired,
  sticky: PropTypes.bool,
  className: PropTypes.string,
};

export default AnimatedTabs;

