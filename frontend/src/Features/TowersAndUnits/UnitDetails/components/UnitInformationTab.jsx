import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { unitDetails } from "../../../../redux/slices/units/unitSlice";
import EditButton from "../../../../Components/Buttons/EditButton";
import FilePreviewWithDownload from "./FilePreviewWithDownload";
import Info from "../../../../Components/Ui/Info";

const UnitInformationTab = ({ id }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { selectedUnitDetails } = useSelector((state) => state.unit);
  useEffect(() => {
    if (id) {
      dispatch(unitDetails(id));
    }
  }, [id, dispatch]);

  const formatValue = (value) =>
    value !== null && value !== undefined && value !== "" ? value : "---";

  const handleNavigate = () => {
    navigate(`/edit-unit-general/${id}`);
  };
  return (
    <div className="my-4 sm:my-6">
      <div className="border border-borderLight rounded-lg p-4 sm:p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-textDark">General Information</h3>
        <EditButton
          onClick={handleNavigate}
          className="flex items-center px-3 sm:px-4 py-2 border border-gray-300 rounded-md flex-shrink-0 w-full sm:w-auto justify-center sm:justify-start"
        >
          <img src="./edit-02.png" alt="Edit" className="w-4 h-4 mr-2" />
          <span className="text-sm text-gray-700">Edit</span>
        </EditButton>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 min-w-0">
        <div className="w-full lg:w-3/4 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div className="space-y-1">
              <Info label="Area">
                {formatValue(selectedUnitDetails?.area)} sq. ft.
              </Info>
              <Info label="Number of Bathrooms">
                {formatValue(selectedUnitDetails?.number_of_bathrooms)}
              </Info>
            </div>
            <div className="space-y-1">
              <Info label="Number of Rooms">
                {formatValue(selectedUnitDetails?.number_of_rooms)}
              </Info>
              <Info label="Number of Balconies">
                {formatValue(selectedUnitDetails?.number_of_balconies)}
              </Info>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-1/4 flex flex-col gap-2 min-w-0">
          {selectedUnitDetails?.docs?.length > 0 ? (
            selectedUnitDetails.docs.map((doc) => {
              const filePath = doc.unit_docs; // Should be a relative path
              return (
                <FilePreviewWithDownload key={doc.id} filePath={filePath} />
              );
            })
          ) : (
            <p className="text-sm text-gray-500">No documents available</p>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default UnitInformationTab;
