import React, { useState, useEffect } from "react";
import { Div } from "Components/Ui/Div";
import ArrowHeading from "../../../Components/HeadingComponent/ArrowHeading";
import PageContainer from "../../../Components/Ui/PageContainer";

import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import TextInputComponent from "../../../Components/FormComponent/TextInputComponent";
import TextareaComponent from "../../../Components/FormComponent/TextareaComponent";
import {
  fetchPermissions,
  createRole,
  updateRole,
  clearMessages,
  fetchRoleDetails,
  toggleRoleStatus
} from "../../../redux/slices/roles/rolesSlice";
import SubmitButton from "../../../Components/FormComponent/ButtonComponent/SubmitButton";
import MessageBox from "../../../Components/MessageBox/MessageBox";
import ConfirmationMessageBox from "../../../Components/MessageBox/ConfirmationMessageBox";
import ErrorMessage from "../../../Components/MessageBox/ErrorMessage";
import { checkPermission } from "../../../utils/permissionUtils";
import CheckboxComponent from "../../../Components/FormComponent/CheckboxComponent";
import { PERMISSION_GROUPS } from "../../../constants/permissions";

const AddRole = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const {
    permissions,
    loading,
    error: backendError,
    successMessage,
    roleDetails
  } = useSelector((state) => state.role);
  const editMode = Boolean(id);

  const [formData, setFormData] = useState({
    role_name: "",
    role_description: "",
    permissions: []
  });
  const [errors, setErrors] = useState({ role_name: "" });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false); // ✅ NEW
  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);
  const [isFormChanged, setIsFormChanged] = useState(false);

  useEffect(() => {
    dispatch(clearMessages());
  }, [dispatch]);

  useEffect(() => {
    const fetchPermission = async () => {
      const permissionId = editMode ? 5 : 4;
      const permissionGranted = await checkPermission("org", permissionId);
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };
    fetchPermission();
    dispatch(fetchPermissions());
    if (editMode) dispatch(fetchRoleDetails(id));
  }, [dispatch, editMode, id]);

  useEffect(() => {
    if (editMode && roleDetails) {
      setFormData({
        role_name: roleDetails.role_name || "",
        role_description: roleDetails.role_description || "",
        permissions: roleDetails.selected_permissions || []
      });
    }
  }, [editMode, roleDetails]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));

    if (name === "role_name" && value.length > 25) {
      setErrors((prev) => ({
        ...prev,
        role_name: "Role name cannot exceed 25 characters"
      }));
    }
    if (name === "role_description" && value.length > 255) {
      setErrors((prev) => ({
        ...prev,
        role_description: "Role description cannot exceed 255 characters"
      }));
    }
  };

  const handleCheckboxChange = (e, permissionId) => {
    setFormData((prev) => ({
      ...prev,
      permissions: e.target.checked
        ? [...prev.permissions, permissionId]
        : prev.permissions.filter((id) => id !== permissionId)
    }));
  };

  const handleSelectAllChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      permissions: e.target.checked ? permissions.map((p) => p.id) : []
    }));
  };

  const handleUpdateConfirmed = () => {
    setShowConfirmation(false);
    dispatch(updateRole({ id, roleData: formData }))
      .unwrap()
      .catch((err) => {
        setErrors({
          role_name: err.role_name ? err.role_name[0] : "",
          role_description: err.role_description ? err.role_description[0] : ""
        });
      });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({ role_name: "", role_description: "" });

    const validationErrors = {};
    if (!formData.role_name.trim()) {
      validationErrors.role_name = "Role name is required";
    }
    if (formData.role_name.length > 25) {
      validationErrors.role_name = "Role name cannot exceed 25 characters";
    }
    if (formData.role_description.length > 255) {
      validationErrors.role_description =
        "Role description cannot exceed 255 characters";
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (editMode) {
      const noChanges =
        formData.role_name === roleDetails?.role_name &&
        formData.role_description === roleDetails?.role_description &&
        JSON.stringify([...formData.permissions].sort()) ===
        JSON.stringify([...(roleDetails?.selected_permissions || [])].sort());
      if (noChanges) return;
      setShowConfirmation(true);
    } else {
      dispatch(createRole(formData))
        .unwrap()
        .catch((err) => {
          if (err.role_name || err.role_description) {
            console.log("Backend Error:", err);
          }
        });
    }
  };

  const handleClearMessage = () => {
    dispatch(clearMessages());
    navigate(editMode ? `/roleProfile/${id}` : "/role-list");
  };

  const checkFormChanged = () => {
    if (!editMode) {
      return (
        formData.role_name.trim() !== "" ||
        formData.role_description.trim() !== "" ||
        formData.permissions.length > 0
      );
    } else {
      return (
        formData.role_name !== roleDetails?.role_name ||
        formData.role_description !== roleDetails?.role_description ||
        JSON.stringify([...formData.permissions].sort()) !==
        JSON.stringify([...(roleDetails?.selected_permissions || [])].sort())
      );
    }
  };

  useEffect(() => {
    setIsFormChanged(checkFormChanged());
  }, [formData, roleDetails, editMode]);

  // ✅ Show confirm modal for toggle
  const handleToggleStatus = () => {
    setShowStatusConfirm(true);
  };

  // ✅ Actual toggle only after confirm
  const handleConfirmToggleStatus = () => {
    setShowStatusConfirm(false);
    dispatch(toggleRoleStatus(id));
  };

  if (loadingPermission) return null;
  if (!hasPermission) navigate("/not-authorized");

  // const { is_active } = roleDetails;
  const is_active = editMode && roleDetails ? roleDetails.is_active : false;

  const shouldScroll = permissions.length > 6;
  const hasSelectedPermission = formData.permissions.length > 0;


  return (
    <PageContainer className="min-h-screen bg-surfaceMuted">
      {backendError && (
        <MessageBox
          type="error"
          error
          message={
            backendError.role_name?.[0] ||
            backendError.detail ||
            "Unable to save the role. Please try again."
          }
          clearMessage={() => dispatch(clearMessages())}
          onOk={() => dispatch(clearMessages())}
        />
      )}

      {successMessage && (
        <MessageBox
          message={successMessage}
          clearMessage={handleClearMessage}
          onOk={handleClearMessage}
        />
      )}

      {showConfirmation && (
        <ConfirmationMessageBox
          message="Are you sure you want to update this role?"
          onConfirm={handleUpdateConfirmed}
          onCancel={() => setShowConfirmation(false)}
        />
      )}

      {showStatusConfirm && (
        <ConfirmationMessageBox
          message={`Do you want to ${is_active ? "deactivate" : "activate"
            } this role?`}
          onConfirm={handleConfirmToggleStatus}
          onCancel={() => setShowStatusConfirm(false)}
        />
      )}

      <div className="flex-shrink-0 sticky top-0 z-20 mb-1.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surfaceMuted pt-0 pb-4 backdrop-blur">
        <div
          onClick={() => navigate(editMode ? `/roleProfile/${id}` : "/role-list")}
          className="inline-flex cursor-pointer items-center gap-2 sm:gap-3 text-[#0F172A] transition-colors hover:text-primary"
        >
          <ArrowHeading title={editMode ? "Edit Role" : "Add Role"} size="2xl" color="text-black" />
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {editMode && (
            <button
              type="button"
              onClick={handleToggleStatus}
              className={`px-4 py-2 text-sm sm:text-base font-semibold border-2 rounded-lg transition-colors whitespace-nowrap flex-shrink-0 w-full sm:w-auto ${is_active
                ? "bg-primary/10 border-primary text-primary hover:bg-primary/15"
                : "bg-error/10 border-error text-error hover:bg-error/15"
                }`}
            >
              {is_active ? "Active" : "Inactive"}
            </button>
          )}
          <div className="w-full sm:w-auto">
            <SubmitButton
              text={editMode ? "Update" : "Create"}
              loading={loading}
              disabled={!isFormChanged || loading || !hasSelectedPermission}
              onClick={handleSubmit}
              className="w-full sm:w-auto my-0 py-2.5 sm:py-2 text-sm sm:text-base font-medium"
              bgColor={
                !isFormChanged || loading || !hasSelectedPermission
                  ? "bg-white cursor-not-allowed"
                  : "bg-primary"
              }
              textColor={
                !isFormChanged || loading || !hasSelectedPermission
                  ? "text-primary"
                  : "text-white"
              }
            />
          </div>
        </div>
      </div>

      <div className="max-h-[calc(100vh-180px)] overflow-y-auto role-profile-scrollbar">
        <section className="mx-auto w-full  rounded-[32px] border border-borderLight bg-white px-8 py-10">
          <form onSubmit={handleSubmit}>
            <TextInputComponent
              name="role_name"
              label="Role Name *"
              placeholder="Write Role Name"
              value={formData.role_name}
              onChange={handleChange}
              required
              maxLength={25}
            />
            {errors.role_name && <ErrorMessage message={errors.role_name} />}

            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">Role Description</p>
              <TextareaComponent
                name="role_description"
                value={formData.role_description}
                onChange={handleChange}
                placeholder="Write Role Description"
                rows={5}
              />
              {errors.role_description && (
                <ErrorMessage message={errors.role_description} />
              )}
            </div>

            <div className="mt-6">
              <h2 className="text-[20px] font-semibold mb-4">Role Permissions</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Render permission groups with a helper function to avoid repetition */}
                {PERMISSION_GROUPS.map((group, index) => {
                  // Filter ONLY by IDs to prevent duplicate permissions appearing in multiple groups
                  let groupPerms = [];
                  if (group.ids && group.ids.length > 0) {
                    groupPerms = permissions.filter((p) =>
                      group.ids.some((id) => Number(id) === Number(p.id))
                    );
                  } else if (group.names && group.names.length > 0) {
                    // Fallback to name matching only if no IDs specified
                    groupPerms = permissions.filter((p) =>
                      group.names.includes(p.permission_name)
                    );
                  }

                  const groupChecked =
                    groupPerms.length > 0 &&
                    groupPerms.every((perm) =>
                      formData.permissions.includes(perm.id)
                    );
                  return (
                    <div key={`${group.title}-${index}`} className="p-2">
                      <h2 className="text-base font-semibold p-3 text-center bg-subprimary rounded-8 mb-2">
                        {group.title}
                      </h2>
                      <div className="p-4 rounded-10 bg-white border shadow">
                        <Div className="mb-2">
                          <CheckboxComponent
                            name={`select_all_${index}`}
                            label="Select All"
                            checked={groupChecked}
                            onChange={(e) => {
                              const groupIds = groupPerms.map((p) => p.id);
                              setFormData((prev) => ({
                                ...prev,
                                permissions: e.target.checked
                                  ? Array.from(new Set([...prev.permissions, ...groupIds]))
                                  : prev.permissions.filter((pid) => !groupIds.includes(pid))
                              }));
                            }}
                            value={`select_all_${index}`}
                          />
                        </Div>
                        <div className={shouldScroll ? "max-h-60 overflow-y-auto pr-2 role-profile-scrollbar" : ""}>
                          {groupPerms.map((perm) => (
                            <Div key={perm.id} className="mb-2">
                              <CheckboxComponent
                                name="permissions"
                                label={perm.permission_name}
                                checked={formData.permissions.includes(perm.id)}
                                onChange={(e) => handleCheckboxChange(e, perm.id)}
                                value={perm.id}
                              />
                            </Div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </form>
        </section>
      </div>
    </PageContainer>
  );
};

export default AddRole;
