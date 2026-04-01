import { useEffect, useState } from "react";
import { memberFields } from "utils/formFields";
import TabButton from "Components/FormComponent/ButtonComponent/TabButton";
import { FiPlus } from "react-icons/fi";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Div } from "../../../../Components/Ui/Div";
import ArrowHeading from "../../../../Components/HeadingComponent/ArrowHeading";
import PageContainer from "../../../../Components/Ui/PageContainer";
import NavigateButton from "Components/FormComponent/ButtonComponent/NavigateButton";
import MessageBox from "Components/MessageBox/MessageBox";
import MemberSideForm from "../../../Members/MemberSideForm/MemberSideForm";
import MemberMainForm from "../../../Members/MemberMainForm/MemberMainForm";
import LoginCredential from "../../../Login/LoginCredential/LoginCredential";
import SubmitButton from "Components/FormComponent/ButtonComponent/SubmitButton";
import ResidentCheck from "../Components/ResidentCheck";
import useResidentValidation from "./useResidentValidation";
import { useDispatch, useSelector } from "react-redux";
import useHandleFileChange from "utils/useHandleFileChange";
import {
  createResident,
  resetResidentState,
  fetchMemberDetails
} from "../../../../redux/slices/residents/residentSlice";
import ModernLoadingAnimation from "Components/Loaders/ModernLoadingAnimation";
import { fetchUnitById } from "../../../../redux/slices/units/unitSlice";
import AddExistingMemberTable from "../../../../Components/AddExistingMemberTable/AddExistingMemberTable";
import axiosInstance from "../../../../utils/axiosInstance";
import { updateChangedFields } from "../../../../utils/updateFileChange";
import isEqual from 'lodash/isEqual';
import { checkPermission } from "../../../../utils/permissionUtils";
import Button from "Components/FormComponent/ButtonComponent/Button";
import ClearForm from "Components/FormComponent/ButtonComponent/ClearForm";
const AddResident = () => {
  // Permission state
  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);

  const [activeTab, setActiveTab] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showExistingModal, setShowExistingModal] = useState(false);
  // New state to track when autofill has completed
  const [autofillDisabled, setAutofillDisabled] = useState(false);

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { id } = useParams();
  const { loading, error, success } = useSelector((state) => state.resident);
  const { selectedUnit } = useSelector((state) => state.unit);
  // const [isFormChangedFirstTab, setIsFormChangedFirstTab] = useState(false);
  // const [isFormChangedSecondTab, setIsFormChangedSecondTab] = useState(false);
