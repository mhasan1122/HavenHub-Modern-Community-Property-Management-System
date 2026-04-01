import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import TextInputComponent from "../../../Components/FormComponent/TextInputComponent";
import TextareaComponent from "../../../Components/FormComponent/TextareaComponent";
import {
  fetchPermissions,
  createRole,
  clearMessages
} from "../../../redux/slices/roles/rolesSlice";
import SubmitButton from "../../../Components/FormComponent/ButtonComponent/SubmitButton";
import MessageBox from "../../../Components/MessageBox/MessageBox";
import { checkPermission } from "../../../utils/permissionUtils";
import ErrorMessage from "../../../Components/MessageBox/ErrorMessage";
import { PERMISSION_GROUPS } from "../../../constants/permissions";
import ModernLoadingAnimation from "../../../Components/Loaders/ModernLoadingAnimation";

const AddMemberRole = ({ onRoleCreated, onClose }) => {
  const dispatch = useDispatch();
  const { permissions, loading,  error: backendError, } = useSelector((state) => state.role);

  const [formData, setFormData] = useState({
    role_name: "",
    role_description: "",
    permissions: []
  });
  const [errors, setErrors] = useState({
    role_name: "",
    role_description: ""
  });
  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);
  // Local success state to show message box on successful creation
  const [localSuccess, setLocalSuccess] = useState(null);

  useEffect(() => {
    dispatch(clearMessages());
  }, [dispatch]);

  useEffect(() => {
    const fetchPermission = async () => {
      const permissionId = 4;
      const permissionGranted = await checkPermission("org", permissionId);
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };
    fetchPermission();
    dispatch(fetchPermissions());
  }, [dispatch]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleCheckboxChange = (e, permissionId) => {
    if (e.target.checked) {
      setFormData((prev) => ({
        ...prev,
        permissions: [...prev.permissions, permissionId]
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        permissions: prev.permissions.filter((id) => id !== permissionId)
      }));
    }
  };

  const handleSelectAllChange = (e) => {
    if (e.target.checked) {
      setFormData((prev) => ({
        ...prev,
        permissions: permissions.map((perm) => perm.id)
      }));
    } else {
      setFormData((prev) => ({ ...prev, permissions: [] }));
    }
  };

  const handleSubmitRole = (e) => {
    e.preventDefault();
    setErrors({ role_name: "", role_description: "" });

    // Validate that role name and at least one permission is selected
    if (!formData.role_name.trim()) {
      setErrors((prev) => ({
        ...prev,
        role_name: "Role name is required"
      }));
      return;
    }

    if (formData.permissions.length === 0) {
      return; // Button should be disabled, but double-check
    }

    dispatch(createRole(formData))
      .unwrap()
      .then((newRole) => {
        // Set a local success message along with the new role data.
        setLocalSuccess({ message: "Role created successfully", newRole });
      })
      .catch((err) => {
        setErrors({
          role_name: err.role_name ? err.role_name[0] : "",
          role_description: err.role_description ? err.role_description[0] : ""
        });
      });
  };

  if (loadingPermission) return <ModernLoadingAnimation className="min-h-screen" />;
  if (!hasPermission) return <div>Not Authorized</div>;
  const hasSelectedPermission = formData.permissions.length > 0;
  const isFormValid = formData.role_name.trim() !== "" && hasSelectedPermission;

  const filterPermissionsByNames = (allPerms, group) => {
    // Filter ONLY by IDs to prevent duplicate permissions appearing in multiple groups
    if (group.ids && group.ids.length > 0) {
      return allPerms.filter((perm) => group.ids.includes(perm.id));
    }
    // Fallback to name matching only if no IDs specified
    if (group.names && group.names.length > 0) {
      return allPerms.filter((perm) => group.names.includes(perm.permission_name));
    }
    return [];
  };

  const handleSelectAllGroup = (group, isChecked) => {
    const groupIds = filterPermissionsByNames(permissions, group).map((perm) => perm.id);

    if (isChecked) {
      const combined = Array.from(
        new Set([...formData.permissions, ...groupIds])
      );
      setFormData((prev) => ({ ...prev, permissions: combined }));
    } else {
      const filtered = formData.permissions.filter(
        (id) => !groupIds.includes(id)
      );
      setFormData((prev) => ({ ...prev, permissions: filtered }));
    }
  };

  return (
    <div className="">
      <div className="container px-0">
        <div className="">
          <div className="bg-white border px-[14px] border-white mx-auto">
            <form onSubmit={handleSubmitRole}>
              <div className="flex justify-between items-center">
                <div className="md:flex justify-between "></div>
              </div>
              <div className="">
                <div className="w-full">
                  <TextInputComponent
                    name="role_name"
                    label="Role Name"
                    placeholder="Write Role Name"
                    value={formData.role_name}
                    onChange={handleChange}
                    labelClassName="font-sans font-medium text-[16px] md:text-[20px] leading-[140%] text-textDark"
                    // error={errors.role_name}
                  />
                  {errors.role_name && (
                    <ErrorMessage message={errors.role_name.message} />
                  )}

                  <div className="w-full">
                    <TextareaComponent
                      label="Role Description"
                      name="role_description"
                      value={formData.role_description}
                      onChange={handleChange}
                      placeholder="Write Role Description"
                      rows={2}
                      labelClassName="font-sans font-medium text-[16px] md:text-[20px] leading-[140%] text-textDark"
                      error={errors.role_description}
                    />
                  </div>
                </div>
              </div>
              <div className="">
                <div>
                  <h1 className="font-sans font-medium text-[18px] md:text-[20px] leading-[140%] text-textDark my-4">
                    Role Permission
                  </h1>
                  <div className="w-full max-h-[400px] md:h-[360px] overflow-y-auto pr-1">
                    {/* <div className="mb-[8px]">
                        <h2 className="text-base font-semibold p-3 text-center bg-subprimary rounded-[8px]">
                          Member Management
                        </h2>
                      </div> */}
                    {/* <div className="flex flex-col p-4 rounded-10  bg-white border shadow overflow-sroll"> */}
                    {/* <div className=""> */}
                    {/* <div className="flex items-center">
                          <input
                            type="checkbox"
                            className="form-checkbox h-4 w-4 text-indigo-600 accent-primary"
                            onChange={handleSelectAllChange}
                            checked={
                              permissions.length > 0 &&
                              formData.permissions.length === permissions.length
                            }
                          />
                          <label className="ml-2 mb-[3px]">Select All</label>
                        </div> */}
                    {/* {permissions &&
                          permissions.map((perm) => (
                            <div key={perm.id} className="flex items-center">
                              <input
                                type="checkbox"
                                className="form-checkbox h-4 w-4 text-indigo-600 accent-primary"
                                onChange={(e) =>
                                  handleCheckboxChange(e, perm.id)
                                }
                                checked={formData.permissions.includes(perm.id)}
                              />
                              <label className="ml-2 mb-[3px]">
                                {perm.permission_name}
                              </label>
                            </div>
                          ))} */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 w-full pr-0">
                      {PERMISSION_GROUPS.map((group) => {
                        const groupPerms = filterPermissionsByNames(
                          permissions,
                          group
                        );
                        const allChecked =
                          groupPerms.length > 0 &&
                          groupPerms.every((perm) =>
                            formData.permissions.includes(perm.id)
                          );
                        return (
                          <div key={group.title}>
                            <h2 className="text-base font-semibold p-3 text-center bg-subprimary rounded-8 mb-2">
                              {group.title}
                            </h2>
                            <div className="p-3 rounded-10 bg-white border shadow">
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="form-checkbox h-4 w-4 text-indigo-600 accent-primary"
                                  onChange={(e) =>
                                    handleSelectAllGroup(
                                      group,
                                      e.target.checked
                                    )
                                  }
                                  checked={allChecked}
                                />
                                <span className="ml-2 text-sm">All</span>
                              </label>
                              <div className="flex flex-col w-full max-h-[250px] md:h-[220px] overflow-y-auto">
                                {groupPerms.map((perm) => (
                                  <label key={perm.id} className="flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="form-checkbox h-4 w-4 text-indigo-600 accent-primary"
                                      onChange={(e) =>
                                        handleCheckboxChange(e, perm.id)
                                      }
                                      checked={formData.permissions.includes(
                                        perm.id
                                      )}
                                    />
                                    <span className="ml-2 mb-[3px] text-sm">
                                      {perm.permission_name}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              <div className="my-6 w-full md:w-[70%] text-center mx-auto">
                <SubmitButton
                  text="Create Role"
                  loading={loading}
                  disabled={loading || !isFormValid}
                  onClick={handleSubmitRole}
                  width="full"
                />
              </div>
            </form>
            {/* Show MessageBox with success message */}
            {localSuccess && (
              <MessageBox
                message={localSuccess.message}
                onOk={() => {
                  // alert()
                  if (onRoleCreated) onRoleCreated(localSuccess.newRole);
                  setLocalSuccess(null);
                  onClose();
                }}
              />
            )}
            {backendError && (
              <MessageBox
                type="error"
                error
                message={
                  backendError.role_name?.[0] ||
                  backendError.detail ||
                  "Unable to add the member role. Please try again."
                }
                clearMessage={() => dispatch(clearMessages())}
                onOk={() => dispatch(clearMessages())}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddMemberRole;
