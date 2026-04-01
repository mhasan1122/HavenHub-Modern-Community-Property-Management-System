import { useEffect, useState, useMemo, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { FiPlus } from "react-icons/fi";

import MemberMainForm from "../../Members/MemberMainForm/MemberMainForm";
import MemberSideForm from "../../Members/MemberSideForm/MemberSideForm";
import { memberFields } from "utils/formFields";
import { Div } from "Components/Ui/Div";
import LoginCredential from "../../Login/LoginCredential/LoginCredential";
import ArrowHeading from "Components/HeadingComponent/ArrowHeading";
import TabButton from "Components/FormComponent/ButtonComponent/TabButton";
import SubmitButton from "Components/FormComponent/ButtonComponent/SubmitButton";
import NavigateButton from "Components/FormComponent/ButtonComponent/NavigateButton";

// Redux API Calls
import { fetchMemberTypes } from "../../../redux/slices/api/memberApi";
import { memberfetchRoles } from "../../../redux/slices/roles/rolesSlice";
import { addExistingContact } from "../../../redux/slices/units/unitSlice";

// Member Role & Type Assignment Components
import MemberRoleAsign from "./../MemberRoleAsign/MemberRoleAsign";
import MemberTypeAsign from "../MemberTypeAsign/MemberTypeAsign";

// Custom Hooks for handling different functionalities
import useMemberValidation from "./useMemberValidation";
import useHandleFileChange from "utils/useHandleFileChange";
import useMemberSelections from "./useMemberSelections";
import useMemberSubmit from "./useMemberSubmit";
import useHandleChange from "utils/useHandleChange";
import MessageBox from "../../../Components/MessageBox/MessageBox";
import TableSkeleton from "../../../Components/Loaders/TableSkeleton";
import ModernLoadingAnimation from "../../../Components/Loaders/ModernLoadingAnimation";

// Permission utility function
import { checkPermission } from "../../../utils/permissionUtils";

// Import ComMemberTable for the existing member modal
import ComMemberTable from "../../../Features/TowersAndUnits/Units/AddUnits/ComMemberTable";
import AddExistingCommMemberTable from "../MemberTable/AddExistingCommMemberTable";
import AddRoleModal from "../AddRoleModal";
import Button from "../../../Components/FormComponent/ButtonComponent/Button";
import isEqual from 'lodash/isEqual';
import { updateChangedFields } from "../../../utils/updateFileChange";
import ClearForm from "Components/FormComponent/ButtonComponent/ClearForm";

// Set your base URL to prepend for file previews
const baseURL = import.meta.env.VITE_BASE_API || "http://127.0.0.1:8000";

const OrganizationMemberForm = () => {
  const [showModal, setShowModal] = useState(false);

  // State for handling active tab number
  const [activeTab, setActiveTab] = useState(1);
  const navigate = useNavigate();

  // State for storing form data. Note: for second tab fields, default values are empty.


  const initialFormState = {
    member_type: "",
    members_role: [],
    is_org_member: 1,
    org_member_ever_created: 1,
    full_name: "",
    general_email: "",
    general_contact: "",
    permanent_address: "",
    present_address: "",
    date_of_birth: "",
    occupation: "",
    gender: "",
    marital_status: "",
    religion: "",
    about_us: "",
    facebook_profile: "",
    linkedin_profile: "",
    nid_number: "",
    photo: "",
    nid_front: "",
    nid_back: "",
    previewPhoto: undefined,
    previewNidFront: undefined,
    previewNidBack: undefined
  };


  const [formData, setFormData] = useState(initialFormState);

  // const isChanged = useMemo(() => {
  //   return !isEqual(formData, initialFormState);


  // }, [formData]);

  const [isFormChangedFirstTab, setIsFormChangedFirstTab] = useState({});
  const [isFormChangedSecondTab, setIsFormChangedSecondTab] = useState({});
  const [buttonDisableFirst, setButtonDisableFirst] = useState(true); // Start disabled since form is empty
  const [buttonDisableSecond, setButtonDisableSecond] = useState(true); // Start disabled since form is empty
  const [formKey, setFormKey] = useState(Date.now());
  const formRef = useRef(null);

  const getSetIsFormChangedByTab = () => {
    if (activeTab === 1) return setIsFormChangedFirstTab;
    if (activeTab === 2) return setIsFormChangedSecondTab;
    // if (activeTab === 3) return setIsFormChangedThirdTab;
    return () => { };
  };

  const { handleChange } = useHandleChange(setFormData, getSetIsFormChangedByTab());



  useEffect(() => {
    // Fields to exclude from the "has data" check (hidden/system fields)
    const excludeFields = ['is_org_member', 'org_member_ever_created', 'previewPhoto', 'previewNidFront', 'previewNidBack'];

    // Check if form has any user-entered data
    const hasDataInForm = Object.entries(formData).some(([key, value]) => {
      // Skip excluded fields
      if (excludeFields.includes(key)) return false;

      if (value === null || value === undefined) return false;
      if (typeof value === 'string') return value.trim() !== '';
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'number') return value !== 0;
      if (value instanceof File) return true;
      return false;
    });

    // Check if there are tracked changes
    const hasTrackedChanges = !isEqual(isFormChangedFirstTab, {});

    if (activeTab === 1) {
      // Enable button if form has data OR if there are tracked changes
      // Disable button only if form is empty AND there are no tracked changes
      const shouldDisable = !hasDataInForm && !hasTrackedChanges;
      setButtonDisableFirst(shouldDisable);
    }

    if (activeTab === 2) {
      const hasTrackedChangesSecond = !isEqual(isFormChangedSecondTab, {});
      setButtonDisableSecond(!hasTrackedChangesSecond);
    }
  }, [
    isFormChangedFirstTab,
    isFormChangedSecondTab,
    formData,
    activeTab
  ]);


  // State for permission check
  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);

  // State for handling the Existing Member Modal
  const [showMemberModal, setShowMemberModal] = useState(false);


  // Redux Hooks for fetching roles and member type data
  const dispatch = useDispatch();
  const { roles } = useSelector((state) => state.role || {});
  const { memberTypes } = useSelector((state) => state.member || {});
  // Get the member contact data from the "unit" slice
  const { memberContact } = useSelector((state) => state.unit || {});
  const [searchParams, setSearchParams] = useSearchParams();
  const [autofillDisabled, setAutofillDisabled] = useState(false);
  const [is_org_member, setIsOrgMember] = useState(false);
  // Custom hook for role/type selections
  const {
    selectedRoleValues,
    setSelectedRoleValues,
    selectedTypeValues,
    setSelectedTypeValues,
    handleRoleSelection
  } = useMemberSelections(setFormData);
  const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);

  // Fetch roles and member types on component mount
  useEffect(() => {
    if (!roles.length || roles.some((role) => !role.is_active)) {
      dispatch(memberfetchRoles());
    }
    if (!memberTypes.length) {
      dispatch(fetchMemberTypes());
    }
  }, [dispatch, roles, memberTypes]);

  // Dispatch to load existing member contacts
  useEffect(() => {
    dispatch(addExistingContact());
  }, [dispatch]);

  // Custom Hook for form validation
  const { errors, validateForm, setErrors } = useMemberValidation();

  // Custom Hook for handling file uploads
  const { handleFileChange, handleFile3, nidFront, nidBack, resetFiles } =
    useHandleFileChange(setFormData, getSetIsFormChangedByTab());

  // Custom Hook for handling form submission
  const {
    handleSubmit,
    loading,
    showMessage,
    message,
    error,
    clearMessage,
    handleDismissMessage
  } = useMemberSubmit(formData, validateForm, activeTab);

  // Permission Check Logic
  useEffect(() => {
    const fetchPermission = async () => {
      const permissionGranted = await checkPermission("org", 1);
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };
    fetchPermission();
  }, []);

  // Scroll to top when tab changes - scroll the main content area
  useEffect(() => {
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeTab]);

  // Show a skeleton while permission is being checked
  if (loadingPermission) {
    return (
      <div className="flex items-center justify-center my-12">
        <TableSkeleton rows={6} columns={4} />
      </div>
    );
  }

  // Redirect once permission check is complete and user is unauthorized
  if (!loadingPermission && !hasPermission) {
    navigate("/not-authorized");
    return null;
  }

  /**
   * Handle tab switching with optional validation.
   */

  const handleTabChange = (tabNumber) => {
    if (activeTab < tabNumber) {
      const validationPassed = validateForm(formData, activeTab);
      if (!validationPassed) return;
    }
    if (activeTab === 2 && tabNumber === 1) {
      setErrors((prevErrors) => {
        const { memberType, ...restErrors } = prevErrors;
        return restErrors;
      });
    }
    setActiveTab(tabNumber);
    // Scroll to top when tab changes - scroll the main content area
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Callback when a new role is created from the modal in tab 2
  const handleRoleCreated = async (newRole) => {
    // Extract the role data if it's wrapped in a response object
    let roleData = newRole;
    if (
      newRole &&
      typeof newRole === "object" &&
      newRole.message !== undefined &&
      newRole.data !== undefined
    ) {
      roleData = newRole.data;
    }

    // Refresh the roles list and wait for it to complete
    try {
      await dispatch(memberfetchRoles()).unwrap();
    } catch (error) {
      console.error("Failed to refresh roles:", error);
    }

    // Stay on tab 2 and update the selected roles if needed
    setActiveTab(2);
    
    // Only update selections if we have valid role data with an id
    if (roleData && roleData.id) {
      setSelectedRoleValues((prev) => {
        // Avoid duplicates
        if (prev.includes(roleData.id)) {
          return prev;
        }
        return [...prev, roleData.id];
      });
      setFormData((prev) => ({
        ...prev,
        members_role: prev.members_role.includes(roleData.id)
          ? prev.members_role
          : [...prev.members_role, roleData.id]
      }));
    }
  };

  /**
   * Callback to handle selection of an existing member.
   * Autofills all form fields (in MemberMainForm, MemberSideForm, and second tab) and sets file preview URLs.
   */
  const handleExistingMemberSelect = (member) => {
    // console.log(member)
    // console.log(member)

    setFormData((prev) => ({
      ...prev,

      full_name: member.full_name,
      general_email: member.general_email,
      general_contact: member.general_contact,
      permanent_address: member.permanent_address || "",
      present_address: member.present_address || "",
      date_of_birth: member.date_of_birth || "",
      occupation: member.occupation || "",
      gender: member.gender || "",
      marital_status: member.marital_status || "",
      religion: member.religion || "",
      about_us: member.about_us || "",
      facebook_profile: member.facebook_profile || "",
      linkedin_profile: member.linkedin_profile || "",
      nid_number: member.nid_number || "",
      // For file fields, we set the actual value to blank and use preview keys
      photo: "",
      nid_front: "",
      nid_back: "",
      previewPhoto: member.photo ? `${baseURL}${member.photo}` : undefined,
      previewNidFront: member.nid_front
        ? `${baseURL}${member.nid_front}`
        : undefined,
      previewNidBack: member.nid_back
        ? `${baseURL}${member.nid_back}`
        : undefined,
      // Also auto-select the member type from the selected member.
      member_type: member.member_type || "",
      // And auto-select member roles if available.
      members_role:
        member.member_roles && member.member_roles.length > 0
          ? member.member_roles.map((mr) => (mr.role ? mr.role.id : mr.id))
          : []
    }));

    // Update the custom hook states for role and type selections
    if (member.member_roles && member.member_roles.length > 0) {
      const rolesFromMember = member.member_roles.map((mr) =>
        mr.role ? mr.role.id : mr.id
      );
      setSelectedRoleValues(rolesFromMember);
    }
    if (member.member_type) {
      setSelectedTypeValues(member.member_type);
    }

    setShowMemberModal(false);
    setSearchParams({});
  };

  const handleExistingCommMemberSelect = (member) => {
    console.log(member);
    const fallback = (field) =>
      member?.member?.[field] ||
      member?.resident_member?.[field] ||
      member?.[field] ||
      "";
    // console.log(fallback("id"))
    if (fallback("is_org_member")) {
      setIsOrgMember("This member is already an Organization Member.");
      return;
    }

    setFormData((prev) => {
      const updatedData = {
        ...prev,
        id: parseInt(fallback("id")),
        full_name: fallback("full_name"),
        general_email: fallback("general_email"),
        general_contact: fallback("general_contact"),
        permanent_address: fallback("permanent_address"),
        present_address: fallback("present_address"),
        date_of_birth: fallback("date_of_birth"),
        occupation: fallback("occupation"),
        gender: fallback("gender"),
        marital_status: fallback("marital_status"),
        religion: fallback("religion"),
        about_us: fallback("about_us"),
        facebook_profile: fallback("facebook_profile"),
        linkedin_profile: fallback("linkedin_profile"),
        nid_number: fallback("nid_number"),
        delivery_method:
          fallback("login_email") || fallback("login_contact") || null,
        is_first_login: fallback("is_first_login"),

        photo: "",
        nid_front: "",
        nid_back: "",
        previewPhoto:
          member?.photo || member?.member?.photo
            ? `${baseURL}${member?.photo || member?.member?.photo}`
            : undefined,
        previewNidFront:
          member?.nid_front || member?.member?.nid_front
            ? `${baseURL}${member?.nid_front || member?.member?.nid_front}`
            : undefined,
        previewNidBack:
          member?.nid_back || member?.member?.nid_back
            ? `${baseURL}${member?.nid_back || member?.member?.nid_back}`
            : undefined,

        member_type: member?.member_type || member?.member?.member_type || "",
        members_role: (
          member?.member_roles ||
          member?.member?.member_roles ||
          []
        ).map((mr) => (mr?.role ? mr.role.id : mr?.id))
      };

      const login_email = fallback("login_email");
      const login_contact = fallback("login_contact");
      // console.log(login_email,login_contact)
      if (login_email) {
        updatedData.login_email = login_email;
      }

      if (login_contact) {
        updatedData.login_contact = login_contact;
      }

      return updatedData;
    });

    // Handle role and type selections from either level
    const rolesFromMember =
      member?.member_roles?.length > 0
        ? member.member_roles
        : member?.member?.member_roles || [];

    if (rolesFromMember.length > 0) {
      setSelectedRoleValues(
        rolesFromMember.map((mr) => (mr?.role ? mr.role.id : mr?.id))
      );
    }

    const typeValue = member?.member_type || member?.member?.member_type;
    if (typeValue) {
      setSelectedTypeValues(typeValue);
    }

    // setIsFormChangedFirstTab(true);
    // setIsFormChangedSecondTab(true);
    setButtonDisableFirst(false)
    setButtonDisableSecond(false)

    setAutofillDisabled(true);
    setShowModal(false);
    setSearchParams({});
  };

  // const handleRoleCreatedWrapper = (newRole) => {
  //   if (onRoleCreated) onRoleCreated(newRole);
  //   setIsAddRoleModalOpen(false);
  // };

  // const handleSelect = (member) => {
  //   setSelectedMember(member);
  //   setShowModal(false);
  //   console.log("Selected:", member);
  // };

  const handleResetFormData = () => {
    // Reset to tab 1
    setActiveTab(1);

    // Clear all errors first
    setErrors({});

    // Reset all selection and tracking states IMMEDIATELY
    setIsFormChangedFirstTab({});
    setIsFormChangedSecondTab({});
    setSelectedRoleValues([]);
    setSelectedTypeValues("");
    setAutofillDisabled(false);

    // Reset form data to exact initial state
    const resetData = {
      member_type: "",
      members_role: [],
      is_org_member: 1,
      org_member_ever_created: 1,
      full_name: "",
      general_email: "",
      general_contact: "",
      permanent_address: "",
      present_address: "",
      date_of_birth: "",
      occupation: "",
      gender: "",
      marital_status: "",
      religion: "",
      about_us: "",
      facebook_profile: "",
      linkedin_profile: "",
      nid_number: "",
      photo: "",
      nid_front: "",
      nid_back: "",
      previewPhoto: undefined,
      previewNidFront: undefined,
      previewNidBack: undefined
    };

    // Update form data state
    setFormData(resetData);

    // Reset file state from the hook AFTER formData is reset
    resetFiles();

    // Immediately reset button states (useEffect will also handle this, but this ensures it's done)
    setButtonDisableFirst(true);
    setButtonDisableSecond(true);

    // Force remount of form components by changing the key
    setFormKey(Date.now());

    // Reset the HTML form element and clear all inputs after React re-renders
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.reset();

        // Manually clear all input fields to ensure they're empty
        const inputs = formRef.current.querySelectorAll('input, textarea, select');
        inputs.forEach((input) => {
          if (input.type === 'file') {
            input.value = '';
          } else if (input.type !== 'hidden') {
            input.value = '';
          }
        });
      }
    }, 150);
  };


  return (
    <>
      {(showMessage || is_org_member) && (
        <MessageBox
          message={message}
          error={error || is_org_member}
          clearMessage={handleDismissMessage}
          onOk={() => {
            dispatch(handleDismissMessage);
            setIsOrgMember(false);

            if (message) navigate("/member-list");
          }}
        />
      )}

      <div className="flex-shrink-0 sticky top-0 z-20 mb-1.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surfaceMuted pt-0 pb-4 backdrop-blur">
        <div
          onClick={() => navigate("/member-list")}
          className="inline-flex cursor-pointer items-center gap-3 text-ink transition-colors hover:text-primary"
        >
          <ArrowHeading title="Add Member" size="2xl" color="text-black" />
        </div>
        {activeTab === 1 && (
          <div className="flex flex-col sm:flex-row items-stretch items-center gap-2 w-full sm:w-auto">
            <ClearForm
              onClick={handleResetFormData}
              disabled={buttonDisableFirst}
            />
            <Button
              icon={FiPlus}
              onClick={() => setShowModal(true)}
              className="bg-primary hover:bg-primaryDark text-white flex items-center justify-center transition-colors duration-200 w-full sm:w-auto"
            >
              <span className="">Add Community Member</span>
            </Button>
          </div>
        )}
      </div>

      <section className="mx-auto mt-2 w-full rounded-[24px] sm:rounded-[32px] border border-borderLight bg-white px-4 py-6 sm:px-8 sm:py-10">
        <AddExistingCommMemberTable
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSelect={handleExistingCommMemberSelect}
        />

        <form ref={formRef} onSubmit={handleSubmit} autoComplete="off">
          {loading && (
            <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
              <ModernLoadingAnimation />
            </div>
          )}
          <input
            type="hidden"
            name="is_org_member"
            value={formData.is_org_member}
          />
          <Div key={formKey} className="flex flex-col lg:flex-row items-stretch bg-white h-full">
            {/* <fieldset disabled={autofillDisabled}> */}
            <Div className="bg-white p-4 sm:p-7 lg:pe-12 h-full w-full lg:w-auto">
              <MemberSideForm
                memberFields={memberFields}
                formData={formData}
                setFormData={setFormData}
                handleChange={handleChange}
                onFileChange={handleFile3}
                allowedTypes={["image/jpeg", "image/png", "image/jpg"]}
                errorMessage="Please upload a valid image"
                savedPhoto={
                  formData.photo instanceof File
                    ? undefined
                    : formData.previewPhoto
                }
                disabled={autofillDisabled}
                activeTab={activeTab}
              />
              {/* </fieldset> */}
            </Div>
            <div className="hidden lg:block w-px bg-[#E2E8F0]" />
            <Div className="bg-white p-4 sm:p-5 lg:w-[787px] w-full mt-6 lg:mt-0">
              {activeTab === 1 && (

                <Div>
                  <Div className="flex justify-between items-center mb-4">
                    {/* <Button
                  onClick={handleResetFormData}
                  className="bg-red-500 hover:bg-red-600 text-white"
                >
                  Reset Form
                </Button> */}

                  </Div>
                  <fieldset disabled={autofillDisabled}>
                    <MemberMainForm
                      formData={formData}
                      setFormData={setFormData}
                      memberFields={memberFields}
                      errors={errors}
                      handleChange={handleChange}
                      onFileChange={handleFileChange}
                      savedFront={
                        formData.nid_front instanceof File
                          ? nidFront
                          : formData.previewNidBack
                      }
                      savedBack={
                        formData.nid_back instanceof File
                          ? nidBack
                          : formData.previewNidBack
                      }
                      setIsFormChangedFirstTab={setIsFormChangedFirstTab}
                      disabled={autofillDisabled}
                    />
                  </fieldset>

                  <TabButton label="Next" tabIndex={2} handleTabChange={handleTabChange} disable={buttonDisableFirst} />
                </Div>
              )}
              {activeTab === 2 && (
                <Div key={`tab2-${formKey}`}>
                  <Div
                    className="md:flex justify-between py-2"
                    onClick={() => handleTabChange(1)}
                  >
                    <ArrowHeading
                      title="Organization Member Information"
                      size="xl"
                    />
                  </Div>
                  <MemberTypeAsign
                    label="Member Type"
                    data={memberTypes.filter(type => type.type_name !== "Test Member")}
                    onChange={(value) => {
                      setFormData({ ...formData, member_type: value })

                      updateChangedFields(setIsFormChangedSecondTab, 'member_type', value);

                    }


                    }
                    selectedOption={formData.member_type}
                    errors={errors}
                    setIsFormChangedSecondTab={setIsFormChangedSecondTab}
                  />
                  <MemberRoleAsign
                    label="Member Role"
                    data={roles}
                    optionKey="role_name"
                    valueKey="id"
                    onChange={handleRoleSelection}
                    isMultiSelect={true}
                    selectedOptions={selectedRoleValues}
                    onRoleCreated={handleRoleCreated}
                    onAddRoleClick={() => setIsAddRoleModalOpen(true)}
                    setIsFormChangedSecondTab={setIsFormChangedSecondTab}
                  />

                  {formData.login_email || formData.login_contact ? (
                    <SubmitButton text="Submit" width="full" />
                  ) : (
                    <TabButton label="Next" tabIndex={3} handleTabChange={handleTabChange} disable={buttonDisableSecond} />
                  )}
                </Div>
              )}

              {(!formData.login_email && !formData.login_contact) &&
                activeTab === 3 && (
                  <Div key={`tab3-${formKey}`}>
                    <LoginCredential
                      formData={formData}
                      setFormData={setFormData}
                      memberFields={memberFields}
                      onNext={() => handleTabChange(2)}
                      errors={errors}
                      disabled={autofillDisabled}
                    />
                    <SubmitButton text="Submit" width="full" />
                  </Div>
                )}
            </Div>
          </Div>
        </form>
      </section>

      {/* Render the existing member modal (do not change ComMemberTable component) */}
      <ComMemberTable
        isOpen={showMemberModal}
        onClose={() => setShowMemberModal(false)}
        contactType="org_member"
        commMembers={memberContact}
        onSelect={handleExistingMemberSelect}
      />

      <AddRoleModal
        isOpen={isAddRoleModalOpen}
        onClose={() => setIsAddRoleModalOpen(false)}
        onRoleCreated={handleRoleCreated}
      />
    </>
  );
};

export default OrganizationMemberForm;
