import axiosInstance from "../utils/axiosInstance";

const BILL_CATEGORY_ENDPOINT = "/api/bill-categories/";

export const fetchBillCategories = async (params = {}) => {
  const response = await axiosInstance.get(BILL_CATEGORY_ENDPOINT, { params });
  return response.data;
};

export const fetchBillCategoryById = async (id) => {
  const response = await axiosInstance.get(`${BILL_CATEGORY_ENDPOINT}${id}/`);
  return response.data;
};

export const createBillCategory = async (payload) => {
  const response = await axiosInstance.post(BILL_CATEGORY_ENDPOINT, payload);
  return response.data;
};

export const updateBillCategory = async (id, payload) => {
  const response = await axiosInstance.put(`${BILL_CATEGORY_ENDPOINT}${id}/`, payload);
  return response.data;
};

export const deleteBillCategory = async (id) => {
  const response = await axiosInstance.delete(`${BILL_CATEGORY_ENDPOINT}${id}/`);
  return response.data;
};

export const toggleBillCategoryStatus = async (id) => {
  const response = await axiosInstance.patch(`${BILL_CATEGORY_ENDPOINT}${id}/toggle-status/`);
  return response.data;
};

export const fetchActiveBillCategories = async () => {
  const response = await axiosInstance.get(BILL_CATEGORY_ENDPOINT, {
    params: { is_active: true }
  });
  return response.data;
};
