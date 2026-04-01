import axiosInstance from '../../../../utils/axiosInstance';

const API_URL = '/api/service-fee-management/payment-methods/';

const paymentMethodService = {
    getPaymentMethods: async (isActive = null) => {
        const params = {};
        if (isActive !== null) {
            params.is_active = isActive;
        }
        const response = await axiosInstance.get(API_URL, { params });
        return response.data;
    },

    getPaymentMethod: async (id) => {
        const response = await axiosInstance.get(`${API_URL}${id}/`);
        return response.data;
    },

    createPaymentMethod: async (data) => {
        const response = await axiosInstance.post(API_URL, data);
        return response.data;
    },

    updatePaymentMethod: async (id, data) => {
        const response = await axiosInstance.put(`${API_URL}${id}/`, data);
        return response.data;
    },

    deletePaymentMethod: async (id) => {
        const response = await axiosInstance.delete(`${API_URL}${id}/`);
        return response.data;
    },

    getPaymentChoices: async () => {
        const response = await axiosInstance.get('/api/service-fee-management/payment-choices/');
        return response.data;
    },

    getAccounts: async () => {
        const response = await axiosInstance.get('/api/accounts/accounts/');
        return response.data;
    }
};

export default paymentMethodService;
