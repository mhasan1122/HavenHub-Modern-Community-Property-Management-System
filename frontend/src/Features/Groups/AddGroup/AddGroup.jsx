import { useEffect, useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import TextInputComponent from "Components/FormComponent/TextInputComponent";
import TextareaComponent from "Components/FormComponent/TextareaComponent";
import CheckboxComponent from "Components/FormComponent/CheckboxComponent";
import MemberGroupAsignTable from "Components/Table/Group/MemberGroupAsignTable";
import MessageBox from "Components/MessageBox/MessageBox";
import PageContainer from "../../../Components/Ui/PageContainer";
import {
  createGroup,
  updateGroup,
  fetchGroupDetail,
  fetchRoles,
  clearGroupMessage,
  setGroupError,
  setSelectedMemberIds,
  updateGroupFormField,
  setGroupFormData,
  clearGroupFormData,
  toggleGroupStatus
} from "../../../redux/slices/groups/groupSlice";
import { Div } from "Components/Ui/Div";
import { Paragraph } from "Components/Ui/Paragraph";
import { Heading } from "Components/Ui/Heading";
import SubmitButton from "Components/FormComponent/ButtonComponent/SubmitButton";
import { groupFields } from "../../../utils/formFields";
import ArrowHeading from "../../../Components/HeadingComponent/ArrowHeading";
import { checkPermission } from "../../../utils/permissionUtils";

import Button from "Components/FormComponent/ButtonComponent/Button";
import ConfirmationMessageBox from "Components/MessageBox/ConfirmationMessageBox";

import isEqual from "lodash/isEqual";
import { updateChangedFields } from "../../../utils/updateFileChange";

const AddGroup = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // FIX: Add groupDetail to the selector
  const { roles, error, message, groupFormData, groupDetail } = useSelector(
    (state) => state.group
  );

  const [initialPayload, setInitialPayload] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [isFormChangedFirstTab, setIsFormChangedFirstTab] = useState({});
  const [buttonDisableFirst, setButtonDisableFirst] = useState(false);
  const [updatedRoleIds, setUpdatedRoleIds] = useState([]);
  const [hasChanges, setHasChanges] = useState(false); 
  const [initialFormData, setInitialFormData] = useState({});
 const is_active = groupDetail?.is_active ?? false;
 

useEffect(() => {
  
    const initialRoleIds = roles
      .filter(role => groupFormData.role_ids.includes(role.id))
      .map(role => role.id);


       setUpdatedRoleIds((prev) => {
      return initialRoleIds;
    });

    const initialData = { selectAll: initialRoleIds, group_name: groupFormData.group_name};

    if (groupFormData.group_description) {
          initialData.group_description = groupFormData.group_description;
    }
    if (groupFormData.member_ids) {
          initialData.member_check = groupFormData.member_ids;
    }
     updateChangedFields(setIsFormChangedFirstTab, 'selectAll', initialRoleIds);
     updateChangedFields(setIsFormChangedFirstTab, 'group_name', groupFormData.group_name);
     if (groupFormData.group_description) {
      updateChangedFields(setIsFormChangedFirstTab, 'group_description', groupFormData.group_description);
    }
      if (groupFormData.member_ids && groupFormData.member_ids.length > 0) {
              updateChangedFields(setIsFormChangedFirstTab, 'member_check', groupFormData.member_ids);
      }
    setInitialFormData(initialData);

}, [roles]);

// -----Firoj Hasan---------Start---
// -----Firoj Hasan---------Start---

// useEffect(() => {
//   if (isFormChangedFirstTab) {

//     setHasChanges(!isEqual(isFormChangedFirstTab, initialFormData));
//   }
// }, [isFormChangedFirstTab]);

useEffect(() => {
  // For add mode (no id), enable button when group name is filled (required field)
  if (!id) {
    const hasFormData = groupFormData.group_name.trim() !== "";
    setHasChanges(hasFormData);
    return;
  }
  
  // For edit mode, check if form has changed from initial state
  if (!groupDetail) return;
  
  const baseInitial = {
    selectAll: groupDetail?.roles?.map(role => role.id) || [],
    group_name: groupDetail?.group_name || "",
    group_description: groupDetail?.group_description || "",
    member_check: groupDetail?.members?.map(m => m.id) || [],
  };

  const currentState = {
    selectAll: groupFormData.role_ids || [],
    group_name: groupFormData.group_name,
    group_description: groupFormData.group_description || "",
    member_check: groupFormData.member_ids || [],
  };

  setHasChanges(!isEqual(currentState, baseInitial));
}, [
  groupFormData.group_name,
  groupFormData.group_description,
  groupFormData.member_ids,
  groupFormData.role_ids,
  groupDetail,
  id
]);

// -----Firoj Hasan---------end---
// -----Firoj Hasan---------end---



  // Check permission when the component mounts.
  useEffect(() => {
    const fetchPermission = async () => {
      const permissionId = id ? 8 : 7;
      const permissionGranted = await checkPermission("org", permissionId);
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };
    fetchPermission();
  }, [id]);

  // Redirect after permission check
  useEffect(() => {
    if (!loadingPermission && !hasPermission) {
      navigate("/not-authorized");
    }
  }, [loadingPermission, hasPermission, navigate]);

  // Clear messages
  useEffect(() => {
    dispatch(clearGroupMessage());
  }, [dispatch]);

  // Fetch roles
  useEffect(() => {
    dispatch(fetchRoles());
  }, [dispatch]);

  // Clear form data
  useEffect(() => {
    if (!id) {
      dispatch(clearGroupFormData());
      dispatch(setSelectedMemberIds([]));
    }
    return () => {
      dispatch(clearGroupFormData());
      dispatch(setSelectedMemberIds([]));
    };
  }, [id, dispatch]);

  // Fetch group details for edit mode
  useEffect(() => {
    if (id) {
      dispatch(fetchGroupDetail(id)).then((action) => {
        if (action.payload) {
          const {
            group_name,
            group_description,
            roles: groupRoles,
            members,
            is_active // FIX: Ensure this is included
          } = action.payload;
          const role_ids = groupRoles.map((role) => role.id);
          const member_ids = members.map((member) => member.id);

          const initialData = {
            group_name,
            group_description,
            role_ids,
            member_ids,
            is_active // FIX: Include status in initial data
          };
          setInitialPayload(initialData);

          dispatch(
            setGroupFormData({
              group_name,
              group_description,
              role_ids,
              member_ids,
              selectAll: false
            })
          );
          dispatch(setSelectedMemberIds(member_ids));
        }
      });
    }
  }, [id, dispatch]);

  // Update selectAll flag
  useEffect(() => {
    if (id && roles && roles.length > 0) {
      dispatch(
        updateGroupFormField({
          field: "selectAll",
          value: groupFormData.role_ids.length === roles.length
        })
      );
    }
   

  

    
  }, [roles, groupFormData.role_ids, id, dispatch]);
  // Update selectAll flag
  

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    dispatch(updateGroupFormField({ field: name, value }));
    updateChangedFields(setIsFormChangedFirstTab, name, value);
    if (name === "group_name" && error === "Group name is required.") {
      dispatch(clearGroupMessage());
    }
  };

  // Handle role checkbox changes
  const handleRoleChange = (e) => {
    const { name, value, checked } = e.target;
    const roleId = parseInt(value, 10);

    let updatedRoleIds;
    if (checked) {
      updatedRoleIds = groupFormData.role_ids.includes(roleId) 
        ? groupFormData.role_ids 
        : [...groupFormData.role_ids, roleId];
    } else {
      updatedRoleIds = groupFormData.role_ids.filter((id) => id !== roleId);
    }

    setUpdatedRoleIds(updatedRoleIds);
    updateChangedFields(setIsFormChangedFirstTab, 'selectAll', updatedRoleIds);

    dispatch(
      updateGroupFormField({
        field: "role_ids",
        value: updatedRoleIds
      })
    );

    if (!checked) {
      dispatch(
        updateGroupFormField({
          field: "selectAll",
          value: false
        })
      );
    }
  };

  // Handle select all
  const handleSelectAll = (e) => {
    const { name, checked } = e.target;
    const allRoleIds = checked ? roles.map((role) => role.id) : [];
    
    setUpdatedRoleIds(allRoleIds);
    updateChangedFields(
      setIsFormChangedFirstTab,
      name,
      allRoleIds
    );
    dispatch(
      updateGroupFormField({
        field: "selectAll",
        value: checked
      })
    );
    dispatch(
      updateGroupFormField({
        field: "role_ids",
        value: allRoleIds
      })
    );
  };

  // Ensure role_ids are set when selectAll is checked
  useEffect(() => {
    if (groupFormData.selectAll && roles && roles.length > 0) {
      dispatch(
        updateGroupFormField({
          field: "role_ids",
          value: roles.map((role) => role.id)
        })
      );
    }
  }, [roles, groupFormData.selectAll, dispatch]);

  // Handle member selection changes
  const handleMemberSelectionChange = useCallback(
    (selectedMemberIds) => {
      const filtered = selectedMemberIds.filter(
        (id) => id !== undefined && id !== null
      );
      dispatch(updateGroupFormField({ field: "member_ids", value: filtered }));
    },
    [dispatch]
  );

  const clearMessage = () => {
    dispatch(clearGroupMessage());
  };

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // For edit mode, check if there are changes
    if (id && !hasChanges) return;

    if (!groupFormData.group_name.trim()) {
      dispatch(setGroupError("Group name is required."));
      return;
    }

    const payload = {
      group_name: groupFormData.group_name,
      group_description: groupFormData.group_description,
      role_ids: groupFormData.role_ids,
      member_ids: groupFormData.member_ids,
      is_group: true
    };

    if (
      id &&
      initialPayload &&
      JSON.stringify(payload) === JSON.stringify(initialPayload)
    ) {
      console.log("No changes made. Update aborted.");
      return;
    }

    try {
      if (id) {
        dispatch(updateGroup({ id, payload }));
      } else {
        dispatch(createGroup(payload));
      }
    } catch (err) {
      console.error("Error submitting form:", err);
    }
  };

  // Handle OK in message box
  const handleOk = () => {
    if (id) {
      navigate(`/groupProfile/${id}`);
    } else {
      navigate("/group-list");
    }
  };

  // Only block rendering if permission is still loading
  // Don't use skeleton loading hook here as it causes infinite loading
  if (loadingPermission) {
    return null; // Or a simple loading spinner if preferred
  }

  const handleToggleStatus = () => {
    setShowStatusConfirm(true);
  };

  const handleConfirmToggleStatus = () => {
    setShowStatusConfirm(false);
    dispatch(toggleGroupStatus(id));
  };



  

  return (
    <PageContainer className="min-h-screen bg-surfaceMuted">
      {((error && error !== "Group name is required.") || message) && (
        <MessageBox
          message={message}
          error={error && error !== "Group name is required." ? error : null}
          clearMessage={clearMessage}
          onOk={!error && message ? handleOk : undefined}
        />
      )}

      {showStatusConfirm && (
        <ConfirmationMessageBox
          message={`Do you want to ${
            is_active ? "deactivate" : "activate"
          } this group?`}
          onConfirm={handleConfirmToggleStatus}
          onCancel={() => setShowStatusConfirm(false)}
        />
      )}

      <div className="flex-shrink-0 sticky top-0 z-20 mb-1.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surfaceMuted pt-0 pb-4 backdrop-blur">
        <div
          onClick={() => navigate(-1)}
          className="inline-flex cursor-pointer items-center gap-2 sm:gap-3 text-ink transition-colors hover:text-primary"
        >
          <ArrowHeading title={`${id ? "Edit Group" : "Add Group"}`} size="2xl" color="text-black" />
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {id && (
            <button
              type="button"
              onClick={handleToggleStatus}
              className={`px-4 py-2 text-sm sm:text-base font-semibold border-2 rounded-lg transition-colors whitespace-nowrap flex-shrink-0 w-full sm:w-auto ${
                is_active
                  ? "bg-primary/10 border-primary text-primary hover:bg-primary/15"
                  : "bg-error/10 border-error text-error hover:bg-error/15"
              }`}
            >
              {is_active ? "Active" : "Inactive"}
            </button>
          )}
          <div className="w-full sm:w-auto">
            <SubmitButton
              text={id ? "Update" : "Create"}
              loading={false}
              disabled={!hasChanges} 
              onClick={handleSubmit}
              bgColor={!hasChanges ? "bg-white cursor-not-allowed" : "bg-primary"}
              textColor={!hasChanges ? "text-primary" : "text-white"}
              className="w-full sm:w-auto my-0 py-2.5 sm:py-2 text-sm sm:text-base font-medium"
            />
          </div>
        </div>
      </div>

      <div className="max-h-[calc(100vh-180px)] overflow-y-auto custom-scrollbar">
        <section className="mx-auto w-full rounded-[16px] sm:rounded-[24px] lg:rounded-[32px] border border-borderLight bg-white px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
          <form onSubmit={handleSubmit}>
            <Div className="mb-4 sm:mb-6 lg:mb-[24px]">
              <TextInputComponent
                {...groupFields.group_name}
                name="group_name"
                value={groupFormData.group_name}
                onChange={handleInputChange}
                required
                error={error === "Group name is required." ? error : ""}
                labelClassName="text-sm sm:text-base font-medium text-gray-700"
              />
            </Div>
            <Div className="flex flex-col lg:flex-row justify-center gap-4 sm:gap-6 lg:gap-4">
              <Div className="w-full lg:w-[40%]">
                <Heading level={1} className="my-2 text-sm sm:text-base font-medium">
                  Roles
                </Heading>
                <Div className="max-h-[300px] overflow-y-auto border w-full border-BorderSecondary p-2 sm:p-3 rounded-md shadow-sm">
                  <Div className="mb-2">
                    <CheckboxComponent
                      {...groupFields.selectAll}
                      checked={groupFormData.selectAll}
                      onChange={handleSelectAll}
                      value="all"
                    />
                  </Div>
                  {roles.map((role) => (
                    <Div key={role.id} className="mb-2">
                      <CheckboxComponent
                        name="role_ids"
                        label={role.role_name}
                        checked={groupFormData.role_ids.includes(role.id)}
                        onChange={handleRoleChange}
                        value={role.id}
                      />
                    </Div>
                  ))}
                </Div>
              </Div>
              <Div className="w-full lg:w-[60%]">
                <TextareaComponent
                  {...groupFields.group_description}
                  name="group_description"
                  value={groupFormData.group_description}
                  onChange={handleInputChange}
                  labelClassName="text-sm sm:text-base font-medium text-gray-700"
                />
              </Div>
            </Div>
            <Div className="p-1 sm:p-1.5">
              <MemberGroupAsignTable
                onSelectionChange={handleMemberSelectionChange}
                selectedMemberIds={groupFormData.member_ids}
                setIsFormChangedFirstTab={setIsFormChangedFirstTab}
                updateChangedFields={updateChangedFields}
                groupId={id}
              />
            </Div>
          </form>
        </section>
      </div>
    </PageContainer>
  );
};

export default AddGroup;