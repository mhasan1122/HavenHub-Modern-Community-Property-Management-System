import React from "react";

export const Div = ({ className = "", children, ...props }) => {
  return (
    <div className={` ${className}`} {...props}>
      {children}
    </div>
  )
}