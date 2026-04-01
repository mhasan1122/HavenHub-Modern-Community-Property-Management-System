import * as yup from "yup";

export const CONTACT_FORM_DEFAULT_VALUES = {
  name: "",
  phoneNumber: "",
  email: "",
  designation: "",
  photo: null,
  member: null,
};

export const contactValidationSchema = yup.object().shape({
  name: yup
    .string()
    .trim()
    .min(2, "Contact name must be between 2 and 50 characters.")
    .max(50, "Contact name must be between 2 and 50 characters.")
    .required("Contact name is required."),
  phoneNumber: yup
    .string()
    .required("Phone number is required."),
  email: yup
    .string()
    .email("Enter a valid email address.")
    .required("Email address is required.")
    .trim(),
  designation: yup.string().trim().required("Designation is required."),
  photo: yup
    .mixed()
    .nullable()
    .test("file-size", "File size must be less than 5MB.", (value) => {
      if (!value) return true; // Photo is optional
      if (typeof value === "string") return true; // Already uploaded photo URL
      return value.size <= 5 * 1024 * 1024; // 5MB
    })
    .test("file-type", "Only JPG, JPEG, and PNG files are allowed.", (value) => {
      if (!value) return true; // Photo is optional
      if (typeof value === "string") return true; // Already uploaded photo URL
      const validTypes = ["image/jpeg", "image/jpg", "image/png"];
      return validTypes.includes(value.type);
    }),
  member: yup
    .number()
    .required("Please select an organization member.")
    .nullable(false),
});


