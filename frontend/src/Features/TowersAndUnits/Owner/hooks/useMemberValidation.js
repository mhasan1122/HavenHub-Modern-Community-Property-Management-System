// src/hooks/useMemberValidation.js

import { useState } from "react";

const useMemberValidation = () => {
  const [errors, setErrors] = useState({});

  const validateForm = (formData, activeTab) => {
    const newErrors = {};

    //
    // Tab 1 validations (unchanged)
    //
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

    //
    // Tab 2 validations (Login Credential)
    //
    if (activeTab === 2) {
      // Must pick a login method
      // if (!formData.login) {
      //   newErrors.login = "Please select login method";
      // } else {
      //   const dm = formData.delivery_method || "";

      //   // Email login
      //   if (formData.login === "email") {
      //     if (!dm) {
      //       newErrors.email = "Email is required";
      //     } else if (!emailRegex.test(dm)) {
      //       newErrors.email = "Invalid email format";
      //     }
      //   }

      //   // Contact login
      //   if (formData.login === "contact") {
      //     if (!dm) {
      //       newErrors.contact = "Contact Number is required";
      //     } else if (!contactRegex.test(dm)) {
      //       newErrors.contact = "Invalid contact format";
      //     }
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

export default useMemberValidation;
