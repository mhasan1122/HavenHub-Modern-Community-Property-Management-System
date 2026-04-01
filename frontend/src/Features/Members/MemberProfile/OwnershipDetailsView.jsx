import React, { useEffect, useState } from "react";
import EditButton from "../../../Components/Buttons/EditButton";
import FilePreviewWithDownload from "../../TowersAndUnits/UnitDetails/components/FilePreviewWithDownload";
import DynamicLinkEditButton from "./DynamicLinkEditButton";
import Info from "../../../Components/Ui/Info";
import { checkPermission } from "../../../utils/permissionUtils";
// import FilePreviewWithDownload from "../../../Components/FilePreviewWithDownload";

const OwnershipDetailsView = ({ unit, editPermission, onEditClick }) => {
  const [hasEditPermission, setHasEditPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);

  // Check if user has CHANGE_OWNERSHIP permission (permission ID 17)
  useEffect(() => {
    const checkEditPermission = async () => {
      try {
        const permissionGranted = await checkPermission("org", 17);
        setHasEditPermission(permissionGranted);
      } catch (error) {
        console.error("Error checking edit permission:", error);
        setHasEditPermission(false);
      } finally {
        setLoadingPermission(false);
      }
    };
    checkEditPermission();
  }, []);

  return (
    <div className="border border-borderLight rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-textMedium">
          <span>Unit </span>
          {unit.unit_name}
        </h3>
        {!loadingPermission && hasEditPermission && (
          <DynamicLinkEditButton
            basePath="/unit/:unitid/change-owner"
            params={{
              unitid: unit?.unit,
            }}
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Info label="Ownership Date">
          {unit.date_of_ownership
            ? new Date(unit.date_of_ownership).toLocaleDateString()
            : "--"}
        </Info>

        <Info label="Ownership Percentage">
          {unit.ownership_percentage
            ? `${parseFloat(unit.ownership_percentage).toFixed(2)}%`
            : "--"}
        </Info>

        <Info label="Tower Name">
          {unit.tower?.tower_name || "--"}
        </Info>

        <Info label="Unit Name">
          {unit.unit_name || "--"}
        </Info>

        <Info label="Tower Number">
          {unit.tower?.tower_number || "--"}
        </Info>
      </div>

      {unit.owner_docs?.length > 0 && (
        <div className="mt-6 pt-6 border-t border-borderLight">
          <p className="text-sm font-medium text-textDark mb-4">
            Documents
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {unit.owner_docs.map((doc, index) => (
              <FilePreviewWithDownload
                key={index}
                filePath={doc.url}
                fileName={doc.name || `Document_${index + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnershipDetailsView;
