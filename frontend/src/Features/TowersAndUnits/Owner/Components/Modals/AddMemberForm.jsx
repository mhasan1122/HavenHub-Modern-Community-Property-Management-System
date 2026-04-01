import { useEffect, useState } from "react";
import { memberFields } from "utils/formFields";
import { Div } from "Components/Ui/Div";
import SubmitButton from "Components/FormComponent/ButtonComponent/SubmitButton";
import { FaPlus } from "react-icons/fa";
import { FiX } from "react-icons/fi";
import NavigateButton from "Components/FormComponent/ButtonComponent/NavigateButton";
import { useDispatch } from "react-redux";
import useHandleFileChange from "utils/useHandleFileChange";
import useHandleChange from "utils/useHandleChange";
import { useNavigate } from "react-router-dom";
import MessageBox from "../../../../../Components/MessageBox/MessageBox";
import ModernLoadingAnimation from "../../../../../Components/Loaders/ModernLoadingAnimation";
import MemberSideForm from "../../../../Members/MemberSideForm/MemberSideForm";
import MemberMainForm from "../../../../Members/MemberMainForm/MemberMainForm";
import LoginCredential from "../../../../Login/LoginCredential/LoginCredential";
import { checkPermission } from "../../../../../utils/permissionUtils";
import useMemberSubmit from "../../hooks/useMemberSubmit.js";
import useMemberValidation from "../../hooks/useMemberValidation.js";
import {
  addExistingMemberForOwner,
  setCreatedMember
} from "../../../../../redux/slices/owner/ownerSlice";
import AddExistingMemberTable from "../../../../../Components/AddExistingMemberTable/AddExistingMemberTable";
import { RxCross1 } from "react-icons/rx";
import isEqual from 'lodash/isEqual';
import { updateChangedFields } from "../../../../../utils/updateFileChange.js";

const baseURL = import.meta.env.VITE_BASE_API;

