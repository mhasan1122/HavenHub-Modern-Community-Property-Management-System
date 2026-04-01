import React, { useState, useEffect } from "react";
import Info from "../../../Components/Ui/Info";
import { Link } from "react-router-dom";
import edit2 from "../../../assets/edit-02.png";
import DynamicEditLink from "./DynamicLinkEditButton";
import ActiveStatusButton from "../../../Components/Buttons/ActiveStatusButton";
import {
  changeOrgMemberStatus,
  fetchMemberById
} from "../../../redux/slices/api/memberApi";
import { useDispatch, useSelector } from "react-redux";
import { setActiveTabs } from "../../../redux/slices/memberSlice";
import DynamicLinkEditButton from "./DynamicLinkEditButton";
import ConfirmationMessageBox from "Components/MessageBox/ConfirmationMessageBox";
import MessageBox from "Components/MessageBox/MessageBox";
import { checkPermission } from "../../../utils/permissionUtils";

const ComLoginCredentialEditView = ({ selectedMember }) => {
  const dispatch = useDispatch();
  const statusLoading = useSelector((state) => state.member.statusLoading);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const memberData = useSelector(
    (state) => state.member.selectedMember?.member
  );
  const [pendingStatus, setPendingStatus] = useState(null);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  
  // State for permission check
  const [hasEditPermission, setHasEditPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);

  const handleStatusChange = (status) => {
    if (!memberData) return;
    dispatch(
      changeOrgMemberStatus({
        id: memberData.id,
        status,
        member_type: "comm"
      })
    ).then(() => {
      dispatch(fetchMemberById(memberData.id));
    });
  };

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
        const permissionGranted = await checkPermission("comm", 2);
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

  const member = selectedMember.member;
  return (
    <div className="my-6">
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
        <div className="flex justify-between ">
          {!loadingPermission && hasEditPermission && (
            <ActiveStatusButton
              isActive={member?.is_comm_member == 1}
              activeLabel={statusLoading ? "Updating..." : "Active"}
              inactiveLabel={statusLoading ? "Updating..." : "Inactive"}
              onClick={() => showConfirmation(member?.is_comm_member == 1 ? 0 : 1)}
              disabled={statusLoading}
              className="mx-2"
            />
          )}
          {/* <DynamicEditLink
              basePath="/login-credential-edit/:id"
              id={member?.id}
              onClick={() => dispatch(setActiveTabs(3))}
            /> */}
          {member?.is_comm_member == 1 && (
            <DynamicLinkEditButton
              basePath="/login-credential-edit/:id"
              onClick={() => dispatch(setActiveTabs(3))}
              params={{
                id: member?.id
              }}
            />
          )}
        </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
        {member?.is_comm_member == 1 ? (
          <div className="col-span-3">
            <div className="py-2">
              <Info label="User Name">{member?.username || "--"}</Info>
            </div>
            <div className="py-2">
              <Info label="E-mail/Phone number">
                {member?.login_email || member?.login_contact || "--"}
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

export default ComLoginCredentialEditView;
