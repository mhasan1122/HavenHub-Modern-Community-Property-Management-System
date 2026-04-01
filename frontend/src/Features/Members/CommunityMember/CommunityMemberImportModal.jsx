import React, { useState, useEffect } from "react";
import { FiX, FiUser, FiUsers, FiBriefcase } from "react-icons/fi";
import OwnerExcelUploader from "../../../pages/OwnerExcelUploader";
import ResidentExcelImporter from "../../TowersAndUnits/Resident/Components/ResidentExcelImporter";
import UnitStaffExcelUploader from "../../TowersAndUnits/UnitStaff/UnitStaffExcelUploader";
import { useDispatch } from "react-redux";
import { fetchCommMembers } from "../../../redux/slices/commMember/commMemberSlice";

const CommunityMemberImportModal = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState(1);

  // Refresh data when modal closes (in case uploads happened)
  useEffect(() => {
    if (!isOpen) {
      // Small delay to ensure any upload operations have completed
      const timer = setTimeout(() => {
        // Refresh community member list after upload
        dispatch(fetchCommMembers({}));
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, dispatch]);

  if (!isOpen) return null;

  const tabs = [
    {
      id: 1,
      name: "Unit Owner",
      icon: FiUser,
      content: (
        <OwnerExcelUploader
          onUploadSuccess={() => {
            dispatch(fetchCommMembers({}));
            onClose();
          }}
        />
      )
    },
    {
      id: 2,
      name: "Residents",
      icon: FiUsers,
      content: (
        <ResidentExcelImporter
          onUploadSuccess={() => {
            dispatch(fetchCommMembers({}));
            onClose();
          }}
        />
      )
    },
    {
      id: 3,
      name: "Unit Staff",
      icon: FiBriefcase,
      content: (
        <UnitStaffExcelUploader
          onUploadSuccess={() => {
            dispatch(fetchCommMembers({}));
            onClose();
          }}
        />
      )
    }
  ];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm transition-opacity duration-300"
      onClick={(e) => {
        // Prevent focus from moving when clicking backdrop
        if (e.target === e.currentTarget) {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-[90vh] sm:max-w-xl md:max-w-2xl lg:max-w-4xl transform transition-all duration-300 ease-out max-h-[90vh] flex flex-col">
        {/* Modal Box */}
        <div className="bg-white w-full overflow-hidden rounded-[27px] shadow-2xl relative z-2 h-full flex flex-col transform transition-all duration-300">
          {/* Header */}
          <div className="flex justify-between items-center px-8 pt-8 pb-6 border-b border-gray-200 bg-gradient-to-r from-white to-subprimary/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <FiUsers className="text-primary" size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Import Data</h2>
                <p className="text-sm text-gray-500 mt-0.5">Upload Excel files for community member data</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white hover:bg-primaryDark transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-110"
              aria-label="Close modal"
            >
              <FiX size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex px-6 border-b border-gray-200 bg-white">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-4 px-4 font-semibold text-center transition-all duration-200 relative group ${
                    isActive
                      ? "text-primary"
                      : "text-gray-600 hover:text-primary"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2 relative">
                    <Icon 
                      size={18} 
                      className={`transition-all duration-200 ${
                        isActive 
                          ? "text-primary scale-110" 
                          : "text-gray-500 group-hover:text-primary group-hover:scale-105"
                      }`}
                    />
                    <span className={`transition-all duration-200 ${
                      isActive ? "font-bold" : "font-semibold"
                    }`}>
                      {tab.name}
                    </span>
                    {/* Active indicator */}
                    <div className={`absolute -bottom-4 left-0 right-0 h-1 bg-primary rounded-t-full transition-all duration-200 ${
                      isActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0 group-hover:opacity-30 group-hover:scale-x-75"
                    }`} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="overflow-y-auto flex-1 bg-gray-50/50 min-h-0">
            <div className="transition-opacity duration-200 h-full">
              {tabs.find((tab) => tab.id === activeTab)?.content}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityMemberImportModal;
