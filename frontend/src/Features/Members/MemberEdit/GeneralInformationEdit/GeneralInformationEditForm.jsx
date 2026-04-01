// src/your/path/GeneralInformationEditForm.jsx
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Formik, Form } from "formik";
import * as Yup from "yup";
import { Div } from "../../../../Components/Ui/Div";
import SideSectionEdit from "./SideSectionEdit";
import MainSectionEdit from "./MainSectionEdit";
import ArrowHeading from "../../../../Components/HeadingComponent/ArrowHeading";
import Heading from "../../../../Components/HeadingComponent/Heading";
import NidSectionEdit from "./NidSectionEdit";
import SubmitButton from "Components/FormComponent/ButtonComponent/SubmitButton";

import {
  fetchMemberById,
  memberUpdate
} from "../../../../redux/slices/api/memberApi";
import {
  setMessage,
  setError,
  clearMessage
} from "../../../../redux/slices/memberSlice";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import ModernLoadingAnimation from "../../../../Components/Loaders/ModernLoadingAnimation";
import { setActiveTabs } from "../../../../redux/slices/companySlice";
import { setUser } from "../../../../redux/slices/authSlice/authSlice";

const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
const errorMessage = "Only JPG, JPEG, PNG allowed.";

const validationSchema = Yup.object({
  full_name: Yup.string().required("Full name is required"),
  general_email: Yup.string()
    .email("Invalid email")
    .required("Email is required"),
  general_contact: Yup.string()
    .matches(/^\d+$/, "Contact number must contain only digits")
    .max(11, "Contact number cannot be more than 11 digits")
    .required("Contact number is required")
});

