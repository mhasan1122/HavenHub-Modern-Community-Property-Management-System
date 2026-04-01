import React from "react";
import Info from "../../../Components/Ui/Info";
import FilePreviewWithDownload from "../../TowersAndUnits/UnitDetails/components/FilePreviewWithDownload";
import EditButton from "../../../Components/Buttons/EditButton";
import { Link, useNavigate } from "react-router-dom";
import DynamicEditLink from "./DynamicLinkEditButton";
// import FilePreviewWithDownload from "../../UnitDetails/components/FilePreviewWithDownload";

// Normalize the member type so tenants show as "Resident (Tenant)"
// For residents, we prioritize is_resident_or_tenant over organizational member_type
const formatMemberType = (residentData = {}) => {
  const typeMap = {
    owner: "Owner",
    resident: "Resident",
    resident_tenant: "Resident (Tenant)",
    tenant: "Resident (Tenant)",
    staff: "Staff"
  };

  // PRIORITY 1: Use is_resident_or_tenant boolean (resident-specific field)
  // This is the most reliable indicator for resident/tenant status
  if (residentData.is_resident_or_tenant !== undefined && residentData.is_resident_or_tenant !== null) {
    if (residentData.is_resident_or_tenant === false || residentData.is_resident_or_tenant === 0) {
      return "Resident (Tenant)";
    }
    if (residentData.is_resident_or_tenant === true || residentData.is_resident_or_tenant === 1) {
      return "Resident";
    }
  }

  // PRIORITY 2: Check for member_type in residentData directly (if it's a valid resident type)
  if (residentData.member_type && typeMap[residentData.member_type]) {
    return typeMap[residentData.member_type];
  }

  // PRIORITY 3: Check for member_type in nested member object (only if valid resident type)
  if (residentData.member?.member_type) {
    const memberType = residentData.member.member_type;
    if (typeMap[memberType]) {
      return typeMap[memberType];
    }
  }

  // PRIORITY 4: Check for member_type_name in nested member object (only if valid resident type)
  // DO NOT return arbitrary member_type_name values like "Management" - only return if it's a valid resident type
  if (residentData.member?.member_type_name) {
    const memberTypeName = residentData.member.member_type_name.toLowerCase();
    if (typeMap[memberTypeName]) {
      return typeMap[memberTypeName];
    }
    // Don't return arbitrary member_type_name - it might be organizational (e.g., "Management")
    // Instead, fall through to default
  }

  return "—";
};

const ResidentDetailsView = ({ residentData }) => {
  const navigate = useNavigate();

  console.log("residentData?.idresidentData?.id", residentData);
  console.log("Move-in/Move-out dates:", {
    move_in_date: residentData?.move_in_date,
    move_out_date: residentData?.move_out_date,
    is_active: residentData?.is_active
  });
  return (
    <div className="border border-borderLight rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-textMedium">
          <span>Unit </span>
          {residentData?.unit_name || "N/A"}
        </h3>
        <DynamicEditLink
          basePath="/resident_info_edit/:unitid/:residentid"
          params={{
            unitid: residentData?.unit,
            residentid: residentData?.id
          }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-3">
          <Info label="Member Type">{formatMemberType(residentData)}</Info>
          <Info label="Unit Name">{residentData?.unit_name || "N/A"}</Info>
          <Info label="Unit Rent Fee">
            {residentData?.unit_rent_fee
              ? `${residentData.unit_rent_fee}`
              : "N/A"}
          </Info>
          <Info label="Notice Period">
            {residentData?.notice_period
              ? `${residentData.notice_period} month(s)`
              : "N/A"}
          </Info>
        </div>

        <div className="space-y-3">
          <Info label="Tower Name">
            {residentData?.tower?.tower_name || "N/A"}
          </Info>
          <Info label="Tower Number">
            {residentData?.tower?.tower_number || "N/A"}
          </Info>
          <Info label="Advance Payment">
            {residentData?.advance_payment
              ? `${residentData.advance_payment}`
              : "N/A"}
          </Info>
          <Info label="Move-In Date">
            {(() => {
              const moveInDate = residentData?.move_in_date;
              if (!moveInDate) return "N/A";
              try {
                const date = new Date(moveInDate);
                if (isNaN(date.getTime())) return "N/A";
                return date.toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });
              } catch (e) {
                return "N/A";
              }
            })()}
          </Info>
          <Info label="Move-Out Date">
            {(() => {
              if (residentData?.is_active) return "Active";
              const moveOutDate = residentData?.move_out_date;
              if (!moveOutDate) return "N/A";
              try {
                const date = new Date(moveOutDate);
                if (isNaN(date.getTime())) return "N/A";
                return date.toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });
              } catch (e) {
                return "N/A";
              }
            })()}
          </Info>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-normal text-gray-700 tracking-wide mb-0.5">
            Resident Docs
          </p>
          <div className="flex flex-row gap-2 overflow-x-auto">
            {residentData?.resident_docs?.length > 0 ? (
              residentData.resident_docs.map((doc, index) => (
                <FilePreviewWithDownload
                  key={index}
                  filePath={doc.rental_docs}
                  fileName={`Document_${index + 1}`}
                />
              ))
            ) : (
              <p className="text-sm text-textMedium">No documents available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResidentDetailsView;
