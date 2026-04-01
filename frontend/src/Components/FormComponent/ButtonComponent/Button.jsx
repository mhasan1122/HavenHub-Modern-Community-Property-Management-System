// import React from "react";

// //  Created By Firoj Hasan
// const Button = ({
//   size,
//   variant,
//   children,
//   onClick,
//   icon: Icon,
//   iconPosition = "left",
//   disabled  // Accept the disabled prop
// }) => {
//   let sizeClass;
//   let variantClass;

//   // Define size classes
//   switch (size) {
//     case "small":
//       sizeClass = "py-[6px] px-5 text-sm flex items-center";
//       break;
//     case "medium":
//       sizeClass = "py-2 px-6 w-full text-base";
//       break;
//     case "large":
//       sizeClass = "py-3 px-6  text-lg";
//       break;
//     case "xl":
//       sizeClass = "py-3 px-6  text-base";
//       break;
//     case "active":
//       sizeClass = "py-1 px-1 text-sm";
//       break;
//     default:
//       sizeClass = "py-3 px-6 text-base";
//   }

//   // Define variant classes
//   switch (variant) {
//     case "transparent":
//       variantClass =
//         "bg-transparent text-primary border border-[#3D9D9B]";
//       break;
//     case "black":
//       variantClass =
//         "bg-transparent text-[black] border border-[#0000004D]";
//       break;
//     case "red":
//       variantClass = "bg-[red] text-[white]";
//       break;
//     case "filter":
//       variantClass =
//         "bg-transparent text-primary border border-gray-200";
//       break;
//     case "download":
//       variantClass =
//         "bg-transparent text-primary border border-primary";
//       break;
//     default:
//       variantClass = "bg-primary text-white hover:bg-[#348785]";
//   }

//   // Optionally, add a disabled style if needed
//   const disabledClass = disabled ? "opacity-50 cursor-not-allowed" : "";

//   return (
//     <button
//       type="button"
//       disabled={disabled}
//       className={`rounded-8 ${sizeClass} ${variantClass} ${disabledClass} transition-all duration-300`}
//       onClick={onClick}
//     >
//       <span className="flex items-center ">
//         {Icon && iconPosition === "left" && <Icon className="mr-2 h-full" />}
//         {children}
//         {Icon && iconPosition === "right" && <Icon className="ml-2" />}
//       </span>
//     </button>

//   );
// };

// export default Button;
import React from "react";
import { Tooltip } from "react-tooltip"; // Make sure to install react-tooltip

const Button = ({
  size,
  variant,
  children,
  onClick,
  icon: Icon,
  iconPosition = "left",
  disabled,
  iconSize = "medium",
  tooltip,
  tooltipId,
  className = "",
}) => {
  let sizeClass;
  let variantClass;

  // Define size classes
  switch (size) {
    case "sm":
      sizeClass = "py-[3px] px-3 text-sm";
      break;
    case "small":
      sizeClass = "py-[6px] px-5 text-sm";
      break;
    case "medium":
      sizeClass = "py-2 px-6 w-full text-base";
      break;
    case "large":
      sizeClass = "py-[14px] px-6 text-base";
      break;
    case "xl":
      sizeClass = "py-[9px] px-6 text-lg";
      break;
    case "active":
      sizeClass = "py-1 px-1 text-sm";
      break;
    default:
      sizeClass = "py-3 px-6 text-base";
  }

  // Define variant classes
  switch (variant) {
    case "transparent":
      variantClass = "bg-transparent text-primary border border-[#3D9D9B]";
      break;
    case "black":
      variantClass = "bg-transparent text-[black] border border-[#0000004D]";
      break;
    case "red":
      variantClass = "bg-error text-[white]";
      break;
    case "filter":
      variantClass = "bg-stroke text-primary border border-primary hover:bg-white hover:shadow-ring-primary focus:bg-white focus:shadow-ring-primary transition-all duration-200";
      break;
    case "download":
      variantClass = "bg-transparent text-primary border border-primary";
      break;
    default:
      variantClass = "bg-primary text-white hover:bg-[#348785]";
  }

  // Define icon size classes
  const getIconSizeClass = () => {
    switch (iconSize) {
      case "small":
        return "text-[18px] ";
      case "medium":
        return "text-[18px] ";
      case "xl":
        return "text-[24px] ";
      case "large":
        return "w-6 h-6";
      default:
        return "w-5 h-5";
    }
  };

  const disabledClass = disabled ? "opacity-50 cursor-not-allowed" : "";
  const hasText = Boolean(children);
  const iconOnlyClass = !hasText ? "justify-center" : "";

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        className={`rounded-8 ${sizeClass} ${variantClass} ${disabledClass} transition-all duration-300 flex items-center ${iconOnlyClass} ${className}`}
        onClick={onClick}
        data-tooltip-id={tooltip ? tooltipId : undefined} // Only set if tooltip exists
        data-tooltip-content={tooltip}
      >
        {Icon && iconPosition === "left" && (
          <Icon
            className={`${hasText ? "mr-2 bold" : ""} ${getIconSizeClass()}`}
          />
        )}
        {children}
        {Icon && iconPosition === "right" && (
          <Icon
            className={`${hasText ? "ml-2 bold" : ""} ${getIconSizeClass()}`}
          />
        )}
      </button>
      {tooltip && (
        <Tooltip
          id={tooltipId}
          place="top"
          effect="solid"
          className="!z-50 !bg-primary !border !border-primary !text-white"
        />
      )}
    </>
  );
};

export default Button;
