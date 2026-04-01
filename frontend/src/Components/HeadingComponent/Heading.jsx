const Heading = ({ title, size = "base", color = "text-primary" }) => {
  const sizeClasses = {
    sm: "text-sm",
    md: "text-md",
    lg: "text-lg",
    xl: "text-xl",
    "2xl": "text-2xl"
  };

  return (
    <h3 className={`font-semibold ${sizeClasses[size]} ${color}`}>{title}</h3>
  );
};

export default Heading;
