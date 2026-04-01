import axiosInstance from "../utils/axiosInstance";

const CONTACTS_ENDPOINT = "/api/contacts/";

export const fetchImportantContacts = async () => {
  const response = await axiosInstance.get(CONTACTS_ENDPOINT);
  return response.data;
};

const buildFormData = (payload) => {
  const formData = new FormData();
  
  // Add all non-file fields
  Object.keys(payload).forEach((key) => {
    const value = payload[key];
    
    if (key === "photo") {
      // Handle photo: append File or mark as removed
      if (value instanceof File) {
        formData.append("photo", value);
      } else if (value === null || value === "") {
        // Mark photo as removed
        formData.append("photo", "");
      }
      // If value is a string (existing URL), don't append it
    } else if (value !== null && value !== undefined) {
      formData.append(key, value);
    }
  });
  
  return formData;
};

export const createImportantContact = async (payload) => {
  // Check if we need to use FormData (if photo is a File)
  const needsFormData = payload.photo instanceof File;
  
  if (needsFormData) {
    const formData = buildFormData(payload);
    const response = await axiosInstance.post(CONTACTS_ENDPOINT, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  }
  
  // Regular JSON request
  const response = await axiosInstance.post(CONTACTS_ENDPOINT, payload);
  return response.data;
};

export const updateImportantContactRequest = async (contactId, payload) => {
  // Check if we need to use FormData (if photo is a File or being removed)
  const needsFormData = 
    payload.photo instanceof File || 
    payload.photo === null || 
    payload.photo === "";
  
  if (needsFormData) {
    const formData = buildFormData(payload);
    const response = await axiosInstance.patch(
      `${CONTACTS_ENDPOINT}${contactId}/`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  }
  
  // Regular JSON request
  const response = await axiosInstance.patch(
    `${CONTACTS_ENDPOINT}${contactId}/`,
    payload
  );
  return response.data;
};

export const deleteImportantContactRequest = async (contactId) => {
  const response = await axiosInstance.delete(`${CONTACTS_ENDPOINT}${contactId}/`);
  return response.data;
};

