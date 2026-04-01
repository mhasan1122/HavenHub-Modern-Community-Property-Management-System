import React from "react";

export const Paragraph = ({ className = "", children, ...props }) => {
  return (
    <p className={`text-base font-medium  pb-1 ${className}`} {...props}>
      {children}
    </p>
  )
}
