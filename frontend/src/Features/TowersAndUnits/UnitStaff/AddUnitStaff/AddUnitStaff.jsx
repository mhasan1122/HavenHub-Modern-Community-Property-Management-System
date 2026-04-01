import { useEffect, useState } from "react";
import { memberFields } from "utils/formFields";
import TabButton from "Components/FormComponent/ButtonComponent/TabButton";
import { FiPlus } from "react-icons/fi";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Div } from "../../../../Components/Ui/Div";
import ArrowHeading from "Components/HeadingComponent/ArrowHeading";
import PageContainer from "Components/Ui/PageContainer";
import NavigateButton from "Components/FormComponent/ButtonComponent/NavigateButton";
import MessageBox from "Components/MessageBox/MessageBox";
import SubmitButton from "Components/FormComponent/ButtonComponent/SubmitButton";
import { useDispatch, useSelector } from "react-redux";
import useHandleFileChange from "utils/useHandleFileChange";
import ModernLoadingAnimation from "Components/Loaders/ModernLoadingAnimation";
import useUnitStaffValidation from "./useUnitStaffValidation";
import MemberSideForm from "../../../Members/MemberSideForm/MemberSideForm";
import MemberMainForm from "../../../Members/MemberMainForm/MemberMainForm";
import LoginCredential from "../../../Login/LoginCredential/LoginCredential";
import AddExistingMemberTable from "../../../../Components/AddExistingMemberTable/AddExistingMemberTable";
import { fetchMemberDetails } from "../../../../redux/slices/residents/residentSlice";
import axiosInstance from "../../../../utils/axiosInstance";
import { fetchUnitById } from "../../../../redux/slices/units/unitSlice";
import {
  createUnitStaff,
  resetUnitStaffState
} from "../../../../redux/slices/unitStaff/unitStaffSlice";
import isEqual from 'lodash/isEqual';
import { updateChangedFields } from "../../../../utils/updateFileChange";
import { checkPermission } from "../../../../utils/permissionUtils";
import Button from "Components/FormComponent/ButtonComponent/Button";
import ClearForm from "Components/FormComponent/ButtonComponent/ClearForm";

