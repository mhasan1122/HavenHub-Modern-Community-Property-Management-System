import { createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../../../utils/axiosInstance";

// Get all payments with optional filters
export const fetchPayments = createAsyncThunk(
  "payments/fetchAll",
  async (params = {}, thunkAPI) => {
    try {
      console.log('Fetching payments with params:', params);
      const response = await axiosInstance.get('/api/service-fee-management/residents/', { params });
      console.log('API Response:', response.data);
      console.log('API Response Data:', response.data.data);
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error fetching payments:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Get single payment by ID
export const fetchPaymentById = createAsyncThunk(
  "payments/fetchById",
  async (paymentId, thunkAPI) => {
    try {
      const response = await axiosInstance.get(`/api/service-fee-management/payments/${paymentId}/`);
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error fetching payment:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Create new payment
export const createPayment = createAsyncThunk(
  "payments/create",
  async (paymentData, thunkAPI) => {
    try {
      console.log('Creating payment:', paymentData);
      const response = await axiosInstance.post('/api/service-fee-management/payments/', paymentData);
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error creating payment:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Update payment
export const updatePayment = createAsyncThunk(
  "payments/update",
  async ({ paymentId, paymentData }, thunkAPI) => {
    try {
      console.log('Updating payment:', paymentId, paymentData);
      const response = await axiosInstance.put(`/api/service-fee-management/payments/${paymentId}/`, paymentData);
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error updating payment:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Delete/Cancel payment
export const deletePayment = createAsyncThunk(
  "payments/delete",
  async (paymentId, thunkAPI) => {
    try {
      const response = await axiosInstance.delete(`/api/service-fee-management/payments/${paymentId}/`);
      return { paymentId, message: response.data.message };
    } catch (error) {
      console.error('Error deleting payment:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Get payment history for a resident
export const fetchResidentPaymentHistory = createAsyncThunk(
  "payments/fetchResidentHistory",
  async (residentId, thunkAPI) => {
    try {
      const response = await axiosInstance.get(`/api/service-fee-management/residents/${residentId}/payments/`);
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error fetching resident payment history:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Bulk operations for payments
export const bulkUpdatePayments = createAsyncThunk(
  "payments/bulkUpdate",
  async ({ paymentIds, updateData }, thunkAPI) => {
    try {
      const promises = paymentIds.map(id => 
        axiosInstance.put(`/api/service-fee-management/payments/${id}/`, updateData)
      );
      
      const responses = await Promise.all(promises);
      return responses.map(response => response.data.data || response.data);
    } catch (error) {
      console.error('Error bulk updating payments:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Get payment statistics
export const fetchPaymentStats = createAsyncThunk(
  "payments/fetchStats",
  async (filters = {}, thunkAPI) => {
    try {
      const response = await axiosInstance.get('/api/service-fee-management/residents/', {
        params: { ...filters, stats: true }
      });
      
      // Calculate statistics from the data
      const payments = response.data.data?.payments || [];
      const totalAmount = payments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
      const completedPayments = payments.filter(p => p.payment_status === 'completed');
      const pendingPayments = payments.filter(p => p.payment_status === 'pending');
      const overduePayments = payments.filter(p => p.is_overdue);
      
      return {
        totalPayments: payments.length,
        totalAmount,
        completedCount: completedPayments.length,
        pendingCount: pendingPayments.length,
        overdueCount: overduePayments.length,
        completedAmount: completedPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
        pendingAmount: pendingPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
      };
    } catch (error) {
      console.error('Error fetching payment stats:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);
