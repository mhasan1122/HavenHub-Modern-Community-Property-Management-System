import React from "react";
import PropTypes from "prop-types";

/**
 * ActiveStatusButton - A reusable component for displaying active/inactive status buttons
 * Matches the styling from member profile pages with inverted design (border + text color, white background)
 * 
 * @param {boolean} isActive - Whether the status is active
 * @param {string} activeLabel - Label for active state (default: "Active")
 * @param {string} inactiveLabel - Label for inactive state (default: "Inactive")
 * @param {Function} onClick - Optional click handler
 * @param {boolean} disabled - Whether the button is disabled
 * @param {string} className - Additional CSS classes
 * @param {string} size - Size variant: "xs" (extra small), "sm" (small) or "default"
 */
const ActiveStatusButton = ({
  isActive,
  activeLabel = "Active",
  inactiveLabel = "Inactive",
  onClick,
  disabled = false,
  className = "",
  size = "default"
}) => {
  const sizeClasses = size === "xs"
    ? "py-0.5 px-1.5 text-[10px]"
    : size === "sm" 
    ? "py-0.5 px-1 text-xs" 
    : "py-1 px-3 text-base font-semibold";
  
  const borderClass = size === "xs" ? "border" : "border-2";
  
  const baseClasses = `inline-flex items-center justify-center text-center rounded-lg transition-colors cursor-pointer ${sizeClasses} ${className}`;
  
  const activeClasses = `${baseClasses} bg-primary/10 ${borderClass} border-primary text-primary hover:bg-primary/15`;
  const inactiveClasses = `${baseClasses} bg-error/10 ${borderClass} border-error text-error hover:bg-error/15`;

  const buttonClasses = isActive ? activeClasses : inactiveClasses;
  const label = isActive ? activeLabel : inactiveLabel;

  if (onClick) {
    return (
      <button
        className={buttonClasses}
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        {label}
      </button>
    );
  }

  return (
    <span className={buttonClasses}>
      {label}
    </span>
  );
};

ActiveStatusButton.propTypes = {
  isActive: PropTypes.bool.isRequired,
  activeLabel: PropTypes.string,
  inactiveLabel: PropTypes.string,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  size: PropTypes.oneOf(["xs", "sm", "default"])
};

export default ActiveStatusButton;

