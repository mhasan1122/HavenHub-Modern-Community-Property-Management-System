import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { unitDetails } from "../../../../redux/slices/units/unitSlice";
import EditButton from "../../../../Components/Buttons/EditButton";
import Info from "../../../../Components/Ui/Info";
import { FaInfoCircle } from "react-icons/fa";
import { HiDocumentText } from "react-icons/hi";

const UnitContactsTab = ({ id }) => {
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

  const handleNavigatePrimary = () => {
    navigate(`/edit-unit-primary-contact/${id}`);
  };

  const handleNavigateSecondary = () => {
    navigate(`/edit-unit-secondary-contact/${id}`);
  };

  return (
    <div className="my-4 sm:my-6">
      {/* Information Banner */}
      <div className="mb-6 p-4 bg-[#E6F7F6] border border-[#3C9D9B] rounded-lg flex items-start gap-3">
        <FaInfoCircle className="text-[#3C9D9B] text-xl mt-0.5 flex-shrink-0" />
        <p className="text-sm text-gray-700 leading-relaxed">
          All unit members (owners, residents, and staff) have mobile app access. They can all view bills and make payments through Community Connect. The primary contact is simply the person to whom service fee bills will be addressed.
        </p>
      </div>

      {/* Primary Contact Section */}
      <div className="border border-borderLight rounded-lg p-4 sm:p-6 bg-white shadow-sm hover:shadow-md transition-shadow mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base sm:text-lg font-semibold text-textDark">
              Primary Contact
            </h3>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary text-white">
              Bill Recipient
            </span>
          </div>
          <EditButton
            onClick={handleNavigatePrimary}
            className="flex items-center px-3 sm:px-4 py-2 border border-gray-300 rounded-md flex-shrink-0 w-full sm:w-auto justify-center sm:justify-start"
          >
            <img src="./edit-02.png" alt="Edit" className="w-4 h-4 mr-2" />
            <span className="text-sm text-gray-700">Edit</span>
          </EditButton>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          The person to whom service fee bills and invoices will be addressed. Their name and information will appear on billing documents under "Billed To".
        </p>

        {/* Billing Address Info Box */}
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <HiDocumentText className="text-green-600 text-xl mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-green-800 mb-1">
                BILLING ADDRESS
              </h4>
              <p className="text-sm text-green-700">
                Service fee bills will be addressed to this contact. This does not restrict who can view bills or make payments.
              </p>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-1">
            <Info label="Name">
              {formatValue(selectedUnitDetails?.primary_name)}
            </Info>
            <Info label="Number">
              {formatValue(selectedUnitDetails?.primary_number)}
            </Info>
          </div>
          <div className="space-y-1">
            <Info label="Relationship">
              {formatValue(selectedUnitDetails?.primary_relationship)}
            </Info>
            <Info label="Email">
              {formatValue(selectedUnitDetails?.primary_email)}
            </Info>
          </div>
        </div>
      </div>

      {/* Secondary Contact Section */}
      <div className="border border-borderLight rounded-lg p-4 sm:p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base sm:text-lg font-semibold text-textDark">
              Secondary Contact
            </h3>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500 text-white">
              Optional
            </span>
          </div>
          <EditButton
            onClick={handleNavigateSecondary}
            className="flex items-center px-3 sm:px-4 py-2 border border-gray-300 rounded-md flex-shrink-0 w-full sm:w-auto justify-center sm:justify-start"
          >
            <img src="./edit-02.png" alt="Edit" className="w-4 h-4 mr-2" />
            <span className="text-sm text-gray-700">Edit</span>
          </EditButton>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          An optional additional contact person for this unit. This is for record-keeping purposes only and has no special permissions.
        </p>

        {/* Contact Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-1">
            <Info label="Name">
              {formatValue(selectedUnitDetails?.secondary_name)}
            </Info>
            <Info label="Number">
              {formatValue(selectedUnitDetails?.secondary_number)}
            </Info>
          </div>
          <div className="space-y-1">
            <Info label="Relationship">
              {formatValue(selectedUnitDetails?.secondary_relationship)}
            </Info>
            <Info label="Email">
              {formatValue(selectedUnitDetails?.secondary_email)}
            </Info>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnitContactsTab;
