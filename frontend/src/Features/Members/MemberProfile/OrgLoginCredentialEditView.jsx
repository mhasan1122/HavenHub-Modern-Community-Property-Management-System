import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import Info from "../../../Components/Ui/Info";
import DynamicEditLink from "./DynamicLinkEditButton";
import ActiveStatusButton from "../../../Components/Buttons/ActiveStatusButton";
// import ConfirmationMessageBox from "../../../Components/Ui/ConfirmationMessageBox"; // Make sure to import this
import {
  changeOrgMemberStatus,
  fetchMemberById
} from "../../../redux/slices/api/memberApi";
import { setActiveTabs } from "../../../redux/slices/memberSlice";
import ConfirmationMessageBox from "Components/MessageBox/ConfirmationMessageBox";
import MessageBox from "Components/MessageBox/MessageBox";
import { checkPermission } from "../../../utils/permissionUtils";

const OrgLoginCredentialEditView = () => {
  const dispatch = useDispatch();
  const statusLoading = useSelector((state) => state.member.statusLoading);
  const memberData = useSelector(
    (state) => state.member.selectedMember?.member
  );
  
  // State for confirmation modals
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  
  // State for permission check
  const [hasEditPermission, setHasEditPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);
  

  const handleStatusChange = (status) => {
    if (!memberData) return;
    dispatch(
      changeOrgMemberStatus({
        id: memberData?.id,
        status,
        member_type: "org"
      })
    ).then(() => {
      dispatch(fetchMemberById(memberData?.id));
    });
  };

  // Show confirmation dialog and cache pending status
  const showConfirmation = (status) => {
    setPendingStatus(status);
    setShowStatusConfirm(true);
  };

  // Handle confirmed status change
  const handleConfirmStatusChange = () => {
    if (pendingStatus !== null) {
      handleStatusChange(pendingStatus);
      setShowSuccessMessage(true); // show success message
    }
    setShowStatusConfirm(false);
  };

  // Check if user has EDIT_MEMBER permission (permission ID 2)
  useEffect(() => {
    const checkEditPermission = async () => {
      try {
        const permissionGranted = await checkPermission("org", 2);
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
    <div className="my-6">
      {/* Status Change Confirmation Modal */}
      {showStatusConfirm && (
        <ConfirmationMessageBox
          message={`Do you want to ${
            pendingStatus === 1 ? "activate" : "deactivate"
          } this login credential?`}
          onConfirm={handleConfirmStatusChange}
          onCancel={() => setShowStatusConfirm(false)}
        />
      )}
      {showSuccessMessage && (
              <MessageBox
                message="Status has been updated successfully"
                clearMessage={() => setShowSuccessMessage(false)}
                onOk={() => setShowSuccessMessage(false)}
              />
            )}

      <div className="border border-borderLight rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-textDark">Login Credential</h3>
        <div className="flex">
          {!loadingPermission && hasEditPermission && (
            <ActiveStatusButton
              isActive={memberData?.is_org_member == 1}
              activeLabel={statusLoading ? "Updating..." : "Active"}
              inactiveLabel={statusLoading ? "Updating..." : "Inactive"}
              onClick={() => showConfirmation(memberData?.is_org_member == 1 ? 0 : 1)}
              disabled={statusLoading}
              className="mx-2"
            />
          )}

          {memberData?.is_org_member == 1 && (
            <DynamicEditLink
              basePath="/login-credential-edit/:id"
              onClick={() => dispatch(setActiveTabs(2))}
              params={{
                id: memberData?.id
              }}
            />
          )}
        </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {memberData?.is_org_member == 1 ? (
            <div className="col-span-3">
              <div className="py-2">
                <Info label="User Name">{memberData?.username || "--"}</Info>
              </div>
              <div className="py-2">
                <Info label="E-mail/Phone number">
                  {memberData?.login_email || memberData?.login_contact || "--"}
                </Info>
              </div>
            </div>
          ) : (
            <div className="col-span-3">
              <div className="py-2">
                <Info label="User Name">{"--"}</Info>
              </div>
              <div className="py-2">
                <Info label="E-mail/Phone number">{"--"}</Info>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrgLoginCredentialEditView;