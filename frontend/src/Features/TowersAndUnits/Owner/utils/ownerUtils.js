import * as yup from "yup";

/**
 * Returns ordinal suffix (e.g., 1st, 2nd, 3rd).
 */
export const getOrdinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/**
 * Formats a date string to 'dd-MMM-yyyy' (e.g., 08-Sep-2025).
 * This format matches the backend's expected format: DD-MMM-YYYY
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return "";
  
  const date = new Date(dateStr);
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    console.error("Invalid date string:", dateStr);
    return "";
  }
  
  // Month abbreviations array (0-indexed, so Jan = 0, Sep = 8)
  const monthAbbr = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  
  const day = String(date.getDate()).padStart(2, "0");
  const month = monthAbbr[date.getMonth()];
  const year = date.getFullYear();
  
  return `${day}-${month}-${year}`;
};

/**
 * Owner validation schema using yup for react-hook-form.
 */
export const ownerValidationSchema = yup.object().shape({
  owners: yup.array().of(
    yup.object().shape({
      memberId: yup
        .mixed()
        .required("Unit Owner Name is required")
        .test(
          "is-valid-member",
          "Please select a valid Unit Owner Name",
          function (value) {
            return value !== null && value !== undefined && value !== "";
          }
        ),

      ownershipPercentage: yup
        .number()
        .typeError("Ownership percentage must be a number")
        .required("Ownership percentage is required")
        .min(0, "Ownership percentage cannot be negative")
        .max(100, "Ownership percentage cannot exceed 100")
        .test(
          "decimal-places",
          "Ownership percentage cannot have more than 2 decimal places",
          (value) => {
            if (!value) return true;
            return /^\d+(\.\d{0,2})?$/.test(value.toString());
          }
        ),

      dateofOwnership: yup
        .date()
        .typeError("Invalid date")
        .required("Date of Ownership is required")
        .max(new Date(), "Ownership date cannot be in the future")
        .test(
          "not-older-than-current",
          "New ownership date cannot be older than the current ownership date",
          function (value) {
            // This validation will be handled in the form component
            // where we have access to initial values
            return true;
          }
        )
        .transform((value, originalValue) =>
          originalValue === "" ? null : value
        ),

      document: yup
        .array()
        .nullable()
        .default([])
        .test(
          "max-files",
          "You can upload a maximum of 5 documents.",
          (files) => !files || files.length <= 5
        ),

      docLinks: yup.array().nullable().default([]),

      ownershipTransferFromId: yup
        .number()
        .nullable()
        .test(
          "is-valid-transfer",
          "Please select a valid owner to transfer ownership from",
          function (value) {
            // If no transfer is selected, that's fine
            if (!value) return true;

            // Get the current owner's ID
            const currentOwnerId = this.parent.memberId;

            // Don't allow self-transfer
            if (value === currentOwnerId) {
              return this.createError({
                message: "Cannot transfer ownership to yourself"
              });
            }

            return true;
          }
        )
        .transform((value, originalValue) =>
          String(originalValue).trim() === "" ? null : value
        )
    })
  )
  // .test(
  //   "unique-memberId",
  //   "Duplicate Unit Owner Names are not allowed. Please remove duplicate entries.",
  //   function (owners) {
  //     if (!owners) return true;
  //     const memberIds = owners.map((o) => o.memberId).filter(Boolean);
  //     const uniqueMemberIds = new Set(memberIds);
  //     return uniqueMemberIds.size === memberIds.length;
  //   }
  // )
});

/**
 * Owner edit validation schema for single owner editing.
 */
export const ownerEditValidationSchema = yup.object().shape({
  memberId: yup
    .mixed()
    .required("Unit Owner Name is required")
    .test(
      "is-valid-member",
      "Please select a valid Unit Owner Name",
      function (value) {
        return value !== null && value !== undefined && value !== "";
      }
    ),

  ownershipPercentage: yup
    .number()
    .typeError("Ownership percentage must be a number")
    .required("Ownership percentage is required")
    .min(0, "Ownership percentage cannot be negative")
    .max(100, "Ownership percentage cannot exceed 100")
    .test(
      "decimal-places",
      "Ownership percentage cannot have more than 2 decimal places",
      (value) => {
        if (!value) return true;
        return /^\d+(\.\d{0,2})?$/.test(value.toString());
      }
    ),

  dateofOwnership: yup
    .date()
    .typeError("Invalid date")
    .required("Date of Ownership is required")
    .max(new Date(), "Ownership date cannot be in the future")
    .transform((value, originalValue) => (originalValue === "" ? null : value)),

  document: yup
    .array()
    .nullable()
    .default([])
    .test(
      "max-files",
      "You can upload a maximum of 5 documents.",
      (files) => !files || files.length <= 5
    )
});

