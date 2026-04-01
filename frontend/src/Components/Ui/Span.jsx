import React from "react";

export const Span = ({ className = "", children, ...props }) => {
  return (
    <span className={`inline-block ${className}`} {...props}>
      {children}
    </span>
  )
}