const AddMemberForm = ({ isOpen, onClose, unitId }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [formData, setFormData] = useState(getInitialFormState());
  const [activeTab, setActiveTab] = useState(1);
  const [showCommMemberProfile, setShowCommMemberProfile] = useState(false);
  const [hasLoginCredential, setHasLoginCredential] = useState(false);
  const [isFormDisabled, setIsFormDisabled] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);
  const [isFormChangedFirstTab, setIsFormChangedFirstTab] = useState({});
  const [isFormChangedSecondTab, setIsFormChangedSecondTab] = useState({});
  const [buttonDisableFirst, setButtonDisableFirst] = useState(false);
  const [buttonDisableSecond, setButtonDisableSecond] = useState(false);
  const getSetIsFormChangedByTab = () => {
    if (activeTab === 1) return setIsFormChangedFirstTab;
    if (activeTab === 2) return setIsFormChangedSecondTab;
    // if (activeTab === 3) return setIsFormChangedThirdTab;
    return () => { };
  };

  const { handleChange } = useHandleChange(setFormData, getSetIsFormChangedByTab());
  const [autofillDisabled, setAutofillDisabled] = useState(false);


  useEffect(() => {
    activeTab === 1 && setButtonDisableFirst(isEqual(isFormChangedFirstTab, {}));
    activeTab === 2 && setButtonDisableSecond(isEqual(isFormChangedSecondTab, {}));
    console.log(isFormChangedFirstTab, buttonDisableFirst)

  }, [
    isFormChangedFirstTab,
    isFormChangedSecondTab
  ]);


  const { handleFileChange } = useHandleFileChange(setFormData, getSetIsFormChangedByTab());
  const { errors, validateForm, setErrors } = useMemberValidation();
  const {
    handleSubmit,
    loading,
    showMessage,
    message,
    error,
    handleDismissMessage
  } = useMemberSubmit(formData, validateForm, activeTab);

  function getInitialFormState() {
    return {
      is_org_member: 1,
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
      photo: "",
      nid_front: "",
      nid_back: "",
      nid_number: "",
      login_email: "",
      previewPhoto: undefined,
      previewNidFront: undefined,
      previewNidBack: undefined
    };
  }

  useEffect(() => {
    const checkPermissions = async () => {
      const granted = await checkPermission("org", 1);
      // console.log("Permissions granted:", granted);
      if (!granted) return navigate("/not-authorized");
      setLoadingPermission(false);
    };
    checkPermissions();
  }, [navigate]);


  useEffect(() => {
    dispatch(addExistingMemberForOwner());
  }, [dispatch]);

  useEffect(() => {
    if (isOpen) {


      setErrors({})
      setFormData(getInitialFormState());
      setActiveTab(1);
      setShowCommMemberProfile(false);
      setIsFormDisabled(false);
      setHasLoginCredential(false);
      // setIsFormChangedFirstTab(false) 

      setIsFormChangedFirstTab({})
      setIsFormChangedSecondTab({})

    }
  }, [isOpen]);

  const handleSelectMember = (member) => {
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
      login_email: member.login_email || "",
      previewPhoto: member.photo ? `${baseURL}${member.photo}` : undefined,
      previewNidFront: member.nid_front
        ? `${baseURL}${member.nid_front}`
        : undefined,
      previewNidBack: member.nid_back
        ? `${baseURL}${member.nid_back}`
        : undefined
    }));
    setHasLoginCredential(!!member.login_email);
    setShowCommMemberProfile(false);
    // setIsFormDisabled(true);
    setAutofillDisabled(true);
    setButtonDisableFirst(false)
    setButtonDisableSecond(false)

  };

  const prepareAndSubmit = (e) => {
    e.preventDefault();
    if (!validateForm(formData, activeTab)) {
      return;
    }
    if (!hasLoginCredential && activeTab === 1) {
      return setActiveTab(2);
    }

    const cleaned = { ...formData };

    ["photo", "nid_front", "nid_back"].forEach((key) => {
      if (!(cleaned[key] instanceof File)) {
        const previewKey =
          "preview" + key.charAt(0).toUpperCase() + key.slice(1);
        if (cleaned[previewKey]?.startsWith(baseURL)) {
          cleaned[key] = cleaned[previewKey].replace(baseURL, "");
        } else {
          cleaned[key] = "";
        }
      }
    });

    Object.keys(cleaned).forEach((key) => {
      if (key.startsWith("preview")) delete cleaned[key];
    });

    const fd = new FormData();
    const appendIfPresent = (key, value) => {
      if (value !== undefined && value !== null && value !== "") {
        fd.append(key, value);
      }
    };

    fd.append("is_org_member", cleaned.is_org_member);
    fd.append("full_name", cleaned.full_name);
    fd.append("general_email", cleaned.general_email);
    fd.append("general_contact", cleaned.general_contact);
    [
      "permanent_address",
      "present_address",
      "date_of_birth",
      "occupation",
      "gender",
      "marital_status",
      "religion",
      "about_us",
      "facebook_profile",
      "linkedin_profile",
      "nid_number",
      "photo",
      "nid_front",
      "nid_back",
      "login_email"
    ].forEach((key) => appendIfPresent(key, cleaned[key]));

    handleSubmit({ preventDefault: () => { } }, fd);
  };

  if (loadingPermission) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-[60]">
        <ModernLoadingAnimation />
      </div>
    );
  }

  if (!isOpen && !showMessage) return null;

  {
    showMessage && (
      <MessageBox
        message={message}
        error={error}
        clearMessage={handleDismissMessage}
        onOk={() => {
          // if (message) navigate("/member-list");

          if (!error) {
            onClose(false);
          }

          dispatch(clearMessage());
        }}
      />
    );
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" />
          {loading && (
            <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-[60]">
              <ModernLoadingAnimation />
            </div>
          )}
          <div className="flex items-center justify-center min-h-screen p-2 sm:p-4 text-center sm:block">
            <div className="inline-block bg-white rounded-lg text-left shadow-xl w-full max-w-6xl relative mx-2 sm:mx-0">
              <button
                onClick={onClose}
                className="absolute -top-[8px] -right-[8px] p-2 rounded-full bg-primary text-white shadow-md hover:bg-primary/90 transition z-20"
              >
                <RxCross1 />
              </button>
              <Div className="h-full p-4 sm:p-6">
                <Div className="container">
                  <Div className="flex justify-between py-2 px-3 sm:px-5">
                    <h2 className="text-base sm:text-lg text-primary">Add New Comm Member</h2>
                    {/* {activeTab === 1 && (
                      <NavigateButton
                        icon={FaPlus}
                        className="bg-primary text-white"
                        onClick={() => setShowCommMemberProfile(true)}
                      >
                        Add Existing Member
                      </NavigateButton>
                    )} */}
                  </Div>



                  <form onSubmit={prepareAndSubmit} autoComplete="off">
                    <Div className="flex flex-col lg:flex-row items-stretch bg-white rounded-xl mb-4 mt-1">
                      <Div className="bg-white p-4 sm:p-5 rounded-tl-xl rounded-bl-xl lg:rounded-bl-none lg:rounded-tr-none h-full">
                        {/* <fieldset
                        disabled={isFormDisabled}
                        className={isFormDisabled ? "bg-gray-50" : ""}
                      > */}
                        <MemberSideForm
                          memberFields={memberFields}
                          formData={formData}
                          setFormData={setFormData}
                          handleChange={handleChange}
                          onFileChange={handleFileChange}
                          allowedTypes={[
                            "image/jpeg",
                            "image/jpg",
                            "image/png"
                          ]}
                          savedPhoto={
                            formData.photo instanceof File
                              ? undefined
                              : formData.previewPhoto
                          }
                          disabled={autofillDisabled}

                        />
                        {/* </fieldset> */}
                      </Div>
                      <div className="hidden lg:block w-px bg-borderLight" />
                      <Div className="bg-white p-4 sm:p-5 rounded-tr-xl rounded-br-xl lg:rounded-tl-none lg:rounded-bl-none lg:w-[787px] w-full mt-6 lg:mt-0">
                        {activeTab === 1 && (
                          <>
                            {/* <fieldset
                              disabled={isFormDisabled}
                              className={isFormDisabled ? "bg-gray-50" : ""}
                            > */}
                            <MemberMainForm
                              formData={formData}
                              setFormData={setFormData}
                              memberFields={memberFields}
                              errors={errors}
                              handleChange={handleChange}
                              onFileChange={handleFileChange}
                              savedFront={
                                formData.nid_front instanceof File
                                  ? undefined
                                  : formData.previewNidFront
                              }
                              savedBack={
                                formData.nid_back instanceof File
                                  ? undefined
                                  : formData.previewNidBack
                              }
                              disabled={autofillDisabled}
                              setIsFormChangedFirstTab={setIsFormChangedFirstTab}
                            />
                            {/* </fieldset> */}
                            <SubmitButton
                              text={hasLoginCredential ? "Submit" : "Next"}
                              width="full"
                              // disabled={!isFormChangedFirstTab}
                              // disable={buttonDisableFirst} 
                              isFormChange={buttonDisableFirst}

                            />
                          </>
                        )}
                        {activeTab === 2 && !hasLoginCredential && (
                          <>
                            <fieldset
                              disabled={autofillDisabled && hasLoginCredential}
                              className={
                                autofillDisabled && hasLoginCredential
                                  ? "bg-gray-50"
                                  : ""
                              }
                            >
                              <LoginCredential
                                formData={formData}
                                setFormData={setFormData}
                                memberFields={memberFields}
                                onNext={() => setActiveTab(1)}
                                errors={errors}
                              />
                            </fieldset>
                            <SubmitButton text="Submit" width="full" />
                          </>
                        )}
                      </Div>
                    </Div>
                  </form>
                </Div>
              </Div>
            </div>
          </div>
        </div>
      )}
      {showCommMemberProfile && (
        <AddExistingMemberTable
          isOpen={showCommMemberProfile}
          onClose={() => setShowCommMemberProfile(false)}
          onSelectMember={handleSelectMember}
          useAddMemberAPI={true}
        />
      )}
    </>
  );
};

export default AddMemberForm;
