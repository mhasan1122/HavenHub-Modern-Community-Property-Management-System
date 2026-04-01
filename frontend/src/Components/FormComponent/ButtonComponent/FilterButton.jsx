import PropTypes from "prop-types";
import { RiFilter3Fill } from "react-icons/ri";

const FilterButton = ({ active, onClick, children, className = "" }) => {
  const isIconOnly = !children;
  const paddingClass = isIconOnly ? "py-[14px] px-6" : "px-4 py-[11px]";
  const iconMarginClass = isIconOnly ? "" : "mr-2";
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center ${paddingClass} rounded-8 border transition-all duration-300 
        ${active ? "bg-primary border-primary text-white" : "bg-white border-primary text-primary"}
        ${className}
      `}
    >
      <RiFilter3Fill
        className={`${iconMarginClass} text-[18px] ${active ? "text-white" : "text-primary"}`}
        size={18}
      />
      {!isIconOnly && <span className="font-lg">{children}</span>}
    </button>
  );
};

FilterButton.propTypes = {
  active: PropTypes.bool,
  className: PropTypes.string,
  onClick: PropTypes.func,
  children: PropTypes.node
};

export default FilterButton;
