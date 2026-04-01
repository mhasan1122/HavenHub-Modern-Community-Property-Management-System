import axiosInstance from '../../../../utils/axiosInstance';

const BILL_CATEGORY_ENDPOINTS = {
  BASE: '/api/bill-categories/',
  DETAIL: (id) => `/api/bill-categories/${id}/`,
  TOGGLE_STATUS: (id) => `/api/bill-categories/${id}/toggle-status/`,
};

const billCategoryService = {
  /**
   * Get all bill categories
   * @param {Object} params - Query parameters (optional)
   * @returns {Promise} API response
   */
  getAll: async (params = {}) => {
    try {
      const response = await axiosInstance.get(BILL_CATEGORY_ENDPOINTS.BASE, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching bill categories:', error);
      throw error;
    }
  },

  /**
   * Get a single bill category by ID
   * @param {number} id - Category ID
   * @returns {Promise} API response
   */
  getById: async (id) => {
    try {
      const response = await axiosInstance.get(BILL_CATEGORY_ENDPOINTS.DETAIL(id));
      return response.data;
    } catch (error) {
      console.error(`Error fetching bill category ${id}:`, error);
      throw error;
    }
  },

  /**
   * Create a new bill category
   * @param {Object} data - Category data
   * @returns {Promise} API response
   */
  create: async (data) => {
    try {
      const response = await axiosInstance.post(BILL_CATEGORY_ENDPOINTS.BASE, data);
      return response.data;
    } catch (error) {
      console.error('Error creating bill category:', error);
      throw error;
    }
  },

  /**
   * Update an existing bill category
   * @param {number} id - Category ID
   * @param {Object} data - Updated category data
   * @returns {Promise} API response
   */
  update: async (id, data) => {
    try {
      const response = await axiosInstance.put(BILL_CATEGORY_ENDPOINTS.DETAIL(id), data);
      return response.data;
    } catch (error) {
      console.error(`Error updating bill category ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete a bill category
   * @param {number} id - Category ID
   * @returns {Promise} API response
   */
  delete: async (id) => {
    try {
      const response = await axiosInstance.delete(BILL_CATEGORY_ENDPOINTS.DETAIL(id));
      return response.data;
    } catch (error) {
      console.error(`Error deleting bill category ${id}:`, error);
      throw error;
    }
  },

  /**
   * Toggle category active status
   * @param {number} id - Category ID
   * @returns {Promise} API response
   */
  toggleStatus: async (id) => {
    try {
      const response = await axiosInstance.patch(BILL_CATEGORY_ENDPOINTS.TOGGLE_STATUS(id));
      return response.data;
    } catch (error) {
      console.error(`Error toggling bill category status ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get active bill categories only
   * @returns {Promise} API response
   */
  getActive: async () => {
    try {
      const response = await axiosInstance.get(BILL_CATEGORY_ENDPOINTS.BASE, {
        params: { is_active: true }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching active bill categories:', error);
      throw error;
    }
  },
};

export default billCategoryService;
