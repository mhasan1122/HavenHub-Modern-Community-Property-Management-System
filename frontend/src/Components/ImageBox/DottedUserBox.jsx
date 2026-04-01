import React from "react";
import { FaUser } from "react-icons/fa";

const DottedUserBox = ({ width = "304px", height = "250px", className = "" }) => {
  // Determine if it should be circular (when width and height are equal)
  // Extract numeric values for comparison
  const widthNum = typeof width === "string" ? parseInt(width) : width;
  const heightNum = typeof height === "string" ? parseInt(height) : height;
  const isCircular = widthNum === heightNum || width === height;
  
  // Use rounded-full if className contains it, otherwise use default logic
  const hasRoundedFull = className.includes("rounded-full");
  const roundedClass = hasRoundedFull ? "" : (isCircular ? "rounded-full" : "rounded-lg");
  
  return (
    <div
      className={`border border-dashed border-gray-400 ${roundedClass} flex items-center justify-center overflow-hidden bg-[#EAEAEA] ${className}`}
      style={{ width, height }}
    >
      <FaUser className="w-full h-full object-cover p-2 text-[#C2C2C2]" />
    </div>
  );
};

export default DottedUserBox;
