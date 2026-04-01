import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useForm, Controller } from "react-hook-form";
import { useParams, useNavigate } from "react-router-dom";
import { memberfetchRoles } from "../../../../redux/slices/roles/rolesSlice";
import {
  fetchMemberById,
  fetchMemberTypes,
  memberUpdate
} from "../../../../redux/slices/api/memberApi";
import {
  setMessage,
  setError,
  clearMessage,
  setActiveTabs
} from "../../../../redux/slices/memberSlice";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import { Div } from "../../../../Components/Ui/Div";
import ArrowHeading from "../../../../Components/HeadingComponent/ArrowHeading";
import SubmitButton from "../../../../Components/FormComponent/ButtonComponent/SubmitButton";
import ModernLoadingAnimation from "../../../../Components/Loaders/ModernLoadingAnimation";
import { FiPlus } from "react-icons/fi";
import AddRoleModal from "../../AddRoleModal";
import Button from "../../../../Components/FormComponent/ButtonComponent/Button";
import PageContainer from "../../../../Components/Ui/PageContainer";

const MemberTypeAndRoleEditForm = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();

  // Destructure formState to get the dirty flag.
  // Destructure formState to get the dirty flag.
  const { control, handleSubmit, reset, setValue, formState: { isDirty } } = useForm();

  const [loading, setLoading] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [message, setMessageState] = useState("");
  const [error, setErrorState] = useState("");
  const [selectAll, setSelectAll] = useState(false);
  const [checkedRoles, setCheckedRoles] = useState([]);
  const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);

  const { roles } = useSelector((state) => state.role || {});
  const [localRoles, setLocalRoles] = useState(roles || []);
  const { memberTypes } = useSelector((state) => state.member || {});
  const { selectedMember, error: memberError } = useSelector(
    (state) => state.member
  );
  // console.log(selectedMember?.member,"selectedMemberasa")
  // Always fetch the latest roles and member types on mount (or when id changes)
  useEffect(() => {
    dispatch(memberfetchRoles());
    if (!memberTypes || memberTypes.length === 0) {
      dispatch(fetchMemberTypes());
    }
    if (id) {
      dispatch(fetchMemberById(id));
    }
  }, [dispatch, id, memberTypes]);

  // Update localRoles when the global roles change
  useEffect(() => {
    // console.log("roles", roles);
    setLocalRoles(roles);

  }, [roles]);

  // When the selected member is loaded, initialize the form values
  useEffect(() => {
    if (selectedMember?.member) {
      // Only include directly assigned roles (is_member=true, is_group=false)
      // Exclude roles that come from groups
      const directlyAssignedRoles = selectedMember.member.member_roles?.filter(
        role => role.is_member === true && role.is_group === false
      ) || [];
      
      const memberRoleIds = directlyAssignedRoles.map(role => Number(role.id));
      
      reset({
        member_type: selectedMember.member.member_type_edit?.id,
        // just IDs for form value, backend expects list of IDs probably
        member_roles: memberRoleIds
      });

      // Full role info with flags for checkbox state - only directly assigned roles
      const initialCheckedRoles = directlyAssignedRoles.map(role => ({
        id: Number(role.id), // Ensure ID is a number
        is_member: role.is_member,
        is_group: role.is_group,
      }));

      setCheckedRoles(initialCheckedRoles);
    }
  }, [selectedMember?.member, reset]);


const handleCheckboxChange = (roleId) => {
  setCheckedRoles(prev => {
    // Ensure consistent number comparison
    const roleIdNum = Number(roleId);
    const exists = prev.find(r => Number(r.id) === roleIdNum);
    if (exists) {
      // Remove the role object
      return prev.filter(r => Number(r.id) !== roleIdNum);
    } else {
      // Find role in localRoles to get flags
      const roleObj = localRoles.find(r => Number(r.id) === roleIdNum);
      if (!roleObj) return prev;
      // Add role with flags
      return [...prev, {
        id: roleIdNum, // Ensure ID is a number
        is_member: roleObj.is_member || false,
        is_group: roleObj.is_group || false,
      }];
    }
  });
};

  // const handleSelectAll = () => {
  //   const newState = !selectAll;
  //   setSelectAll(newState);
  //   if (newState) {
  //     const allIds = localRoles.map((role) => role.id);
  //     setCheckedRoles(allIds);
  //   } else {
  //     setCheckedRoles([]);
  //   }
  // };
  const handleSelectAll = () => {
  const newState = !selectAll;
  setSelectAll(newState);

  if (newState) {

    // console.log('Local Roles:', localRoles);
    const allRolesWithFlags = localRoles.map(role => ({
      id: Number(role.id), // Ensure ID is a number
      is_member: role.is_member || false,
      is_group: role.is_group || false,
    }));
    // console.log('All Roles with Flags:', allRolesWithFlags);
    setCheckedRoles(allRolesWithFlags);
  } else {
    setCheckedRoles([]);
  }
};

  

  // Sync form value when checkedRoles change. Use { shouldDirty: true } so changes are tracked.
 useEffect(() => {
  // console.log(checkedRoles)
  setValue(
    "member_roles",
    checkedRoles.map(r => r.id),
    { shouldDirty: true }
  );
}, [checkedRoles, setValue]);

  // Update "select all" checkbox if all roles are selected
  // useEffect(() => {

  //   console.log("checkedRoles", checkedRoles);
  //   const allSelected = localRoles?.every((role) =>
  //     checkedRoles.role.id?.includes(role.id)
  //   );
  //   setSelectAll(allSelected);
  // }, [checkedRoles, localRoles]);
