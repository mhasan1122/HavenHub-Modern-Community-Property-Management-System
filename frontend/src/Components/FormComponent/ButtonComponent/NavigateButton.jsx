import PropTypes from "prop-types";

const NavigateButton = ({
    children,
    size = "small",
    className = "",
    icon: Icon, // Accepts an icon component
    iconPosition = "left", // 'left' or 'right'
    ...props
}) => {
    const sizeClasses = {
        small: "py-2 px-3 text-sm",
        medium: "py-2 px-[8px] text-base",
        large: "py-3 px-5 text-lg",
    };

    return (
        <button
            type="button" // Ensures the button is not of type "submit"
            className={`flex items-center justify-center py-4 rounded ${sizeClasses[size]} ${className}`}
            {...props}
        >
            {Icon && iconPosition === "left" && <Icon className="mr-2" />}
            {children}
            {Icon && iconPosition === "right" && <Icon className="ml-2" />}
        </button>
    );
};

NavigateButton.propTypes = {
    children: PropTypes.node.isRequired,
    size: PropTypes.oneOf(["small", "medium", "large"]),
    className: PropTypes.string,
    icon: PropTypes.elementType,
    iconPosition: PropTypes.oneOf(["left", "right"]),
};

export default NavigateButton;
