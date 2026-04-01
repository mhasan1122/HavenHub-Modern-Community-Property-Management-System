// src/Components/Modals/AddRoleModal.jsx
import React from "react";
import AddMemberRole from "../../Features/Members/OrganizationMemberForm/AddMemberRole";
import { RxCross1 } from "react-icons/rx";

const AddRoleModal = ({ isOpen, onClose, onRoleCreated }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4 sm:p-6">
      {/* Modal backdrop */}
      <div
        className="fixed inset-0 bg-gray-900 opacity-50"
        onClick={onClose}
      ></div>
      {/* Modal content */}
      <div className="relative z-10 w-full max-w-6xl bg-white rounded-xl shadow-lg p-3 sm:p-6 my-auto">
        <button
          className="absolute -top-[8px] -right-[8px] p-2 rounded-full bg-primary text-white shadow-md hover:bg-primary/90 transition z-20"
          onClick={onClose}
        >
          <RxCross1 />
        </button>

        <AddMemberRole onRoleCreated={onRoleCreated} onClose={onClose} />
        {/* <div className="flex justify-end ">
          <button
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded"
            onClick={onClose}
          >
            Cancel
          </button>
        </div> */}
      </div>
    </div>
  );
};

export default AddRoleModal;
