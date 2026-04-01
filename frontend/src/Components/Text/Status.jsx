import React from "react";

const Status = ({ text, color = "primary" }) => {
  const colors = {
    primary: "bg-primary text-white",
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
    yellow: "bg-yellow-100 text-yellow-700",
    blue: "bg-error text-white",
    error: "bg-error text-white"
    // Add more colors as needed
  };

  return (
    <span
      className={`p-2 rounded-8  ${colors[color] || colors.primary}`}
    >
      {text}
    </span>
  );
};

export default Status;