/**
 * Parses error messages from API responses and returns user-friendly messages.
 * Handles various error formats including serializer errors, string errors, and date validation errors.
 */
export const parseOwnerError = (error) => {
  // If error is null or undefined, return default message
  if (!error) {
    return "An unexpected error occurred. Please try again.";
  }

  // If error is already a user-friendly string, return it
  if (typeof error === "string") {
    // Check for common technical error messages and replace them
    if (error.includes("Request failed with status code 400")) {
      return "Invalid data provided. Please check all fields and try again.";
    }
    if (error.includes("status code 400")) {
      return "Invalid data provided. Please check all fields and try again.";
    }
    if (error.includes("Network Error") || error.includes("network")) {
      return "Network error. Please check your connection and try again.";
    }
    // Return the string as-is if it's already user-friendly
    return error;
  }

  // If error is an object (serializer errors)
  if (typeof error === "object") {
    const errorMessages = [];

    // Handle different error object structures
    if (error.error) {
      // Single error message
      return typeof error.error === "string" 
        ? error.error 
        : parseOwnerError(error.error);
    }

    if (error.message) {
      // Error with message field
      return typeof error.message === "string"
        ? error.message
        : parseOwnerError(error.message);
    }

    // Handle serializer errors (field-based errors)
    if (error.date_of_ownership || error.dateofOwnership) {
      const dateError = error.date_of_ownership || error.dateofOwnership;
      if (Array.isArray(dateError)) {
        errorMessages.push(`Date of Ownership: ${dateError[0]}`);
      } else if (typeof dateError === "string") {
        errorMessages.push(`Date of Ownership: ${dateError}`);
      } else if (typeof dateError === "object") {
        errorMessages.push(`Date of Ownership: ${parseOwnerError(dateError)}`);
      } else {
        errorMessages.push("Date of Ownership: Invalid date format. Please use a valid date.");
      }
    }

    if (error.ownership_percentage || error.ownershipPercentage) {
      const percentageError = error.ownership_percentage || error.ownershipPercentage;
      if (Array.isArray(percentageError)) {
        errorMessages.push(`Ownership Percentage: ${percentageError[0]}`);
      } else if (typeof percentageError === "string") {
        errorMessages.push(`Ownership Percentage: ${percentageError}`);
      } else {
        errorMessages.push("Ownership Percentage: Invalid value. Please enter a number between 0 and 100.");
      }
    }

    if (error.member || error.memberId) {
      const memberError = error.member || error.memberId;
      if (Array.isArray(memberError)) {
        errorMessages.push(`Owner: ${memberError[0]}`);
      } else if (typeof memberError === "string") {
        errorMessages.push(`Owner: ${memberError}`);
      } else {
        errorMessages.push("Owner: Please select a valid owner.");
      }
    }

    if (error.unit) {
      const unitError = error.unit;
      if (Array.isArray(unitError)) {
        errorMessages.push(`Unit: ${unitError[0]}`);
      } else if (typeof unitError === "string") {
        errorMessages.push(`Unit: ${unitError}`);
      }
    }

    // Handle other field errors
    Object.keys(error).forEach((key) => {
      if (!["date_of_ownership", "dateofOwnership", "ownership_percentage", "ownershipPercentage", "member", "memberId", "unit"].includes(key)) {
        const fieldError = error[key];
        if (Array.isArray(fieldError)) {
          errorMessages.push(`${key}: ${fieldError[0]}`);
        } else if (typeof fieldError === "string") {
          errorMessages.push(`${key}: ${fieldError}`);
        }
      }
    });

    // If we have specific error messages, return them
    if (errorMessages.length > 0) {
      return errorMessages.join(" ");
    }

    // If error object has a toString method, use it
    if (error.toString && error.toString() !== "[object Object]") {
      return error.toString();
    }
  }

  // Default fallback message
  return "Failed to save owner information. Please check all fields and try again.";
};
