import { useState } from "react";

const useUnitStaffValidation = () => {
  const [errors, setErrors] = useState({});

  const validateForm = (formData, activeTab) => {
    const newErrors = {};

    // Validate required member fields using flattened state keys.
    if (!formData.full_name) {
      newErrors.full_name = "Full name is required";
    }
    if (!formData.general_contact) {
      newErrors.general_contact = "Contact Number is required";
    }
    if (!formData.general_email) {
      newErrors.general_email = "Email is required";
    }

    // Additional validations for email and contact number formats.
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.general_email && !emailRegex.test(formData.general_email)) {
      newErrors.general_email = "Invalid email format";
    }
    if (formData.general_contact && !/^\d+$/.test(formData.general_contact)) {
      newErrors.general_contact = "Contact number must contain only digits";
    } else if (formData.general_contact && formData.general_contact.length > 11) {
      newErrors.general_contact = "Contact number cannot be more than 11 digits";
    }

    // if (activeTab === 2 && formData.is_resident_or_tenant === false) {
    //   // Validate unit_rent_fee only if the field is not empty
    //   if (formData.unit_rent_fee && Number(formData.unit_rent_fee) <= 0) {
    //     newErrors.unit_rent_fee = "Unit rent fee must be greater than zero if provided";
    //   }
    // }
    // if (activeTab === 2 && formData.is_resident_or_tenant === false) {
    //   // Validate advance_payment only if the field is not empty
    //   if (formData.advance_payment && Number(formData.advance_payment) <= 0) {
    //     newErrors.advance_payment = "Advance payment must be greater than zero if provided";
    //   }
    // }

    if (activeTab == 3) {
      // newErrors.email= 'Email or Contact Number is required';

      // if (formData.login == "email") {
      //   console.log(formData.login);
      //   console.log(formData.delivery_method);

      //   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      //   if (!emailRegex.test(formData.delivery_method)) {
      //     newErrors.email = "Please enter a valid email address";
      //   }
      // } else if (formData.login == "contact") {
      //   const contactRegex = /^(018|019|013|017|015|016|014)\d{8}$/;
      //   if (!contactRegex.test(formData.delivery_method)) {
      //     newErrors.contact = "Please enter a valid phone number";
      //   }
      // }
      if (formData.login === "email") {
        const email = formData.email || formData.general_email;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          newErrors.email = "Please enter a valid email address";
        }
      } else if (formData.login === "contact") {
        const contact = formData.contact || formData.general_contact;
        if (!contact) {
          newErrors.contact = "Contact number is required";
        } else if (!/^\d+$/.test(contact)) {
          newErrors.contact = "Contact number must contain only digits";
        }
      }
      
    }


    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return { errors, validateForm, setErrors };
};

export default useUnitStaffValidation;
