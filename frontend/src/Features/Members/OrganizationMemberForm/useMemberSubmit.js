import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createMember, memberUpdate} from "./../../../redux/slices/api/memberApi";
import { clearMessage } from "../../../redux/slices/memberSlice";
import { useNavigate } from "react-router-dom";

/**
 * Formats a date string from 'YYYY-MM-DD' to 'DD-MMM-YYYY' format (e.g., '1998-02-22' to '22-Feb-1998').
 * This format matches the backend's expected format: %d-%b-%Y
 */
const formatDateForBackend = (dateStr) => {
  if (!dateStr) return "";
  
  // If already in DD-MMM-YYYY format, return as is
  if (dateStr.match(/^\d{2}-[A-Za-z]{3}-\d{4}$/)) {
    return dateStr;
  }
  
  // Parse YYYY-MM-DD format
  const date = new Date(dateStr);
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    console.error("Invalid date string:", dateStr);
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
};

const useMemberSubmit = (formData, validateForm, activeTab) => {
  const dispatch = useDispatch();
  const { message, error } = useSelector((state) => state.member);
  const [showMessage, setShowMessage] = useState(false);
  const [loading, setLoading] = useState(false);

  // Show success or error message
//   useEffect(() => {
//     if (message || error) {
//       setShowMessage(true);
//       setTimeout(() => {
//         dispatch(clearMessage());
//         setShowMessage(false);
//         if (message) {
//           navigate("/member-list");
//         }
//       }, 4000);
//     }
//   }, [message, error, dispatch, navigate]);

  // const handleSubmit = (e) => {
  //     e.preventDefault();
  //     const validationPassed = validateForm(formData, 2);

  //     if (!validationPassed) {
  //         return;
  //     }

  //     const formDataObject = new FormData();
  //     for (const key in formData) {
  //         if (formData.hasOwnProperty(key) && key !== "members_role") {
  //             formDataObject.append(key, formData[key]);
  //         }
  //     }

  //     for (const key in formData) {
  //         if (formData.hasOwnProperty(key) && key !== "members_role") {
  //             if (key === "memberType") {
  //                 // Convert "memberType" to "member_type"
  //                 formDataObject.append("member_type", formData[key]);
  //             } else {
  //                 formDataObject.append(key, formData[key]);
  //             }
  //         }
  //     }

  //     let single_member_role = [];
  //     if (Array.isArray(formData.members_role)) {
  //         single_member_role = [...new Set(formData.members_role)].map((roleId) =>
  //             parseInt(roleId, 10)
  //         );
  //     }

  //     single_member_role.forEach((roleId) => {
  //         formDataObject.append("members_role", roleId);
  //     });

  //     // dispatch(createMember(formDataObject));
  //     setLoading(true);

  //     // Dispatch the createMember action and update loading accordingly
  //     dispatch(createMember(formDataObject))
  //       .then(() => {
  //         setLoading(false);
  //       })
  //       .catch(() => {
  //         setLoading(false);
  //       })
  // };

  const handleSubmit = (e) => {
    e.preventDefault();
    // console.log(formData);
    const validationPassed = validateForm(formData, activeTab);
    
    // console.log(validationPassed);
    // console.log('submit:',formData);


    if (!validationPassed) {
      return;
    }

    const formDataObject = new FormData();
    // formDataObject.append("is_member", true);
    console.log('formData',formData);

    let memberTypeValue = formData.memberType || null; // Ensure we capture memberType

    for (const key in formData) {
      if (
        formData.hasOwnProperty(key) &&
        key !== "members_role" &&
        key !== "memberType"
      ) {
        // Format date_of_birth to match backend expected format (DD-MMM-YYYY)
        if (key === "date_of_birth" && formData[key]) {
          const formattedDate = formatDateForBackend(formData[key]);
          formDataObject.append(key, formattedDate);
        } else {
        formDataObject.append(key, formData[key]);
        }
      }
    }
  //  console.log('object',formDataObject);
    // Ensure "member_type" is set if it exists
    if (memberTypeValue !== null) {
      formDataObject.append("member_type", memberTypeValue);
    }

    let single_member_role = [];
    if (Array.isArray(formData.members_role)) {
      single_member_role = [...new Set(formData.members_role)]
        .filter((roleId) => roleId != null && roleId !== "" && roleId !== undefined) // Filter out null, undefined, and empty strings
        .map((roleId) => parseInt(roleId, 10))
        .filter((roleId) => !isNaN(roleId) && roleId > 0); // Filter out NaN and invalid numbers
    }

    single_member_role.forEach((roleId) => {
      formDataObject.append("members_role", roleId);
    });

  setLoading(true);

  const id=formDataObject.get('id');
  dispatch(id ? memberUpdate({id, formData: formDataObject}) : createMember(formDataObject))
      .then((result) => {
        setLoading(false);
        // Dispatch custom event to trigger notification refresh for new members
        if (!id && result.type.endsWith('/fulfilled')) {
          console.log('[useMemberSubmit] Member created successfully, dispatching memberAdded event');
          window.dispatchEvent(new Event('memberAdded'));
        }
      })
      .catch(() => {
        setLoading(false);
      });
  };


  useEffect(() => {
    if (message || error) {
      setShowMessage(true);  // MessageBox দেখানোর জন্য
    }
  }, [message, error]);



  // Optional: Reset message on dismiss
  const handleDismissMessage = () => {
    dispatch(clearMessage());
    setShowMessage(false);
  };

  return {
    handleSubmit,
    loading,
    showMessage,
    message,
    error,
    handleDismissMessage // Handle message box dismissal
  };
};

export default useMemberSubmit;
