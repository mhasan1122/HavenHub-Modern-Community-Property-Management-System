import React from "react";

const DottedNidBox = ({ title}) => {
  return (
    <div
      className="border border-dashed border-gray-400 p-3 rounded-lg text-center flex flex-col items-center justify-center"
    >
      <h3 className="font-semibold ">{title}</h3>
      
    </div>
  );
};

export default DottedNidBox;
