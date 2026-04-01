import axiosInstance from "../utils/axiosInstance";

const API_URL = "/api/company-settings";

/**
 * Fetch company settings (authenticated)
 */
export const fetchCompanySettings = async () => {
  try {
    const response = await axiosInstance.get(`${API_URL}/`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Fetch company settings (public - for login page)
 */
export const fetchCompanySettingsPublic = async () => {
  try {
    const response = await axiosInstance.get(`${API_URL}/public/`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Update company settings
 */
export const updateCompanySettings = async (formData) => {
  try {
    const response = await axiosInstance.put(`${API_URL}/`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Fetch company images
 */
export const fetchCompanyImages = async (imageType = null) => {
  try {
    const params = imageType ? { image_type: imageType } : {};
    const response = await axiosInstance.get(`${API_URL}/images/`, { params });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Upload a new company image
 */
export const uploadCompanyImage = async (formData) => {
  try {
    const response = await axiosInstance.post(`${API_URL}/images/`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Update a company image
 */
export const updateCompanyImage = async (id, formData) => {
  try {
    const response = await axiosInstance.put(`${API_URL}/images/${id}/`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Delete a company image
 */
export const deleteCompanyImage = async (id) => {
  try {
    const response = await axiosInstance.delete(`${API_URL}/images/${id}/`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Set an image as active
 */
export const setActiveImage = async (id) => {
  try {
    const response = await axiosInstance.post(`${API_URL}/images/${id}/set-active/`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

