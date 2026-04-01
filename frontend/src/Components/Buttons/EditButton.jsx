import React from "react";
import { CiEdit } from "react-icons/ci";

const EditButton = ({ id, onClick, label = "Edit", className = "" }) => {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center py-1 px-2 rounded-md border border-gray-500 ${className}`}
    >
      <CiEdit className="w-5 h-5 mr-1 text-gray-700" style={{ strokeWidth: 1 }} />
      <span className="text-sm font-bold text-gray-700">{label}</span>
    </button>
  );
};

export default EditButton;
