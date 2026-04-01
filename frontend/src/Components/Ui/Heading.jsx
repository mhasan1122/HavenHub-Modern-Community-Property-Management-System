import React from "react";

export const Heading = ({ level = 1, className = "", children, ...props }) => {
  const Tag = `h${level}`;
  return (
    <Tag className={` ${className}`} {...props}>
      {children}
    </Tag>
  )
}