useEffect(() => {
  const allSelected = localRoles?.every(localRole =>
    checkedRoles.some(checked => Number(checked.id) === Number(localRole.id))
  );
  setSelectAll(allSelected);
}, [checkedRoles, localRoles]);


  // Role-created handler update:
  // 1. Add new role to the local list (without auto-selecting it).
  // 2. Close the modal and refresh the global roles.
  const handleRoleCreatedWrapper = async (newRole) => {
    if (
      newRole &&
      typeof newRole === "object" &&
      newRole.message !== undefined &&
      newRole.data !== undefined
    ) {
      newRole = newRole.data;
    }
    let roleObj = {};
    if (
      typeof newRole === "object" &&
      newRole !== null &&
      newRole.id !== undefined &&
      newRole.role_name !== undefined
    ) {
      roleObj = newRole;
    } else {
      const maxId = localRoles.reduce(
        (max, role) => Math.max(max, Number(role.id) || 0),
        0
      );
      roleObj = { id: maxId + 1, role_name: newRole };
    }
    // Update local roles without auto-selecting the new role (optimistic update)
    setLocalRoles((prev) => {
      // Avoid duplicates
      if (prev.some(role => Number(role.id) === Number(roleObj.id))) {
        return prev;
      }
      return [...prev, roleObj];
    });
    setIsAddRoleModalOpen(false);
    // Refresh the global roles state for consistency and wait for it to complete
    try {
      await dispatch(memberfetchRoles()).unwrap();
      // After fetch completes, update localRoles with the fresh data from Redux
      // This ensures we have the most up-to-date role data
    } catch (error) {
      console.error("Failed to refresh roles:", error);
    }
  };

  // const onSubmit = async (data) => {
  //   const formData = new FormData();
  //   formData.append("member_type", data.member_type);
  //   formData.append("member_id", selectedMember?.member?.id);
  //   data.member_roles.forEach((role) => {
  //     formData.append("members_role", Number(role));
  //   });
  //   setLoading(true);
  //   try {
  //     const resultAction = await dispatch(memberUpdate({ id, formData }));
  //     if (memberUpdate.fulfilled.match(resultAction)) {
  //       dispatch(setMessage("Member updated successfully!"));
  //       setMessageState("Member updated successfully!");
  //       setShowMessage(true);
  //     } else {
  //       throw new Error(
  //         resultAction.error.message || "Failed to update member."
  //       );
  //     }
  //   } catch (error) {
  //     dispatch(setError(error.message));
  //     setErrorState(error.message);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