const GeneralInformationEditForm = () => {
  const [showMessage, setShowMessage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isFormChanged, setIsFormChanged] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();


  const dispatch = useDispatch();
  const { selectedMember, message, error } = useSelector(
    (state) => state.member
  );

  const [fileErrors, setFileErrors] = useState({
    photo: "",
    nid_front: "",
    nid_back: ""
  });

  const [formData, setFormData] = useState({
    full_name: "",
    general_email: "",
    general_contact: "",
    nid_number: "",
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
    nid_back: ""
  });

  useEffect(() => {
    dispatch(fetchMemberById(id));
  }, [dispatch, id]);

  // Helper function to format date from backend (DD-MMM-YYYY) to HTML date input format (YYYY-MM-DD)
  const formatDateForInput = (dateString) => {
    if (!dateString) return "";

    try {
      // If already in YYYY-MM-DD format, return as is
      if (typeof dateString === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
      }

      // Try to parse the date (handles DD-MMM-YYYY format from backend)
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

  useEffect(() => {
    if (selectedMember?.member) {
      const memberData = { ...selectedMember?.member };
      // Convert date_of_birth to YYYY-MM-DD format for HTML date input
      if (memberData.date_of_birth) {
        memberData.date_of_birth = formatDateForInput(memberData.date_of_birth);
      }
      setFormData(memberData);
    }
  }, [selectedMember?.member]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setIsFormChanged(true);
  };

  const handleFileChange = (e, fieldName) => {
    const file = e.target.files[0];
    setFileErrors((prev) => ({ ...prev, [fieldName]: "" }));
    if (file) {
      if (!allowedTypes.includes(file.type)) {
        setFileErrors((prev) => ({ ...prev, [fieldName]: errorMessage }));
        return;
      }
      setFormData((prev) => ({ ...prev, [fieldName]: file }));
      setIsFormChanged(true);
    }
  };

  const removeFile = (fieldName) => {
    setFormData((prev) => ({ ...prev, [fieldName]: "" }));
    setIsFormChanged(true);
  };

  const handleSubmit = async (values) => {
    const body = new FormData();
    // Use formData instead of values to ensure all fields including facebook_profile and linkedin_profile are included
    const dataToSubmit = { ...formData, ...values };
    Object.keys(dataToSubmit).forEach((key) => {
      if (key === "photo_low_quality") return;
      const val = dataToSubmit[key];
      if (["photo", "nid_front", "nid_back"].includes(key)) {
        if (val instanceof File || val instanceof Blob) {
          body.append(key, val);
        } else if (val === "") {
          body.append(`${key}_removed`, "Removed");
        }
      } else if (key === "date_of_birth") {
        // Convert date from YYYY-MM-DD to DD-MMM-YYYY format for backend
        body.append(key, formatDateForBackend(val) || "");
      } else {
        body.append(key, val || "");
      }
    });

    setLoading(true);
    try {
      const resultAction = await dispatch(memberUpdate({ id, formData: body }));
      if (memberUpdate.fulfilled.match(resultAction)) {
        dispatch(setMessage("Member updated successfully!"));
        setShowMessage(true);
        setIsFormChanged(false);

        // Sync auth.user if the updated member is the current logged-in user
        try {
          const updatedMember = resultAction.payload?.member || resultAction.payload;
          const authUserRaw = localStorage.getItem("user");
          const authUser = authUserRaw ? JSON.parse(authUserRaw) : null;
          if (authUser && updatedMember && String(authUser.id) === String(updatedMember.id)) {
            dispatch(setUser(updatedMember));
          }
        } catch (_) { }
      } else {
        // Extract server validation errors if available
        let errorMsg = resultAction.error.message || "Failed to update member.";
        const payload = resultAction.payload;
        if (payload && typeof payload === "object") {
          errorMsg = Object.values(payload).flat().join(", ");
        }
        dispatch(setError(errorMsg));
        setShowMessage(true);
      }
    } catch (err) {
      dispatch(setError(err.message));
      setShowMessage(true);
    } finally {
      setLoading(false);
    }
  };


  console.log("selectedMember", selectedMember?.member)
  return (
    <>
      {showMessage && (
        <MessageBox
          message={message}
          error={error}
          clearMessage={() => {
            dispatch(clearMessage());
            setShowMessage(false);
          }}
          onOk={() => {
            dispatch(clearMessage());
            setShowMessage(false);
            if (!error) {
              dispatch(setActiveTabs(1));
              navigate(-1);
            }
          }}
        />
      )}

      <div className="flex-shrink-0 sticky top-0 z-20 mb-1.5 flex items-center justify-between gap-3 bg-surfaceMuted/95 py-2 md:py-4 backdrop-blur">
        <div
          onClick={() => navigate(-1)}
          className="inline-flex cursor-pointer items-center gap-3 text-ink transition-colors hover:text-primary"
        >
          <ArrowHeading title="Edit Personal Information" size="2xl" color="text-black" />
        </div>
      </div>

      <div className="max-h-[calc(100vh-180px)] overflow-y-auto">
        <section className="mx-auto mt-2 w-full rounded-[24px] md:rounded-[32px] border border-borderLight bg-white px-4 py-6 md:px-8 md:py-10">
          <Formik
            initialValues={formData}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
            enableReinitialize
          >
            {({ errors, touched }) => (
              <Form>
                {loading && (
                  <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
                    <ModernLoadingAnimation />
                  </div>
                )}
                <Div className="flex flex-col md:flex-row">
                  <SideSectionEdit
                    formData={formData}
                    handleChange={handleChange}
                    handleFileChange={handleFileChange}
                    removeFile={removeFile}
                    fileErrors={fileErrors}
                  />
                  <div className="hidden md:block w-px bg-[#E2E8F0]" />
                  <Div className="bg-white p-4 md:p-5 w-full md:flex-1">
                    <Heading
                      title="General Information"
                      size="lg"
                      color="text-black"
                    />
                    <MainSectionEdit
                      formData={formData}
                      handleChange={handleChange}
                      errors={errors}
                      touched={touched}
                    />
                    <NidSectionEdit
                      formData={formData}
                      handleChange={handleChange}
                      handleFileChange={handleFileChange}
                      removeFile={removeFile}
                      fileErrors={fileErrors}
                    />
                    <SubmitButton
                      text="Update"
                      width="full"
                      disabled={!isFormChanged}
                    />
                  </Div>
                </Div>
              </Form>
            )}
          </Formik>
        </section>
      </div>
    </>
  );
};

export default GeneralInformationEditForm;