const AddUnitStaff = () => {
  const [activeTab, setActiveTab] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showExistingModal, setShowExistingModal] = useState(false);
  const [autofillDisabled, setAutofillDisabled] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);
  const [buttonDisable, setButtonDisable] = useState(true); // Start disabled since form is empty
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { id } = useParams();
const [formKey, setFormKey] = useState(Date.now());

  const { loading, error, success } = useSelector((state) => state.unitStaff);
  const { selectedUnit } = useSelector((state) => state.unit);

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
    unit_staff_status: true,
    docs: []
  });


    const [isFormChangedFirstTab, setIsFormChangedFirstTab] = useState({});
    const [isFormChangedSecondTab, setIsFormChangedSecondTab] = useState({});
    const [buttonDisableFirst, setButtonDisableFirst] = useState(false);
    const [buttonDisableSecond, setButtonDisableSecond] = useState(false);

  // Check if form has any data to enable/disable Clear Form button
  useEffect(() => {
    // Fields to exclude from the "has data" check (hidden/system fields)
    const excludeFields = [
      'is_org_member', 
      'unit', 
      'unit_staff_status', 
      'member_id'
    ];
    
    // Check if form has any user-entered data
    let hasDataInForm = false;
    
    for (const [key, value] of Object.entries(formData)) {
      // Skip excluded fields
      if (excludeFields.includes(key)) continue;
      
      // Check for actual user data
      if (value === null || value === undefined) continue;
      if (typeof value === 'string' && value.trim() !== '') {
        hasDataInForm = true;
        break;
      }
      if (Array.isArray(value) && value.length > 0) {
        hasDataInForm = true;
        break;
      }
      if (value instanceof File) {
        hasDataInForm = true;
        break;
      }
    }
    
    // Disable button only if form is empty
    setButtonDisable(!hasDataInForm);
  }, [formData]);

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
      setFormData((prev) => ({ ...prev, unit: selectedUnit.id }));
    }
  }, [selectedUnit]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));



 if(checked) {

    }else if(!checked) {
   
    }
    
  // getSetIsFormChangedByTab()

   updateChangedFields(getSetIsFormChangedByTab(),name,value)


  };

  const { errors, validateForm, setErrors } = useUnitStaffValidation();
  const { handleFileChange, handleFile3 } = useHandleFileChange(setFormData,getSetIsFormChangedByTab());

  const getFullUrl = (url) =>
    url && !url.startsWith("http")
      ? `${axiosInstance.defaults.baseURL}${url}`
      : url;

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
          date_of_birth: data.date_of_birth || "",
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
        setAutofillDisabled(true);
        setShowExistingModal(false);
        // setIsFormChangedFirstTab(true);
        // setIsFormChangedSecondTab(true);
        setButtonDisableFirst(false)
        setButtonDisableSecond(false)

      })
      .catch(console.error);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm(formData, activeTab)) return;

    if (activeTab === 1 || (activeTab === 2 && !formData.login_email.trim())) {
      setActiveTab(activeTab + 1);
      return;
    }

    if (activeTab === 2 && !formData.login_email.trim()) {
      setErrors((prev) => ({
        ...prev,
        login_email: "Login email is required"
      }));
      return;
    }
    if (
      activeTab === 3 &&
      (!formData.full_name.trim() ||
        !formData.general_contact.trim() ||
        !formData.general_email.trim())
    ) {
      setErrors({
        full_name: formData.full_name ? "" : "Full name is required",
        general_contact: formData.general_contact
          ? ""
          : "General contact is required",
        general_email: formData.general_email ? "" : "General email is required"
      });
      return;
    }

    const payload = new FormData();
    payload.append("is_org_member", String(formData.is_org_member));
    payload.append("unit", String(formData.unit));
    payload.append(
      "unit_staff_status",
      formData.unit_staff_status ? "true" : "false"
    );

    if (formData.member_id) {
      payload.append("member_id", String(formData.member_id));
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
        payload.append("member.date_of_birth", formData.date_of_birth);
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

    dispatch(createUnitStaff(payload));
  };

  useEffect(() => {
    if (success) setShowSuccess(true);
  }, [success]);

  const handleOk = () => {
    const unitId = selectedUnit?.id || formData.unit || id;
    dispatch(resetUnitStaffState());
    navigate(`/unit-details/${unitId}?tab=4`, {
      replace: true
    });
  };

  const handleTabChange = (toTab) => {
    if (!validateForm(formData, activeTab)) return;
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
      const permissionGranted = await checkPermission("org", 22);
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
          onClick={() => navigate(`/unit-details/${id}?tab=4`)}
          className="inline-flex cursor-pointer items-center gap-3 text-ink transition-colors hover:text-primary"
        >
          <ArrowHeading title="Add Unit Staff" size="2xl" color="text-black" />
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
          clearMessage={() => dispatch(resetUnitStaffState())}
        />
      )}
      {showSuccess && (
        <MessageBox
          message="New Unit Staff has been successfully added."
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
                  {/* <fieldset disabled={autofillDisabled}> */}
                  <MemberMainForm
                    key={formKey} 
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
                    <ArrowHeading title="Unit Staff Information" size="xl" />
                  </Div>
                  <div className="mr-[10px] mb-4">
                    <div className="mb-3">
                      <h2 className="text-sm font-semibold text-textDark uppercase tracking-wide">Status</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {["Live-in", "Part-time"].map((status) => (
                        <label key={status} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="unit_staff_status"
                            value={status === "Live-in"}
                            checked={
                              status === "Live-in"
                                ? formData.unit_staff_status
                                : !formData.unit_staff_status
                            }
                            onChange={() =>
                              setFormData({
                                ...formData,
                                unit_staff_status: status === "Live-in"
                              })
                            }
                            className="w-6 h-6 px-2 accent-primary"
                          />
                          <span>{status}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {formData.login_email.trim() ? (
                    <SubmitButton text="Submit" width="full" type="submit" />
                  ) : (
                    <TabButton
                      label="Next"
                      tabIndex={3}
                      handleTabChange={handleTabChange}
                      disable={buttonDisableSecond}
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

export default AddUnitStaff;