const onSubmit = async (data) => {
  const formData = new FormData();
  formData.append("is_member", true);
  formData.append("member_type", data.member_type);
  formData.append("member_id", selectedMember.member.id);

  // Only compare directly assigned roles (exclude group roles)
  const initialDirectRoles = selectedMember.member.member_roles
    .filter(r => r.is_member === true && r.is_group === false)
    .map(r => Number(r.id));
  const checkedNow = data.member_roles.map(id => Number(id));

    const toAdd = checkedNow.filter(id => !initialDirectRoles.includes(id));
    const toDelete = initialDirectRoles.filter(id => !checkedNow.includes(id));

    // console.log('selectedMember',selectedMember.member.member_roles)
    // console.log('initialRoles',initialRoles)
    // console.log('checkedNow',checkedNow)
    // console.log('toAdd',toAdd)
    
    // Send all current roles, not just the new ones
    // The backend will compare with existing and only create what's new
    checkedNow.forEach(id => {
      formData.append("members_role", id);
    });

  //    const rolesToAdd = toAdd.map(id => ({
  //   id: id,
  //   is_member: true,  // or dynamic value if needed
  //   is_group: false   // or dynamic value if needed
  // }));

  // Append roles to delete as before (assuming backend expects list of ints)
  toDelete.forEach(id => {
    formData.append("delete_role", id);
  });

  // Append the rolesToAdd array as JSON string
  // formData.append("members_role", JSON.stringify(rolesToAdd));
    setLoading(true);
    try {
      const resultAction = await dispatch(memberUpdate({ id, formData }));
      if (memberUpdate.fulfilled.match(resultAction)) {
        // Refresh the member data to reflect the updated roles
        await dispatch(fetchMemberById(id));
        dispatch(setMessage("Member updated successfully!"));
        setMessageState("Member updated successfully!");
        setShowMessage(true);
        
        // Trigger notification refresh if roles were added
        if (toAdd.length > 0) {
          // Dispatch event to refresh notifications (similar to announcementCreated, bulletinCreated)
          window.dispatchEvent(new Event('roleUpdated'));
        }
      } else {
        throw new Error(resultAction.error.message || "Failed to update member.");
      }
    } catch (error) {
      dispatch(setError(error.message));
      setErrorState(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer className="min-h-screen bg-surfaceMuted">
      <div className="sticky top-0 z-20 mb-3 flex items-center gap-3 bg-surfaceMuted/95 py-4 backdrop-blur">
        <div
          onClick={() => navigate(-1)}
          className="inline-flex cursor-pointer items-center gap-3 text-[#0F172A] transition-colors hover:text-primary"
        >
          <ArrowHeading title="Organization Member Information" size="2xl" color="text-black" />
        </div>
      </div>

      <div className="max-h-[calc(100vh-180px)] overflow-y-auto">
        {memberError && <p>Error: {memberError}</p>}
        {(!selectedMember?.member || !localRoles.length || !memberTypes.length) ? (
          <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
            <ModernLoadingAnimation />
          </div>
        ) : (
          <section className="mt-2 max-w-xl w-full rounded-[32px] border border-borderLight bg-white px-8 py-10">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
            <div>
              <label>Member Type</label>
              <Controller
                control={control}
                name="member_type"
                defaultValue={selectedMember?.member?.member_type_edit?.id || ""}
                render={({ field }) => (
                  <div className="flex space-x-4">
                    {memberTypes.map((type) => (
                      <div key={type.id}>
                        <label className="flex items-center px-3 py-2 cursor-pointer">
                          <input
                            type="radio"
                            {...field}
                            value={type.id}
                            checked={Number(field.value) === type.id}
                            onChange={() => field.onChange(type.id)}
                            className="mr-2 accent-[#3C9D9B] w-5 h-5"
                          />
                          <span className="text-sm text-black">
                            {type.type_name}
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              />
            </div>
            <div className="mt-3">
              <div className="flex justify-between items-center mb-2">
                <label>Member Roles</label>
                {/* <NavigateButton
                  size="small"
                  icon={FaPlus}
                  className="bg-primary text-white"
                  onClick={() => setIsAddRoleModalOpen(true)}
                >
                  Add New Role
                </NavigateButton> */}
                <Button
                  icon={FiPlus}
                  onClick={() => setIsAddRoleModalOpen(true)}
                  size="sm"
                  className="bg-primary  text-center hover:bg-primary-dark text-white"
                >
                  Add New Role{" "}
                </Button>
                {/* <Button
                  icon={FiPlus}
                  onClick={() => setIsAddRoleModalOpen(true)}
                  size="sm"
                  className="bg-primary  text-center hover:bg-primary-dark text-white"
                >
                  Add New Role{" "}
                </Button> */}
              </div>
              <div className="max-w-full h-[360px] overflow-y-auto bg-white border border-gray-300 rounded shadow-sm">
                <div key="select-all">
                  <label className="flex items-center px-3 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      className="mr-2 accent-primary w-6 h-6"
                    />
                    <span className="text-sm text-black">Select All</span>
                  </label>
                </div>
               {localRoles?.map(role => {
                      // Ensure consistent number comparison
                      const checkedRole = checkedRoles.find(r => Number(r.id) === Number(role.id) /*&& r.is_member*/);
                      // console.log("checkedRole", checkedRoles);
                      return (
                        <div key={role.id}>
                          <label className="flex items-center px-3 py-2 cursor-pointer">
                            <input
                              type="checkbox"
                              value={role.id}
                              checked={!!checkedRole} // Convert to boolean: true if found in checkedRoles
                              onChange={() => handleCheckboxChange(role.id)}
                              className="mr-2 accent-primary w-6 h-6"
                            />
                            <span className="text-sm text-black">{role.role_name}</span>
                          </label>
                        </div>
                      );
                    })}

              </div>
            </div>
            <div className="mt-auto pt-4">
            <SubmitButton
              text="Update"
              width="full"
              disabled={loading || error || !isDirty}
            />
            </div>
          </form>
          </section>
        )}
      </div>
      {showMessage && (
        <MessageBox
          message={message}
          error={error}
          clearMessage={() => {
            dispatch(clearMessage());
            setShowMessage(false);
          }}
          onOk={() => {
            if (message) {
              dispatch(setActiveTabs(2));
              navigate(-1);
            }
          }}
        />
      )}
      {/* Reusable modal to add a new role */}
      <AddRoleModal
        isOpen={isAddRoleModalOpen}
        onClose={() => setIsAddRoleModalOpen(false)}
        onRoleCreated={handleRoleCreatedWrapper}
      />
    </PageContainer>
  );
};

export default MemberTypeAndRoleEditForm;
