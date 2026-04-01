const TabButton = ({
  label,
  tabIndex,
  handleTabChange,
  color = "bg-primary",
  textColor = "text-white",
  fullWidth = true,
  disable=false
}) => {
  return (
    <button
      onClick={() => {
        if (!disable) {
          handleTabChange(tabIndex);
        }
        // No console.log here
        // console.log('sdfasf',disable)
      }}
      className={`
        ${color} ${textColor}
        py-2 mt-3 px-4
        border border-primary
        ${fullWidth ? "w-full" : ""}
        rounded-lg
        transition-colors duration-200
        ${disable ? "opacity-50 cursor-not-allowed" : "hover:bg-primaryDark"}
      `}
      disabled={disable}
    >
      {label}
    </button>
  );
};

export default TabButton;
