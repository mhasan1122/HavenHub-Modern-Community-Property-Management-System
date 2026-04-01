import axiosInstance from '../../../utils/axiosInstance';

/**
 * Get service fees filtered by tower IDs
 * @param {string} towerIds - Comma-separated tower IDs
 * @returns {Promise} - Response with service fees list
 */
export const fetchServiceFeesByTowers = async (towerIds) => {
  try {
    const response = await axiosInstance.get(
      `/api/service-fee-management/bill-uploads/service-fees/`,
      {
        params: { tower_ids: towerIds }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching service fees by towers:', error);
    throw error;
  }
};

/**
 * Get list of bill uploads with filters
 * @param {Object} filters - Filter parameters
 * @returns {Promise} - Response with bill uploads list
 */
export const fetchBillUploads = async (filters = {}) => {
  try {
    const response = await axiosInstance.get(
      `/api/service-fee-management/bill-uploads/`,
      { params: filters }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching bill uploads:', error);
    throw error;
  }
};

/**
 * Fetch units/items for given service fee(s) and tower (left-join like)
 * @param {Object} params - { service_fee_ids: '1,2', tower_id: 5, month: 12, year: 2025 }
 */
export const fetchBillUploadItems = async (params = {}) => {
  try {
    const response = await axiosInstance.get(
      `/api/service-fee-management/bill-uploads/service-fee-items/`,
      { params }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching bill upload items:', error);
    throw error;
  }
};

/**
 * Get single bill upload details
 * @param {number} uploadId - Bill upload ID
 * @returns {Promise} - Response with bill upload details
 */
export const fetchBillUploadDetail = async (uploadId) => {
  try {
    const response = await axiosInstance.get(
      `/api/service-fee-management/bill-uploads/${uploadId}/`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching bill upload detail:', error);
    throw error;
  }
};

/**
 * Create new bill upload with details
 * @param {Object} data - Bill upload data
 * @returns {Promise} - Response with created bill upload
 */
export const createBillUpload = async (data) => {
  try {
    const response = await axiosInstance.post(
      `/api/service-fee-management/bill-uploads/`,
      data
    );
    return response.data;
  } catch (error) {
    console.error('Error creating bill upload:', error);
    throw error;
  }
};

/**
 * Delete bill upload
 * @param {number} uploadId - Bill upload ID
 * @returns {Promise} - Response with success message
 */
export const deleteBillUpload = async (uploadId) => {
  try {
    const response = await axiosInstance.delete(
      `/api/service-fee-management/bill-uploads/${uploadId}/`
    );
    return response.data;
  } catch (error) {
    console.error('Error deleting bill upload:', error);
    throw error;
  }
};
