import React, { useEffect } from "react";
import { FiX, FiUser, FiUsers, FiBriefcase } from "react-icons/fi";
import OwnerExcelUploader from "../../../../pages/OwnerExcelUploader";
import ResidentExcelImporter from "../../Resident/Components/ResidentExcelImporter";
import UnitStaffExcelUploader from "../../UnitStaff/UnitStaffExcelUploader";
import { useDispatch } from "react-redux";
import { fetchOwnerList } from "../../../../redux/slices/owner/ownerSlice";
import { fetchResidents } from "../../../../redux/slices/residents/residentSlice";
import { fetchUnitStaff } from "../../../../redux/slices/unitStaff/unitStaffSlice";

const ImportDataModal = ({ isOpen, onClose, unitId, type }) => {
  const dispatch = useDispatch();

  // Refresh data when modal closes (in case uploads happened)
  useEffect(() => {
    if (!isOpen && unitId) {
      // Small delay to ensure any upload operations have completed
      const timer = setTimeout(() => {
        if (type === "owner") {
          dispatch(fetchOwnerList(unitId));
        } else if (type === "resident") {
          dispatch(fetchResidents(unitId));
        } else if (type === "staff") {
          dispatch(fetchUnitStaff(unitId));
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, unitId, type, dispatch]);

  if (!isOpen) return null;

  // Get title and icon based on type
  const getTypeInfo = () => {
    switch (type) {
      case "owner":
        return {
          title: "Import Owner Data",
          subtitle: "Upload Excel file for unit owner data",
          icon: FiUser
        };
      case "resident":
        return {
          title: "Import Resident Data",
          subtitle: "Upload Excel file for resident data",
          icon: FiUsers
        };
      case "staff":
        return {
          title: "Import Unit Staff Data",
          subtitle: "Upload Excel file for unit staff data",
          icon: FiBriefcase
        };
      default:
        return {
          title: "Import Data",
          subtitle: "Upload Excel files for unit data",
          icon: FiUsers
        };
    }
  };

  const typeInfo = getTypeInfo();
  const Icon = typeInfo.icon;

  // Get the appropriate uploader component
  const getUploader = () => {
    switch (type) {
      case "owner":
        return (
          <OwnerExcelUploader
            onUploadSuccess={() => {
              if (unitId) {
                dispatch(fetchOwnerList(unitId));
              }
              onClose();
            }}
          />
        );
      case "resident":
        return (
          <ResidentExcelImporter
            onUploadSuccess={() => {
              if (unitId) {
                dispatch(fetchResidents(unitId));
              }
              onClose();
            }}
          />
        );
      case "staff":
        return (
          <UnitStaffExcelUploader
            onUploadSuccess={() => {
              if (unitId) {
                dispatch(fetchUnitStaff(unitId));
              }
              onClose();
            }}
          />
        );
      default:
        return null;
    }
  };

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
                <Icon className="text-primary" size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{typeInfo.title}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{typeInfo.subtitle}</p>
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

          {/* Content */}
          <div className="overflow-y-auto flex-1 bg-gray-50/50 min-h-0">
            <div className="transition-opacity duration-200 h-full">
              {getUploader()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportDataModal;

