import React from "react";
import user1 from "../../assets/user/user.png";

const BASE_URL = import.meta.env.VITE_BASE_API || "http://127.0.0.1:8000";

const UserThumbnail = ({ photoUrl }) => {
  return (
    <div className=" flex items-center justify-center rounded-full bg-gray-200 overflow-hidden">
      <img
        src={photoUrl ? `${BASE_URL}${photoUrl}` : user1}
        alt="User"
        onError={(e) => {
          e.target.src = user1;
        }}
        className="w-6 h-6 object-contain"
      />
    </div>
  );
};

export default UserThumbnail;
