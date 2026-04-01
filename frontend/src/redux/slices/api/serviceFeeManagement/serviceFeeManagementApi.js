// serviceFeeManagementApi.js
import { createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../../../../utils/axiosInstance";

// Fetch dynamic filter options (towers, status, payment methods, service fees)
export const fetchFilterOptions = createAsyncThunk(
  "serviceFeeManagement/fetchFilterOptions",
  async (towerIds = null, thunkAPI) => {
    try {
      let url = "/api/service-fee-management/filter-options/";
      if (towerIds) {
        url += `?tower_ids=${towerIds}`;
      }
      const response = await axiosInstance.get(url);
      return response.data.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch service fee residents with combined data and statistics
export const fetchServiceFeeResidents = createAsyncThunk(
  "serviceFeeManagement/fetchResidents",
  async (filters = {}, thunkAPI) => {
    try {
      const params = new URLSearchParams();
      // Period filters
      if (filters.service_period_month_from) params.append('service_period_month_from', filters.service_period_month_from);
      if (filters.service_period_year_from) params.append('service_period_year_from', filters.service_period_year_from);
      if (filters.service_period_month_to) params.append('service_period_month_to', filters.service_period_month_to);
      if (filters.service_period_year_to) params.append('service_period_year_to', filters.service_period_year_to);
      if (filters.service_period_month) params.append('service_period_month', filters.service_period_month);
      if (filters.service_period_year) params.append('service_period_year', filters.service_period_year);
      // Array based filters
      if (filters.tower_ids && filters.tower_ids.length > 0) {
        filters.tower_ids.forEach(id => params.append('tower_id', id));
      } else if (filters.tower_id && filters.tower_id !== 'All Towers') {
        params.append('tower_id', filters.tower_id);
      }
      if (filters.statuses && filters.statuses.length > 0) {
        filters.statuses.forEach(s => params.append('status', s));
      } else if (filters.status && filters.status !== 'All Status') {
        params.append('status', filters.status);
      }
      if (filters.payment_methods && filters.payment_methods.length > 0) {
        filters.payment_methods.forEach(m => params.append('payment_method', m));
      } else if (filters.payment_method && filters.payment_method !== 'All Methods') {
        params.append('payment_method', filters.payment_method);
      }
      // Simple filters
      if (filters.search) params.append('search', filters.search);
      if (filters.unit_id) params.append('unit_id', filters.unit_id);
      if (filters.resident_id) params.append('resident_id', filters.resident_id);
      if (filters.service_fee_id) params.append('service_fee_id', filters.service_fee_id);
      if (filters.only_paid) params.append('only_paid', filters.only_paid);
      if (filters.stats) params.append('stats', filters.stats);
      // include_payment_details flag (default true)
      const includePaymentDetails = filters.include_payment_details ? 'false' : 'true';
      params.append('include_payment_details', includePaymentDetails);

      const queryString = params.toString();
      const url = queryString ? `/api/service-fee-management/residents/?${queryString}` : '/api/service-fee-management/residents/';
      const response = await axiosInstance.get(url);
      return response.data.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch unit receivables (Unit Receivables Page)
export const fetchServiceFeeUnitReceivables = createAsyncThunk(
  "serviceFeeManagement/fetchUnitReceivables",
  async (filters = {}, thunkAPI) => {
    try {
      const params = new URLSearchParams();
      // Period filters
      if (filters.service_period_month_from) params.append('service_period_month_from', filters.service_period_month_from);
      if (filters.service_period_year_from) params.append('service_period_year_from', filters.service_period_year_from);
      if (filters.service_period_month_to) params.append('service_period_month_to', filters.service_period_month_to);
      if (filters.service_period_year_to) params.append('service_period_year_to', filters.service_period_year_to);
      if (filters.service_period_month) params.append('service_period_month', filters.service_period_month);
      if (filters.service_period_year) params.append('service_period_year', filters.service_period_year);
      // Array based filters
      if (filters.tower_ids && filters.tower_ids.length > 0) {
        filters.tower_ids.forEach(id => params.append('tower_id', id));
      } else if (filters.tower_id && filters.tower_id !== 'All Towers') {
        params.append('tower_id', filters.tower_id);
      }
      if (filters.statuses && filters.statuses.length > 0) {
        filters.statuses.forEach(s => params.append('status', s));
      } else if (filters.status && filters.status !== 'All Status') {
        params.append('status', filters.status);
      }
      if (filters.payment_methods && filters.payment_methods.length > 0) {
        filters.payment_methods.forEach(m => params.append('payment_method', m));
      } else if (filters.payment_method && filters.payment_method !== 'All Methods') {
        params.append('payment_method', filters.payment_method);
      }
      // Simple filters
      if (filters.search) params.append('search', filters.search);
      if (filters.unit_id) params.append('unit_id', filters.unit_id);
      if (filters.resident_id) params.append('resident_id', filters.resident_id);
      if (filters.service_fee_id) params.append('service_fee_id', filters.service_fee_id);
      if (filters.only_paid) params.append('only_paid', filters.only_paid);
      if (filters.stats) params.append('stats', filters.stats);
      // include_payment_details flag (default true)
      const includePaymentDetails = filters.include_payment_details ? 'false' : 'true';
      params.append('include_payment_details', includePaymentDetails);

      const queryString = params.toString();
      const url = queryString ? `/api/service-fee-management/unit-receivables/?${queryString}` : '/api/service-fee-management/unit-receivables/';
      const response = await axiosInstance.get(url);
      return response.data.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch single resident (used after deletion)
export const fetchServiceFeeResidentsSingle = createAsyncThunk(
  "serviceFeeManagement/fetchResidentsSingle",
  async (filters = {}, thunkAPI) => {
    try {
      const params = new URLSearchParams();
      if (filters.service_period_month) params.append('service_period_month', filters.service_period_month);
      if (filters.service_period_year) params.append('service_period_year', filters.service_period_year);
      if (filters.unit_id) params.append('unit_id', filters.unit_id);
      if (filters.resident_id) params.append('resident_id', filters.resident_id);
      if (filters.service_fee_id) params.append('service_fee_id', filters.service_fee_id);
      const queryString = params.toString();
      const url = queryString ? `/api/service-fee-management/residents/?${queryString}` : '/api/service-fee-management/residents/';
      const response = await axiosInstance.get(url);
      return response.data.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Record payment
export const recordPayment = createAsyncThunk(
  "serviceFeeManagement/recordPayment",
  async (paymentData, thunkAPI) => {
    try {
      const response = await axiosInstance.post('/api/service-fee-management/payments/', paymentData);
      return response.data.data || response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Update payment
export const updatePayment = createAsyncThunk(
  "serviceFeeManagement/updatePayment",
  async ({ paymentId, paymentData }, thunkAPI) => {
    try {
      const response = await axiosInstance.patch(`/api/service-fee-management/payments/${paymentId}/`, paymentData);
      return response.data.data || response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Delete payment (existing)
export const deletePayment = createAsyncThunk(
  "serviceFeeManagement/deletePayment",
  async (paymentData, thunkAPI) => {
    try {
      const response = await axiosInstance.delete(`/api/service-fee-management/delete-generated-fee/`, { data: paymentData });
      return { ...paymentData, message: response.data.message };
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Delete billing transaction (payment)
export const deleteBillingTransaction = createAsyncThunk(
  "serviceFeeManagement/deleteBillingTransaction",
  async (billingId, thunkAPI) => {
    try {
      const response = await axiosInstance.delete(`/api/service-fee-management/billings/${billingId}/delete-transaction/`);
      // Try to get billing_pk from response if available, otherwise use billingId
      const billing_pk = response.data?.billing_pk || billingId;
      return { billingId, billing_pk, message: response.data.message };
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch payment history
export const fetchPaymentHistory = createAsyncThunk(
  "serviceFeeManagement/fetchPaymentHistory",
  async (filters = {}, thunkAPI) => {
    try {
      const params = new URLSearchParams();
      if (filters.unit_id) params.append('unit', filters.unit_id);
      if (filters.resident_id) params.append('resident_id', filters.resident_id);
      if (filters.service_fee_id) params.append('service_fee_id', filters.service_fee_id);
      if (filters.start_date) params.append('payment_date_start', filters.start_date);
      if (filters.end_date) params.append('payment_date_end', filters.end_date);
      if (filters.service_period_month) params.append('service_period_month', filters.service_period_month);
      if (filters.service_period_year) params.append('service_period_year', filters.service_period_year);

      // New filters
      if (filters.search) params.append('search', filters.search);
      if (filters.min_amount) params.append('min_amount', filters.min_amount);
      if (filters.max_amount) params.append('max_amount', filters.max_amount);
      if (filters.advance_filter) params.append('advance_filter', filters.advance_filter);

      // Multi-select filters
      if (filters.tower_ids) {
        const ids = typeof filters.tower_ids === 'string' ? filters.tower_ids.split(',') : filters.tower_ids;
        ids.forEach(id => params.append('tower_id', id));
      }

      if (filters.unit_ids) {
        const ids = typeof filters.unit_ids === 'string' ? filters.unit_ids.split(',') : filters.unit_ids;
        ids.forEach(id => params.append('unit_id_list', id));
      }

      if (filters.payment_method_ids) {
        const ids = typeof filters.payment_method_ids === 'string' ? filters.payment_method_ids.split(',') : filters.payment_method_ids;
        ids.forEach(id => params.append('method', id));
      }

      const queryString = params.toString();
      const url = queryString ? `/api/service-fee-management/payment-history/?${queryString}` : '/api/service-fee-management/payment-history/';
      const response = await axiosInstance.get(url);
      return response.data.data || response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Generate reports
export const generateReport = createAsyncThunk(
  "serviceFeeManagement/generateReport",
  async (reportParams, thunkAPI) => {
    try {
      const response = await axiosInstance.post('/api/service-fee-management/reports/', reportParams);
      return response.data.data || response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Send reminders
export const sendReminder = createAsyncThunk(
  "serviceFeeManagement/sendReminder",
  async (reminderData, thunkAPI) => {
    try {
      const response = await axiosInstance.post('/api/service-fee-management/reminders/', reminderData);
      return response.data.data || response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// ==================== REMINDER API FUNCTIONS ====================

// Fetch all reminders with filtering
export const fetchReminders = createAsyncThunk(
  "serviceFeeManagement/fetchReminders",
  async (filters = {}, thunkAPI) => {
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.status && filters.status !== 'All Status') params.append('status', filters.status);
      if (filters.reminder_type && filters.reminder_type !== 'All Types') params.append('reminder_type', filters.reminder_type);
      if (filters.audience && filters.audience !== 'All Audiences') params.append('audience', filters.audience);
      if (filters.channel && filters.channel !== 'All Channels') params.append('channel', filters.channel);
      const queryString = params.toString();
      const url = queryString ? `/api/service-fee-management/reminders/?${queryString}` : '/api/service-fee-management/reminders/';
      const response = await axiosInstance.get(url);
      return response.data.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Generate service fees for a specific month/year
export const generateServiceFee = createAsyncThunk(
  "serviceFeeManagement/generateServiceFee",
  async (data, thunkAPI) => {
    try {
      const response = await axiosInstance.post('/api/service-fee-management/generate-service-fee/', data);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch unit outstanding summary (Now using consolidated unit-ledger API)
export const fetchUnitOutstandingSummary = createAsyncThunk(
  "serviceFeeManagement/fetchUnitOutstandingSummary",
  async (filters = {}, thunkAPI) => {
    try {
      const params = new URLSearchParams();
      if (filters.tower_id) params.append('tower_id', filters.tower_id);
      if (filters.unit_id) params.append('unit_id', filters.unit_id);
      if (filters.search) params.append('search', filters.search);

      const queryString = params.toString();
      const url = queryString ? `/api/service-fee-management/unit-ledger/?${queryString}` : '/api/service-fee-management/unit-ledger/';
      const response = await axiosInstance.get(url);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch single reminder by ID
export const fetchReminderById = createAsyncThunk(
  "serviceFeeManagement/fetchReminderById",
  async (reminderId, thunkAPI) => {
    try {
      const response = await axiosInstance.get(`/api/service-fee-management/reminders/${reminderId}/`);
      return response.data.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Create new reminder
export const createReminder = createAsyncThunk(
  "serviceFeeManagement/createReminder",
  async (reminderData, thunkAPI) => {
    try {
      const response = await axiosInstance.post('/api/service-fee-management/reminders/create/', reminderData);
      return response.data.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Update reminder
export const updateReminder = createAsyncThunk(
  "serviceFeeManagement/updateReminder",
  async ({ reminderId, reminderData }, thunkAPI) => {
    try {
      const response = await axiosInstance.put(`/api/service-fee-management/reminders/${reminderId}/`, reminderData);
      return response.data.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Delete reminder
export const deleteReminder = createAsyncThunk(
  "serviceFeeManagement/deleteReminder",
  async (reminderId, thunkAPI) => {
    try {
      const response = await axiosInstance.delete(`/api/service-fee-management/reminders/${reminderId}/`);
      return { id: reminderId, message: response.data.message };
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Send reminder manually
export const sendReminderManually = createAsyncThunk(
  "serviceFeeManagement/sendReminderManually",
  async (reminderId, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/api/service-fee-management/reminders/${reminderId}/send/`);
      return response.data.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch reminder logs
export const fetchReminderLogs = createAsyncThunk(
  "serviceFeeManagement/fetchReminderLogs",
  async (filters = {}, thunkAPI) => {
    try {
      const params = new URLSearchParams();
      if (filters.reminderId) {
        const url = `/api/service-fee-management/reminders/${filters.reminderId}/logs/`;
        const response = await axiosInstance.get(url);
        return response.data.data;
      } else {
        if (filters.start_date) params.append('start_date', filters.start_date);
        if (filters.end_date) params.append('end_date', filters.end_date);
        if (filters.delivery_status) params.append('delivery_delivery_status', filters.delivery_status);
        const queryString = params.toString();
        const url = queryString ? `/api/service-fee-management/reminder-logs/?${queryString}` : '/api/service-fee-management/reminder-logs/';
        const response = await axiosInstance.get(url);
        return response.data.data;
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch unit ledger (transaction history based on vouchers)
export const fetchUnitLedger = createAsyncThunk(
  "serviceFeeManagement/fetchUnitLedger",
  async (filters = {}, thunkAPI) => {
    try {
      const params = new URLSearchParams();

      // Core criteria
      if (filters.unit_id) params.append('unit_id', filters.unit_id);
      if (filters.page) params.append('page', filters.page);
      if (filters.page_size) params.append('page_size', filters.page_size);

      // Filter criteria (same pattern as other list APIs)
      if (filters.search) params.append('search', filters.search);
      if (filters.service_period_month) params.append('service_period_month', filters.service_period_month);
      if (filters.service_period_year) params.append('service_period_year', filters.service_period_year);
      if (filters.service_period_month_from) params.append('service_period_month_from', filters.service_period_month_from);
      if (filters.service_period_year_from) params.append('service_period_year_from', filters.service_period_year_from);
      if (filters.service_period_month_to) params.append('service_period_month_to', filters.service_period_month_to);
      if (filters.service_period_year_to) params.append('service_period_year_to', filters.service_period_year_to);

      // Handle multi-select status if needed
      if (filters.statuses && filters.statuses.length > 0) {
        filters.statuses.forEach(s => params.append('status', s));
      }

      const queryString = params.toString();
      const url = queryString ? `/api/service-fee-management/unit-ledger/?${queryString}` : '/api/service-fee-management/unit-ledger/';

      const response = await axiosInstance.get(url);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);