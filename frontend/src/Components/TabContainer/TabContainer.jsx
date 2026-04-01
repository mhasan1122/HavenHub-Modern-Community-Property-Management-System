import React from "react";
import PropTypes from "prop-types";

/**
 * TabContainer - A reusable component for tab navigation and content rendering
 * 
 * @param {Array} tabs - Array of tab objects with { id, name, content }
 * @param {number} activeTab - Currently active tab ID
 * @param {Function} onTabChange - Callback function when tab changes
 * @param {string} className - Additional CSS classes for the container
 */
const TabContainer = ({ tabs, activeTab, onTabChange, className = "" }) => {
  return (
    <div className={`flex flex-col min-w-0 ${className}`}>
      {/* Tab Navigation */}
      <div
        className="sticky top-0 z-10 mb-6 flex rounded-none overflow-hidden bg-white -mx-6 px-6 pb-2 pt-2"
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 min-w-0 rounded-none px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? "border border-primary bg-primaryTransparent text-black"
                : "bg-primaryTransparent text-textDark hover:text-primary"
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-w-0">
        {tabs.find((tab) => tab.id === activeTab)?.content}
      </div>
    </div>
  );
};

TabContainer.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      name: PropTypes.string.isRequired,
      content: PropTypes.node.isRequired
    })
  ).isRequired,
  activeTab: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  onTabChange: PropTypes.func.isRequired,
  className: PropTypes.string
};

export default TabContainer;

