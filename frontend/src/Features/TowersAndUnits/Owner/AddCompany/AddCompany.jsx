import { useEffect, useState } from "react";
import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import MemberMainForm from "../../../Members/MemberMainForm/MemberMainForm";
import { memberFields } from "utils/formFields";
import { Div } from "Components/Ui/Div";
import { Span } from "Components/Ui/Span";
import ArrowHeading from "Components/HeadingComponent/ArrowHeading";
import TabButton from "Components/FormComponent/ButtonComponent/TabButton";
import SubmitButton from "Components/FormComponent/ButtonComponent/SubmitButton";
import { FaAddressBook, FaPlus } from "react-icons/fa";
import NavigateButton from "Components/FormComponent/ButtonComponent/NavigateButton";
import { RxCross1 } from "react-icons/rx";

// Redux & utils
import { useDispatch, useSelector } from "react-redux";
import useHandleFileChange from "utils/useHandleFileChange";
import useHandleChange from "utils/useHandleChange";
import { Link, useNavigate } from "react-router-dom";
import { memberfetchRoles } from "../../../../redux/slices/roles/rolesSlice";
import { fetchMemberTypes } from "../../../../redux/slices/api/memberApi";
import { checkPermission } from "../../../../utils/permissionUtils";

// Components
import Heading from "Components/HeadingComponent/Heading";

import useCompanyValidation from "../../../TowersAndUnits/Owner/AddCompany/useCompanyValidation";
import useCompanySubmit from "../../../TowersAndUnits/Owner/AddCompany/useCompanySubmit";
import ModernLoadingAnimation from "../../../../Components/Loaders/ModernLoadingAnimation";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import MemberSideForm from "../../../Members/MemberSideForm/MemberSideForm";
import useMemberSelections from "../../../Members/OrganizationMemberForm/useMemberSelections";
import TextInputComponent from "../../../../Components/FormComponent/TextInputComponent";
import PhoneNumberInput from "../../../../Components/FormComponent/PhoneNumberInput";
import ErrorMessage from "../../../../Components/MessageBox/ErrorMessage";
import LoginCredential from "../../../Login/LoginCredential/LoginCredential";
import CompanyList from "./CompanyList";
import { showCompanyList } from "../../../../redux/slices/api/companyApi";
import { clearMessage } from "../../../../redux/slices/companySlice";
import axios from "axios";
import isEqual from "lodash/isEqual";

const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_API
});

