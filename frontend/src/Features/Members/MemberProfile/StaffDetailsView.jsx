import React from "react";
import Info from "../../../Components/Ui/Info";
import FilePreviewWithDownload from "../../TowersAndUnits/UnitDetails/components/FilePreviewWithDownload";
import EditButton from "../../../Components/Buttons/EditButton";
import { Link, useNavigate } from "react-router-dom";
import DynamicEditLink from "./DynamicLinkEditButton";

const StaffDetailsView = ({ unit_staff }) => {
  console.log(unit_staff, "unit_staff");

  return (
    <div className="border border-borderLight rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-textMedium">
          <span>Unit </span>
          {unit_staff?.unit_name || "N/A"}
        </h3>
          <DynamicEditLink
            basePath="/unit-staff-edit/:staffid/:staffstatus"
            params={{
              staffid: unit_staff?.id,
              staffstatus: unit_staff?.unit_staff_status
            }}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Info label="Tower Name">
            {unit_staff?.tower.tower_name || "N/A"}
          </Info>
          <Info label="Tower Number">
            {unit_staff?.tower.tower_number || "N/A"}
          </Info>
          <Info label="Type">Unit Staff</Info>
          <Info label="Status">
            {unit_staff?.unit_staff_status == true ? "Live-in" : "Part-time"}
          </Info>
        </div>
    </div>
  );
};

export default StaffDetailsView;
