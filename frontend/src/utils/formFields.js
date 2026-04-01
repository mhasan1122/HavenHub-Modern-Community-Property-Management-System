// utils/memberFields.js
export const memberFields = {
  full_name: { name: "full_name", label: "Full Name", type: "text" },
  general_email: { name: "general_email", label: "E-mail", type: "email" },
  general_contact: {
    name: "general_contact",
    label: "Contact Number",
    type: "number"
  },
  nid_number: { name: "nid_number", label: "NID Number", type: "number" },
  permanent_address: {
    name: "permanent_address",
    label: "Permanent Address",
    type: "text"
  },
  present_address: {
    name: "present_address",
    label: "Present Address",
    type: "text"
  },
  gender: {
    name: "gender",
    label: "Gender",
    type: "radio",
    options: [
      { label: "Male", value: "Male" },
      { label: "Female", value: "Female" },
      { label: "Other", value: "Other" }
    ]
  },
  date_of_birth: {
    name: "date_of_birth",
    label: "Date of Birth",
    type: "date"
  },
  occupation: { name: "occupation", label: "Occupation", type: "text" },
  marital_status: {
    name: "marital_status",
    label: "Marital Status",
    options: [
      { label: "Select Marital Status", value: "" },
      { label: "Single", value: "Single" },
      { label: "Married", value: "Married" },
      { label: "Divorced", value: "Divorced" },
      { label: "Widowed", value: "Widowed" }
    ]
  },
  religion: {
    name: "religion",
    label: "Religion",
    options: [
      { label: "Select Religion", value: "" },
      { label: "Islam", value: "Islam" },
      { label: "Christianity", value: "Christianity" },
      { label: "Hinduism", value: "Hinduism" },
      { label: "Buddhism", value: "Buddhism" },
      { label: "Judaism", value: "Judaism" },
      { label: "Other", value: "Other" }
    ]
  },

  about_us: { name: "about_us", label: "Description", type: "textarea", rows: 6 },
  facebook_profile: {
    name: "facebook_profile",
    label: "Facebook Profile",
    type: "text"
  },
  linkedin_profile: {
    name: "linkedin_profile",
    label: "LinkedIn Profile",
    type: "text"
  },
  delivery_method: {
    name: "delivery_method",
    label: "Delivery Method",
    type: "text"
  },
  member_type: {
    name: "member_type",
    label: "Type",
    type: "radio",
    options: [
      { label: "Mandate of Birthment", value: 1 },
      { label: "Property Staff", value: 2 }
    ]
  },
  role_type: {
    name: "members_role",
    label: "Role Type",
    type: "checkbox",
    options: [
      { label: "Admin", value: "admin" },
      { label: "User", value: "user" }
    ]
  },
  login: {
    name: "login",
    label: "Send User ID & Password",
    type: "radio",
    options: [
      { label: "Email", value: "Email" },
      { label: "Phone Number", value: "Phone Number" }
    ]
  }
};

export const loginFields = {
  username: { name: "username", label: "Username", type: "text" },
  password: { name: "password", label: "Password", type: "password" },
  remember_me: { name: "remember_me", label: "Remember Me", type: "checkbox" }
};

// Role Fields
export const roleFields = {
  role_name: { name: "role_name", label: "Role Name", type: "text" },
  permissions: {
    name: "permissions",
    label: "Permissions",
    type: "checkbox",
    options: [
      { label: "Read", value: "read" },
      { label: "Write", value: "write" },
      { label: "Update", value: "update" },
      { label: "Delete", value: "delete" }
    ]
  },
  is_active: { name: "is_active", label: "Active Status", type: "checkbox" }
};

export const groupFields = {
  group_name: {
    name: "group_name",
    label: "Group Name",
    placeholder: "Write Group Name",
    type: "text"
  },
  selectAll: {
    name: "selectAll",
    label: "All",
    type: "checkbox"
  },
  group_description: {
    name: "group_description",
    label: "Group Description",
    placeholder: "Enter group description",
    type: "textarea",
    rows: 5
  }
};