const AddCompany = ({ isOpen, onClose, fields }) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState(1);
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const { unitId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [companyError, setCompanyError] = useState(null);
  const [isFormDisabled, setIsFormDisabled] = useState(false);

  const [formData, setFormData] = useState({
    member_type: [],
    members_role: [],
    is_org_member: 1
  });

  const [hasPermission, setHasPermission] = useState(false);
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

  useEffect(() => {
    activeTab === 1 && setButtonDisableFirst(isEqual(isFormChangedFirstTab, {}));
    activeTab === 2 && setButtonDisableSecond(isEqual(isFormChangedSecondTab, {}));
    // console.log(isFormChangedSecondTab)
  }, [isFormChangedFirstTab, isFormChangedSecondTab]);
  // const { handleChange } = useHandleChange(setFormData);
  const dispatch = useDispatch();
  // const useSelector = useSelector();
  const { company } = useSelector((state) => state.company || {});

  // console.log(company)
  // const { roles } = useSelector((state) => state.role || {});
  // const { memberTypes } = useSelector((state) => state.member || {});

  // useEffect(() => {
  //   if (!roles.length || roles.some((role) => !role.is_active)) {
  //     dispatch(memberfetchRoles());
  //   }
  //   if (!memberTypes.length) {
  //     dispatch(fetchMemberTypes());
  //   }
  // }, [dispatch, roles, memberTypes]);

  const { errors, validateForm, setErrors } = useCompanyValidation();
  const { handleFileChange, handleFile3, nidFront, nidBack } =
    useHandleFileChange(setFormData, getSetIsFormChangedByTab());

  //  if (ownerState.createdMember) {
  //       // Check if member already exists in any ownership block
  //       const isDuplicate = fields.some(
  //         (_, index) =>
  //           watch(`owners.${index}.memberId`) === ownerState.createdMember.id
  //       );

  // useEffect(() => {
  //   console.log(formData)
  //   // console.log(formData.login_email)
  // }, [formData]);

  useEffect(() => {
    const fetchPermission = async () => {
      const permissionGranted = await checkPermission("org", 1);
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };
    fetchPermission();
  }, []);

  useEffect(() => {
    dispatch(showCompanyList(searchParams.get("search")));
  }, [searchParams.get("search")]);

  const {
    handleSubmitCompany,
    loading,
    showMessage,
    message,
    error,
    handleDismissMessage
  } = useCompanySubmit(formData, validateForm, activeTab, unitId, onClose);

  if (loadingPermission) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
        <ModernLoadingAnimation />
      </div>
    );
  }

  if (!hasPermission) {
    navigate("/not-authorized");
  }

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
  };

  // const handleRoleCreated = (newRole) => {
  //   dispatch(memberfetchRoles());
  //   setActiveTab(2);
  //   setSelectedRoleValues((prev) => [...prev, newRole.id]);
  //   setFormData((prev) => ({
  //     ...prev,
  //     members_role: [...prev.members_role, newRole.id]
  //   }));
  // };
  const getFullUrl = (url) =>
    url && !/^https?:\/\//i.test(url) ? `${api.defaults.baseURL}${url}` : url;

  const handleAddData = (items) => {
    // Clear previous errors first
    setErrors({});

    // Check for duplicate member
    const isDuplicate = fields.some(
      (field) => field.memberId === items.member.id
    );

    if (isDuplicate) {
      setCompanyError("This company has already been added as an owner.");
      setShowModal(false);
    }

    // No duplicate, update formData
    setFormData((prev) => {
      const updatedData = {
        ...prev,
        company_name: items.company_name || "",
        full_name: items.member?.full_name || "",
        general_contact: items.member?.general_contact || "",
        general_email: items.member?.general_email || "",
        member_id: items.member?.id || "",
        unit: items.unit || "",
        photo: getFullUrl(items.member?.photo) || "",
        about_us: items.member?.about_us || "",
        facebook_profile: items.member?.facebook_profile || "",
        linkedin_profile: items.member?.linkedin_profile || "",
        present_address: items.member?.present_address || "",
        delivery_method: items.member?.login_email || items.member?.login_contact || "",
        is_first_login: items.member?.is_first_login || '',
      };

      if (items.member?.login_email) {
        updatedData.login_email = items.member.login_email;
      }

      if (items.member?.login_contact) {
        updatedData.login_contact = items.member.login_contact;
      }

      return updatedData;
    });
    setIsFormDisabled(true);
    setShowModal(false);
    setSearchParams("");
    // setIsFormChangedFirstTab(true);
    // setIsFormChangedSecondTab(true);
    setButtonDisableFirst(false)
    setButtonDisableSecond(false)
  };
  // useEffect(() => {
  //   if (isOpen) {

  //     setIsFormDisabled(false);

  //   }
  // }, [isOpen]);

  const handleCompanyList = () => {
    dispatch(showCompanyList());
    setShowModal(true);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-start z-50 pt-2 sm:pt-10 overflow-y-auto p-2 sm:p-0">
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-[60]">
          <ModernLoadingAnimation />
        </div>
      )}
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg w-full max-w-6xl relative mx-2 sm:mx-0">
        {/* <button
          onClick={onClose}
          className="absolute   top-0 right-0 text-white rounded-lg bg-primary px-2 py-1"
        >
          ✕
        </button> */}
        <button
          onClick={onClose}
          className="absolute -top-[8px] -right-[8px] p-2 rounded-full bg-primary text-white shadow-md hover:bg-primary/90 transition z-20"
        >
          <RxCross1 />
        </button>

        <Div className="container">
          {(showMessage || companyError) && (
            <MessageBox
              message={message}
              error={error || companyError}
              clearMessage={handleDismissMessage}
              onOk={() => {
                if (!error || companyError) {
                  setCompanyError(null);
                  onClose(false);
                }

                dispatch(clearMessage());
              }}
            />
          )}

          <form onSubmit={handleSubmitCompany} autoComplete="off">


            <input
              type="hidden"
              name="is_org_member"
              value={formData.is_org_member}
            />

            <Div className="flex flex-col lg:flex-row items-stretch bg-white rounded-xl mb-4 mt-1">
              <Div className="bg-white p-4 sm:p-5 rounded-tl-xl rounded-bl-xl lg:rounded-bl-none lg:rounded-tr-none h-full">
                <MemberSideForm
                  memberFields={memberFields}
                  formData={formData}
                  setFormData={setFormData}
                  handleChange={handleChange}
                  onFileChange={handleFile3}
                  allowedTypes={["image/jpeg", "image/png", "image/jpg"]}
                  errorMessage="Please upload a valid image"
                  savedPhoto={formData.photo}
                  disabled={isFormDisabled}
                />
              </Div>
              <div className="hidden lg:block w-px bg-borderLight" />
              <Div className="bg-white p-4 sm:p-5 rounded-tr-xl rounded-br-xl lg:rounded-tl-none lg:rounded-bl-none lg:w-[787px] w-full mt-6 lg:mt-0">
                {activeTab === 1 && (
                  <Div>
                    <Div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 gap-2 sm:gap-0">
                      <Heading
                        title="General Information"
                        size="lg"
                        color="text-black"
                      />

                      {activeTab === 1 && (
                        // <NavigateButton
                        //   size="medium"
                        //   icon={FaPlus}
                        //   className="bg-primary text-white"
                        // >
                        //   Add Existing Company
                        // </NavigateButton>
                        <>
                          {/* <button
                            type="button"
                            onClick={
                              handleCompanyList
                            }
                            className="flex items-center justify-center py-4 rounded bg-primary text-white py-2 px-[8px] text-base"
                          >
                            <FaPlus className="mr-2" />
                            Add Existing Company
                          </button> */}
                        </>
                      )}
                    </Div>

                    <TextInputComponent
                      value={formData.company_name || ""}
                      onChange={handleChange}
                      name="company_name"
                      label={
                        <Span>
                          Company Name
                          <Span className="text-red-500">*</Span>
                        </Span>
                      }
                      placeholder="Company Name"
                      field="Company Name"
                      disabled={isFormDisabled}
                    />
                    <ErrorMessage message={errors.company_name} />

                    {/* Email */}
                    <TextInputComponent
                      value={formData.general_email || ""}
                      onChange={handleChange}
                      name={memberFields.general_email.name}
                      label={
                        <Span>
                          {memberFields.general_email.label}{" "}
                          <Span className="text-red-500">*</Span>
                        </Span>
                      }
                      placeholder={memberFields.general_email.label}
                      field={memberFields.general_email}
                      disabled={isFormDisabled}
                    />
                    <ErrorMessage message={errors.general_email} />

                    {/* Contact Number */}
                    <PhoneNumberInput
                      value={formData.general_contact || ""}
                      onChange={handleChange}
                      name={memberFields.general_contact.name}
                      label={
                        <Span>
                          {memberFields.general_contact.label}{" "}
                          <Span className="text-red-500">*</Span>
                        </Span>
                      }
                      placeholder={memberFields.general_contact.label}
                      disabled={isFormDisabled}
                      error={errors.general_contact}
                    />
                    {/* Addresses */}
                    <TextInputComponent
                      value={formData.present_address || ""}
                      onChange={handleChange}
                      name={memberFields.present_address.name}
                      label={memberFields.present_address.label}
                      placeholder={memberFields.present_address.label}
                      field={memberFields.present_address}
                      disabled={isFormDisabled}
                    />

                    {formData.login_email || formData.login_contact ? (
                      <input
                        type="submit"
                        className="bg-primary text-white py-2 mt-3 px-4 w-full rounded"
                        value="Submit"
                      />
                    ) : (
                      <input
                        type="button"
                        onClick={() => handleTabChange(2)}
                        className={`py-2 mt-3 px-4 w-full rounded  bg-primary text-white
                            ${!buttonDisableFirst ? " cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
                        value="Next"
                        disabled={buttonDisableFirst}
                      />
                    )}

                    {/* <TabButton
                      label="Next"
                      tabIndex={2}
                      handleTabChange={handleTabChange}
                    /> */}
                  </Div>
                )}

                {activeTab === 2 && (!formData.login_email || !formData.login_contact) && (
                  <Div>
                    <LoginCredential
                      formData={formData}
                      setFormData={setFormData}
                      memberFields={memberFields}
                      onNext={() => handleTabChange(1)}
                      errors={errors}
                    />

                    <input
                      type="submit"
                      className="bg-primary text-white py-2 mt-3 px-4 w-full rounded"
                      value="Submit"
                    />
                  </Div>
                )}
              </Div>
            </Div>
          </form>
        </Div>
      </div>

      <CompanyList
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        company_data={company.company}
        onSelect={handleAddData}
      />
    </div>
  );
};

export default AddCompany;
