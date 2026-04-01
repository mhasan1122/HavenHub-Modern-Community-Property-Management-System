import React from "react";

const PageContainer = ({ children, className = "" }) => {
  return (
    <div className={`w-full max-w-full py-4 ${className}`}>{children}</div>
  );
};

export default PageContainer;
