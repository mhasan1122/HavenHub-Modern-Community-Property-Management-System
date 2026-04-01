import React from "react";
import { FaEye } from "react-icons/fa";
import { Link } from "react-router-dom";

const ViewButton = ({ url }) => {
  return (
    <div className="flex justify-center items-center">
      <Link to={url}>
        <FaEye className=" w-[25px] h-[20px] text-primary" />
      </Link>
    </div>
  );
};

export default ViewButton;
