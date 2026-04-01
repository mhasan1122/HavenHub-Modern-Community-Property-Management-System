import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  setPendingMemberData,
  setCreatedMember,
  clearMessage as clearOwnerMessage
} from "../../../../redux/slices/owner/ownerSlice";

const useMemberSubmit = (formData, validateForm, activeTab, onClose) => {
  const dispatch = useDispatch();
  const { message, error } = useSelector((state) => state.owner);
  const [showMessage, setShowMessage] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm(formData, activeTab)) return;

    // Instead of creating the member immediately, store the form data as pending
    // The member will be created when the owner is saved
    const cleaned = { ...formData };

    // Clean up preview fields
    ["photo", "nid_front", "nid_back"].forEach((key) => {
      if (!(cleaned[key] instanceof File)) {
        const previewKey =
          "preview" + key.charAt(0).toUpperCase() + key.slice(1);
        if (cleaned[previewKey]?.startsWith(import.meta.env.VITE_BASE_API)) {
          cleaned[key] = cleaned[previewKey].replace(import.meta.env.VITE_BASE_API, "");
        } else {
          cleaned[key] = "";
        }
      }
    });

    Object.keys(cleaned).forEach((key) => {
      if (key.startsWith("preview")) delete cleaned[key];
    });

    // Store pending member data instead of creating the member
    dispatch(setPendingMemberData(cleaned));
    
    // Set a temporary ID for the pending member (will be replaced with real ID after creation)
    const tempId = `pending_member_${Date.now()}`;
    dispatch(
      setCreatedMember({
        id: tempId,
        full_name: cleaned.full_name,
        isPending: true,
        pendingData: cleaned
      })
    );
    
    // Close the modal on success
    if (onClose) onClose();
  };

  // if the global slice error/message changes, we want the MessageBox to open too
  useEffect(() => {
    if (message || error) {
      setShowMessage(true);
    }
  }, [message, error]);

  const handleDismissMessage = () => {
    // clear both global message and local field errors
    dispatch(clearOwnerMessage());
    setFieldErrors({});
    setShowMessage(false);
  };

  return {
    handleSubmit,
    loading,
    showMessage,
    message,
    error,
    fieldErrors,
    handleDismissMessage
  };
};

export default useMemberSubmit;
