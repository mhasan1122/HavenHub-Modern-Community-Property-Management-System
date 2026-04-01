import { color } from "framer-motion";
import { useState } from "react";

const useMemberValidation = () => {
  const [errors, setErrors] = useState({});

  const validateForm = (formData, activeTab) => {
    const newErrors = {};

    if (!formData.full_name) {
      newErrors.full_name = "Full name is required";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.general_email) {
      newErrors.general_email = "Email is required";
    } else if (!emailRegex.test(formData.general_email)) {
      newErrors.general_email = "Invalid email format";
    }

    if (!formData.general_contact) {
      newErrors.general_contact = "Contact Number is required";
    } else if (!/^\d+$/.test(formData.general_contact)) {
      newErrors.general_contact = "Contact number must contain only digits";
    } else if (formData.general_contact.length > 11) {
      newErrors.general_contact = "Contact number cannot be more than 11 digits";
    }

    if (
      activeTab === 2 &&
      (!formData.member_type || formData.member_type.length === 0)
    ) {
      newErrors.member_type = "Member Type is required.";
    }

    if (activeTab == 3) {
      // newErrors.email= 'Email or Contact Number is required';

      if (formData.login == "email") {
        console.log(formData.login);
        console.log(formData.delivery_method);

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        // Only validate email format if email is provided (make it optional)
        if (formData.delivery_method && !emailRegex.test(formData.delivery_method)) {
          newErrors.email = "Invalid email format";
        }
      } else if (formData.login == "contact") {
        if (!formData.delivery_method) {
          newErrors.contact = "Contact number is required";
        } else if (!/^\d+$/.test(formData.delivery_method)) {
          newErrors.contact = "Contact number must contain only digits";
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return { errors, validateForm, setErrors };
};

export default useMemberValidation;
