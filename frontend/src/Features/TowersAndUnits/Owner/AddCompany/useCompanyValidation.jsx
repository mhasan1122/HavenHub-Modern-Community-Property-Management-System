import { color } from "framer-motion";
import { useState } from "react";

const useCompanyValidation = () => {
  const [errors, setErrors] = useState({});

  const validateForm = (formData, activeTab) => {
    const newErrors = {};

    if (!formData.company_name) {
      newErrors.company_name = "Company name is required";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.general_email) {
      newErrors.general_email = "Email is required";
    } else if (!emailRegex.test(formData.general_email)) {
      newErrors.general_email = "Invalid email format";
    }

    const contactRegex = /^(013|014|015|016|017|018|019)\d{8}$/;
    if (!formData.general_contact) {
      newErrors.general_contact = "Contact Number is required";
    } else if (!contactRegex.test(formData.general_contact)) {
      newErrors.general_contact =
        "Invalid contact number. Must be 11 digits starting with a valid prefix (013-019).";
    }

    // if (
    //   activeTab === 2 &&
    //   (!formData.member_type || formData.member_type.length === 0)
    // ) {
    //   newErrors.member_type = "Member Type is required.";
    // }

    if (activeTab == 2) {
      // newErrors.email= 'Email or Contact Number is required';

      // if (formData.login == "email") {
      //   console.log(formData.login);
      //   console.log(formData.delivery_method);

      //   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      //   if (!emailRegex.test(formData.delivery_method)) {
      //     newErrors.email = "Invalid email format";
      //   }
      // } else if (formData.login == "contact") {
      //   const contactRegex = /^(018|019|013|017|015|016|014)\d{8}$/;
      //   if (!contactRegex.test(formData.delivery_method)) {
      //     newErrors.contact = "Invalid contact format";
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

export default useCompanyValidation;