const [formKey, setFormKey] = useState(Date.now());

    

  const [formData, setFormData] = useState({
    member_id: null,
    is_org_member: 1,
    full_name: "",
    general_contact: "",
    general_email: "",
    nid_number: "",
    date_of_birth: "",
    login_email: "",
    occupation: "",
    gender: "",
    religion: "",
    marital_status: "",
    delivery_method: "",
    photo: null,
    nid_front: null,
    nid_back: null,
    permanent_address: "",
    present_address: "",
    about_us: "",
    facebook_profile: "",
    linkedin_profile: "",
    unit: selectedUnit?.id || 0,
    is_resident_or_tenant: true,
    unit_rent_fee: 0,
    advance_payment: 0,
    notice_period: 0,
    docs: []
  });


  
      const [isFormChangedFirstTab, setIsFormChangedFirstTab] = useState({});
      const [isFormChangedSecondTab, setIsFormChangedSecondTab] = useState({});
      const [buttonDisableFirst, setButtonDisableFirst] = useState(false);
      const [buttonDisableSecond, setButtonDisableSecond] = useState(false);
      const getSetIsFormChangedByTab = () => {
        if (activeTab === 1) return setIsFormChangedFirstTab;
        if (activeTab === 2) return setIsFormChangedSecondTab;
        // if (activeTab === 3) return setIsFormChangedThirdTab;
        return () => {};
      };
      
      // const { handleChange } = useHandleChange(setFormData, getSetIsFormChangedByTab());
      
      
      
      useEffect(() => {
        activeTab === 1 && setButtonDisableFirst( isEqual(isFormChangedFirstTab,{}));
        activeTab === 2 && setButtonDisableSecond( isEqual(isFormChangedSecondTab,{}));
        console.log(isFormChangedFirstTab)
      
      }, [
        isFormChangedFirstTab,
        isFormChangedSecondTab
      ]);
  
  useEffect(() => {
    if (id) dispatch(fetchUnitById(id));
  }, [dispatch, id]);

  useEffect(() => {
    if (selectedUnit?.id) {
      setFormData((p) => ({ ...p, unit: selectedUnit.id }));
    }
  }, [selectedUnit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));


    // setIsFormChangedFirstTab(true);

    // setIsFormChangedSecondTab(true);

 updateChangedFields(getSetIsFormChangedByTab(),name,value)



    
  };

  const { errors, validateForm, setErrors } = useResidentValidation();
  const { handleFileChange, handleFile3 } = useHandleFileChange(setFormData,getSetIsFormChangedByTab());

  const getFullUrl = (url) =>
    url && !url.startsWith("http")
      ? `${axiosInstance.defaults.baseURL || "http://127.0.0.1:8000"}${url}`
      : url;

  // Helper function to format date to YYYY-MM-DD for HTML date input
  const formatDateForInput = (dateString) => {
    if (!dateString) return "";
    
    try {
      // If already in YYYY-MM-DD format, return as is
      if (typeof dateString === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
      }
      
      // Try to parse the date
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return "";
      }
      
      // Format to YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error("Error formatting date:", error);
      return "";
    }
  };

  // Helper function to format date to DD-MMM-YYYY for backend (e.g., "04-Dec-2025")
  const formatDateForBackend = (dateString) => {
    if (!dateString) return "";
    
    try {
      // Parse the date (handles YYYY-MM-DD format from HTML date input)
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return "";
      }
      
      // Month abbreviations array
      const monthAbbr = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      ];
      
      const day = String(date.getDate()).padStart(2, "0");
      const month = monthAbbr[date.getMonth()];
      const year = date.getFullYear();
      
      return `${day}-${month}-${year}`;
    } catch (error) {
      console.error("Error formatting date for backend:", error);
      return "";
    }
  };

  const handleSelectMember = (member) => {
    const selectedId = member.member?.id || member.id;
    dispatch(fetchMemberDetails(selectedId))
      .unwrap()
      .then((data) => {
        setFormData((p) => ({
          ...p,
          member_id: data.id,
          full_name: data.full_name || "",
          general_contact: data.general_contact || data.login_contact || "",
          general_email: data.general_email || "",
          login_email: data.login_email || "",
          nid_number: data.nid_number || "",
          date_of_birth: formatDateForInput(data.date_of_birth) || "",
          occupation: data.occupation || "",
          gender: data.gender || "",
          religion: data.religion || "",
          marital_status: data.marital_status || "",
          permanent_address: data.permanent_address || "",
          present_address: data.present_address || "",
          about_us: data.about_us || "",
          facebook_profile: data.facebook_profile || "",
          linkedin_profile: data.linkedin_profile || "",
          photo: getFullUrl(data.photo) || null,
          nid_front: getFullUrl(data.nid_front) || null,
          nid_back: getFullUrl(data.nid_back) || null
        }));
        // When autofill is complete disable form inputs (but not the "Next" button)
        setAutofillDisabled(true);
        setShowExistingModal(false);
      //  setIsFormChangedFirstTab(true);
      //  setIsFormChangedSecondTab(true);
      setButtonDisableFirst(false)
      setButtonDisableSecond(false)


      })
      .catch(console.error);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate the current tab's fields first.
    const validationPassed = validateForm(formData, activeTab);
    if (!validationPassed) return;

    // For Tab 2, check that login_email is provided if user chooses to submit directly.
    if (activeTab === 2) {
      if (!formData.login_email.trim()) {
        setErrors((prev) => ({
          ...prev,
          login_email: "Login email is required"
        }));
        return;
      }
    } else if (activeTab === 3) {
      // For Tab 3, check required member fields.
      if (
        !formData.full_name.trim() ||
        !formData.general_contact.trim() ||
        !formData.general_email.trim()
      ) {
        setErrors({
          full_name: !formData.full_name.trim() ? "Full name is required" : "",
          general_contact: !formData.general_contact.trim()
            ? "General contact is required"
            : "",
          general_email: !formData.general_email.trim()
            ? "General email is required"
            : ""
        });
        return;
      }
    } else if (activeTab < 3) {
      // For Tab 1, simply advance to the next tab.
      setActiveTab(activeTab + 1);
      return;
    }

    // Prepare the FormData payload.
    const payload = new FormData();
    payload.append("is_org_member", formData.is_org_member);
    payload.append("unit", formData.unit);
    payload.append("is_resident_or_tenant", formData.is_resident_or_tenant);
    payload.append("unit_rent_fee", formData.unit_rent_fee);
    payload.append("advance_payment", formData.advance_payment);
    payload.append("notice_period", formData.notice_period);

    if (formData.member_id) {
      payload.append("member_id", formData.member_id);
      if (formData.delivery_method) {
        payload.append("member.delivery_method", formData.delivery_method);
      }
    } else {
      payload.append("member.full_name", formData.full_name);
      payload.append("member.general_contact", formData.general_contact);
      payload.append("member.general_email", formData.general_email);
      if (formData.nid_number)
        payload.append("member.nid_number", formData.nid_number);
      if (formData.date_of_birth)
        payload.append("member.date_of_birth", formatDateForBackend(formData.date_of_birth));
      if (formData.occupation)
        payload.append("member.occupation", formData.occupation);
      if (formData.gender) payload.append("member.gender", formData.gender);
      if (formData.marital_status)
        payload.append("member.marital_status", formData.marital_status);
      if (formData.delivery_method)
        payload.append("member.delivery_method", formData.delivery_method);
      if (formData.permanent_address)
        payload.append("member.permanent_address", formData.permanent_address);
      if (formData.present_address)
        payload.append("member.present_address", formData.present_address);
      if (formData.about_us)
        payload.append("member.about_us", formData.about_us);
      if (formData.facebook_profile)
        payload.append("member.facebook_profile", formData.facebook_profile);
      if (formData.linkedin_profile)
        payload.append("member.linkedin_profile", formData.linkedin_profile);
      if (formData.photo) payload.append("member.photo", formData.photo);
      if (formData.nid_front)
        payload.append("member.nid_front", formData.nid_front);
      if (formData.nid_back)
        payload.append("member.nid_back", formData.nid_back);
    }

    // Append docs if any.
    if (formData.docs.length > 0) {
      formData.docs.forEach((doc) => {
        payload.append("docs", doc);
      });
    }

    // Dispatch the createResident action.
    dispatch(createResident(payload));
  };

  useEffect(() => {
    if (success) setShowSuccess(true);
  }, [success]);

  // After showing the message box, redirect to the Unit Details' Residents tab.
  // UPDATED: Always redirect to the Residents tab (tab=3)
  const handleOk = () => {
    const unitId = selectedUnit?.id || formData.unit || id;
    dispatch(resetResidentState());
    navigate(`/unit-details/${unitId}?tab=3`, { replace: true });
  };

  const handleTabChange = (toTab) => {
    if (!validateForm(formData, activeTab)) return;
    // Optionally clear errors when navigating back.
    if (activeTab === 2 && toTab === 1) {
      setErrors((prevErrors) => {
        const { ...restErrors } = prevErrors;
        return restErrors;
      });
    }
    setActiveTab(toTab);
    // Scroll to top when tab changes - scroll the main content area
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Scroll to top when tab changes - scroll the main content area
  useEffect(() => {
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeTab]);

  // Scroll to top when component mounts (navigating to page)
  useEffect(() => {
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, []);

  useEffect(() => {
    const fetchPermission = async () => {
      
      const permissionGranted = await checkPermission("org", 19);
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };
    fetchPermission();
  }, []);

  if (loadingPermission) return <ModernLoadingAnimation className="min-h-screen" />;
  if (!hasPermission) {
    navigate("/not-authorized");
    return null;
  }
const initialFormState = {
  member_id: null,
  is_org_member: 1,
  full_name: "",
  general_contact: "",
  general_email: "",
  nid_number: "",
  date_of_birth: "",
  login_email: "",
  occupation: "",
  gender: "",
  religion: "",
  marital_status: "",
  delivery_method: "",
  photo: null,
  nid_front: null,
  nid_back: null,
  permanent_address: "",
  present_address: "",
  about_us: "",
  facebook_profile: "",
  linkedin_profile: "",
  unit: selectedUnit?.id || 0,
  is_resident_or_tenant: true,
  unit_rent_fee: 0,
  advance_payment: 0,
  notice_period: 0,
  docs: []
};
const handleResetFormData = () => {
  setFormData({ ...initialFormState, unit: selectedUnit?.id || 0 });
  setAutofillDisabled(false);
  setIsFormChangedFirstTab({});
  setIsFormChangedSecondTab({});
  setButtonDisableFirst(true);
  setButtonDisableSecond(true);
  setFormKey(Date.now());
};

 

  return (
    <PageContainer className="min-h-screen bg-surfaceMuted">
      <div className="flex-shrink-0 sticky top-0 z-20 mb-1.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surfaceMuted pt-0 pb-4 backdrop-blur">
        <div
          onClick={() => navigate(`/unit-details/${id}?tab=3`)}
          className="inline-flex cursor-pointer items-center gap-3 text-ink transition-colors hover:text-primary"
        >
          <ArrowHeading title="Add Resident" size="2xl" color="text-black" />
        </div>
        {activeTab === 1 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <ClearForm onClick={handleResetFormData} disabled={buttonDisableFirst} />
            <Button
              icon={FiPlus}
              onClick={() => setShowExistingModal(true)}
              className="bg-primary hover:bg-primaryDark text-white text-center transition-colors duration-200 w-full sm:w-auto"
            >
              Add Existing Member
            </Button>
          </div>
        )}
      </div>
      {error && (
        <MessageBox
          message={error}
          error
          clearMessage={() => dispatch(resetResidentState())}
        />
      )}
      {showSuccess && (
        <MessageBox
          message={!formData.is_resident_or_tenant ? "New Tenant has been successfully added." : "New Resident has been successfully added."}
          clearMessage={() => {
            setShowSuccess(false);
            handleOk();
          }}
        />
      )}

      <AddExistingMemberTable
        isOpen={showExistingModal}
        onClose={() => setShowExistingModal(false)}
        onSelectMember={handleSelectMember}
      />

      <section className="mx-auto mt-2 w-full rounded-[24px] sm:rounded-[32px] border border-borderLight bg-white px-4 py-6 sm:px-8 sm:py-10">
          <form
            onSubmit={handleSubmit}
            autoComplete="off"
            encType="multipart/form-data"
          >
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

            <Div className="flex flex-col lg:flex-row items-stretch bg-white h-full">
            {/* <fieldset disabled={autofillDisabled}> */}
            <Div className="bg-white p-4 sm:p-7 lg:pe-12 h-full">
              {/* <fieldset disabled={autofillDisabled}> */}
              <MemberSideForm
                key={formKey}  // ✅ Add this line

                formData={formData}
                setFormData={setFormData}
                memberFields={memberFields}
                errors={errors}
                handleChange={handleChange}
                onFileChange={handleFile3}
                allowedTypes={["image/jpeg", "image/png", "image/jpg"]}
                errorMessage="Please upload a valid image"
                savedPhoto={formData.photo}
                disabled={autofillDisabled}
              />
              {/* </fieldset> */}
            </Div>
            <div className="hidden lg:block w-px bg-slate-200" />
            <Div className="bg-white p-4 sm:p-5 lg:w-[787px] w-full mt-6 lg:mt-0">
              {activeTab === 1 && (
                <Div>
               {/* <Button
      onClick={handleResetFormData}
      className="bg-red-500 hover:bg-red-600 text-white"
    >
      Reset Form
    </Button> */}
                  {/* Disable the input fields in MemberMainForm only;
                      place the TabButton outside of the disabled fieldset */}
                  {/* <fieldset disabled={autofillDisabled}> */}
                  <MemberMainForm
                    key={formKey}  // ✅ Add this line

                    formData={formData}
                    setFormData={setFormData}
                    memberFields={memberFields}
                    errors={errors}
                    handleChange={handleChange}
                    onFileChange={handleFileChange}
                    savedFront={formData.nid_front}
                    savedBack={formData.nid_back}
                    disabled={autofillDisabled}
                    setIsFormChangedFirstTab={setIsFormChangedFirstTab}
                  />
                  {/* </fieldset> */}
                  <TabButton
                    label="Next"
                    tabIndex={2}
                    handleTabChange={handleTabChange}
                     disable={buttonDisableFirst}
                  />
                </Div>
              )}

              {activeTab === 2 && (
                <Div>
                  <Div
                    className="md:flex justify-between py-2"
                    onClick={() => handleTabChange(1)}
                  >
                    <ArrowHeading title="Resident Information" size="xl" />
                  </Div>
                  <ResidentCheck
                    formData={formData}
                    setFormData={setFormData}
                    handleChange={handleChange}
                    setIsFormChangedSecondTab={setIsFormChangedSecondTab}
                    isFormChangedSecondTab={isFormChangedSecondTab}
                  />
                  {formData.login_email.trim() ? (
                    <SubmitButton text="Submit" width="full" type="submit" />
                  ) : (
                    <TabButton
                      label="Next"
                      tabIndex={3}
                      handleTabChange={handleTabChange}
                    />
                  )}
                </Div>
              )}

              {activeTab === 3 && (
                <Div>
                  <LoginCredential
                    formData={formData}
                    setFormData={setFormData}
                    memberFields={memberFields}
                    onNext={() => handleTabChange(2)}
                    errors={errors}
                  />
                  <SubmitButton text="Submit" width="full" type="submit" />
                </Div>
              )}
            </Div>
          </Div>
          </form>
        </section>
    </PageContainer>
  );
};

export default AddResident;
