import { BiArrowBack } from "react-icons/bi";

const ArrowHeading = ({
  title = "Back",
  onNext = () => { },
  size = "base",
  color = "text-primary",
  fontWeight = "medium"
}) => {
  const sizeClasses = {
    sm: "text-sm",
    md: "text-md",
    lg: "text-lg",
    xl: "text-xl",
    "2xl": "text-lg md:text-2xl"
  };

  return (
    <div
      onClick={onNext}
      className={`inline-flex items-center font-black	cursor-pointer font-${fontWeight} ${sizeClasses[size]} ${color}`}
    >
      <BiArrowBack className={`mr-2 ${color}`} />
      {title}
    </div>
  );
};

export default ArrowHeading;
