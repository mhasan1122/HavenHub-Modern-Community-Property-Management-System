import { useEffect, useState } from "react";
import { memberFields } from "utils/formFields";
import TabButton from "Components/FormComponent/ButtonComponent/TabButton";
import { FaPlus } from "react-icons/fa";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Div } from "../../../../Components/Ui/Div";
import ArrowHeading from "../../../../Components/HeadingComponent/ArrowHeading";
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
  fetchMemberDetails,
} from "../../../../redux/slices/residents/residentSlice";
import LoadingAnimation from "Components/Loaders/LoadingAnimation";
import { fetchUnitById } from "../../../../redux/slices/units/unitSlice";
import AddExistingMemberTable from "../../../../Components/AddExistingMemberTable/AddExistingMemberTable";
import axiosInstance from "../../../../utils/axiosInstance";
import ClearForm from "Components/FormComponent/ButtonComponent/ClearForm";

const AddResident = () => {
  const [activeTab, setActiveTab] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showExistingModal, setShowExistingModal] = useState(false);
  const [buttonDisable, setButtonDisable] = useState(true); // Start disabled since form is empty
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { id } = useParams();
  const { loading, error, success } = useSelector((state) => state.resident);
  const { selectedUnit } = useSelector((state) => state.unit);

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
    unit: 0,
    is_resident_or_tenant: true,
    unit_rent_fee: 0,
    advance_payment: 0,
    notice_period: 0,
    docs: [],
  };

  const [formData, setFormData] = useState(initialFormState);

  // Check if form has any data to enable/disable Clear Form button
  useEffect(() => {
    // Fields to exclude from the "has data" check (hidden/system fields)
    const excludeFields = [
      'is_org_member', 
      'unit', 
      'is_resident_or_tenant', 
      'member_id',
      'unit_rent_fee',
      'advance_payment',
      'notice_period'
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
  };

  const { errors, validateForm, setErrors } = useResidentValidation();
  const { handleFileChange, handleFile3 } = useHandleFileChange(setFormData);

  const getFullUrl = (url) =>
    url && !url.startsWith("http")
      ? `${axiosInstance.defaults.baseURL || "http://127.0.0.1:8000"}${url}`
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
          nid_back: getFullUrl(data.nid_back) || null,
        }));
        setShowExistingModal(false);
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
        setErrors((prev) => ({ ...prev, login_email: "Login email is required" }));
        return;
      }
      // If login_email exists, we allow direct submission from tab 2.
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
          general_email: !formData.general_email.trim() ? "General email is required" : "",
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
    } else {
      payload.append("member.full_name", formData.full_name);
      payload.append("member.general_contact", formData.general_contact);
      payload.append("member.general_email", formData.general_email);
      if (formData.nid_number) payload.append("member.nid_number", formData.nid_number);
      if (formData.date_of_birth) payload.append("member.date_of_birth", formData.date_of_birth);
      if (formData.occupation) payload.append("member.occupation", formData.occupation);
      if (formData.gender) payload.append("member.gender", formData.gender);
      if (formData.marital_status) payload.append("member.marital_status", formData.marital_status);
      if (formData.delivery_method) payload.append("member.delivery_method", formData.delivery_method);
      if (formData.permanent_address)
        payload.append("member.permanent_address", formData.permanent_address);
      if (formData.present_address)
        payload.append("member.present_address", formData.present_address);
      if (formData.about_us) payload.append("member.about_us", formData.about_us);
      if (formData.facebook_profile)
        payload.append("member.facebook_profile", formData.facebook_profile);
      if (formData.linkedin_profile)
        payload.append("member.linkedin_profile", formData.linkedin_profile);
      if (formData.photo) payload.append("member.photo", formData.photo);
      if (formData.nid_front) payload.append("member.nid_front", formData.nid_front);
      if (formData.nid_back) payload.append("member.nid_back", formData.nid_back);
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

  // Updated handleOk: after showing the message box, redirect to the Unit Details' Residents tab.
  const handleOk = () => {
    const unitId = selectedUnit?.id || formData.unit || id;
    dispatch(resetResidentState());
    navigate(`/unit-details/${unitId}?tab=3`);
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
  };

  // Handle Clear Form
  const handleResetFormData = () => {
    setFormData({
      ...initialFormState,
      unit: selectedUnit?.id || 0, // Preserve the unit ID
    });
    setErrors({});
    setActiveTab(1);
  };

  return (
    <Div className="h-full">
      <Div className="container">
        <Div className="md:flex justify-between py-2">
          <Link to={`/unit-details/${id}`}>
            <ArrowHeading title="Add Resident" size="xl" />
          </Link>
          {activeTab === 1 && (
            <div className="flex items-center gap-2">
              <ClearForm 
                onClick={handleResetFormData} 
                disabled={buttonDisable} 
              />
              <NavigateButton
                size="medium"
                icon={FaPlus}
                className="bg-primary text-white"
                onClick={() => setShowExistingModal(true)}
              >
                Add Existing Member
              </NavigateButton>
            </div>
          )}
        </Div>

        {error && (
          <MessageBox
            message={error}
            error
            clearMessage={() => dispatch(resetResidentState())}
          />
        )}
        {showSuccess && (
          <MessageBox
            message="Resident added successfully!"
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

        <form onSubmit={handleSubmit} autoComplete="off" encType="multipart/form-data">
          {loading && (
            <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
              <LoadingAnimation />
            </div>
          )}
          <input type="hidden" name="is_org_member" value={formData.is_org_member} />

          <Div className="flex">
            <MemberSideForm
              formData={formData}
              setFormData={setFormData}
              memberFields={memberFields}
              errors={errors}
              handleChange={handleChange}
              onFileChange={handleFile3}
              allowedTypes={["image/jpeg", "image/png", "image/jpg"]}
              errorMessage="Please upload a valid image"
              savedPhoto={formData.photo}
            />
            <Div className="bg-white border-l p-5 rounded-tr-xl rounded-br-xl shadow-sm lg:w-[787px]">
              {activeTab === 1 && (
                <Div>
                  <MemberMainForm
                    formData={formData}
                    setFormData={setFormData}
                    memberFields={memberFields}
                    errors={errors}
                    handleChange={handleChange}
                    onFileChange={handleFileChange}
                    savedFront={formData.nid_front}
                    savedBack={formData.nid_back}
                  />
                  <TabButton label="Next" tabIndex={2} handleTabChange={handleTabChange} />
                </Div>
              )}

              {activeTab === 2 && (
                <Div>
                  <Div
                    className="md:flex justify-between py-2 cursor-pointer"
                    onClick={() => handleTabChange(1)}
                  >
                    <ArrowHeading title="Resident Information" size="md" />
                  </Div>
                  <ResidentCheck
                    formData={formData}
                    setFormData={setFormData}
                    handleChange={handleChange}
                  />
                  {formData.login_email.trim() ? (
                    <SubmitButton text="Submit" width="full" type="submit" />
                  ) : (
                    <TabButton label="Next" tabIndex={3} handleTabChange={handleTabChange} />
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
      </Div>
    </Div>
  );
};

export default AddResident;
