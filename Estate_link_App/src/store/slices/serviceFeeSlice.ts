import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { API_CONFIG, enhancedFetch } from '../../utils/networkUtils';
import { logout } from './authSlice';

// Types
export interface ServiceFeePayment {
  id: number;
  receipt_id?: string;  // Receipt ID field
  transaction_id: string;
  service_fee: number;
  resident?: number;
  unit: number;
  unit_id: number;  // Add unit_id field
  resident_name?: string;
  resident_email?: string;
  member_id?: number;
  unit_number: string;
  tower_name: string;
  service_fee_amount: string;
  amount: string;
  original_amount?: string;
  remaining_amount?: string;
  penalty_amount?: string;
  waived_amount?: string;
  penalty_after_waiver?: string;
  waiver_reason?: string;
  currency: string;
  payment_method: string;
  payment_method_display?: string;  // Display name for payment method
  method_display?: string;  // Alias for payment_method_display
  payment_status: string;
  service_status: string;
  service_status_display: string;  // Current billing status (changes when new payments are made)
  payment_result_status?: string;  // Historical status at time of payment (never changes)
  payment_result_display?: string;  // Historical display status at time of payment (never changes)
  is_overdue: boolean;
  is_fully_paid: boolean;
  is_partial_payment: boolean;
  payment_percentage: number;
  outstanding_amount: number;
  created_by_name?: string;
  payment_date?: string;
  due_date?: string;
  completion_date?: string;
  reference_number?: string;
  notes?: string;
  service_period_month: number;
  service_period_year: number;
  service_period_display: string;
  created_by?: number;
  created_at: string;
  updated_by?: number;
  updated_at: string;
}

export interface Unit {
  id: number;
  unit_id: number;  // Actual unit ID (same across all months)
  unit_name: string;
  unit_display: string;
  tower_name: string;
  tower_id: number;
  service_fee_id: number;
  fee_amount: string;
  amount: string;
  due_amount: string;
  due_day: number;
  payment_method: string;
  method_display: string;
  service_status: string;
  payment_date?: string;
  payment_status?: string;
  transaction_id?: string;
  service_period_month?: number;
  service_period_year?: number;
  reference_number?: string;
  due_date: string;
  frequency: string;
  unit_total_advance?: number | string;  // Total advance payment balance for the unit
  advance_balance?: number | string;     // Alias for unit_total_advance
}

export interface UpcomingBilling {
  billing_id: number;
  unit_id: number;
  unit_name: string;
  tower_name: string;
  tower_id: number;
  service_fee_id: number;
  billing_amount: string;
  fee_amount: string;
  total_paid: string;
  remaining_amount: string;
  due_date: string | null;
  service_period_month: number;
  service_period_year: number;
  service_status: string;
  due_day: number;
}

export interface ServiceFeeState {
  // Data
  units: Unit[];
  accessibleUnits: Unit[]; // Units from access check (all units user can access)
  payments: ServiceFeePayment[];
  selectedUnit: Unit | null;
  upcomingBillings: UpcomingBilling[]; // Upcoming month's billing data
  detailedBill: any | null; // Detailed bill data
  
  // Loading states
  isLoadingUnits: boolean;
  isLoadingPayments: boolean;
  isLoadingDetailedBill: boolean;
  isCreatingPayment: boolean;
  isUpdatingPayment: boolean;
  isDeletingPayment: boolean;
  isLoadingUpcomingBillings: boolean;
  
  // Error states
  unitsError: string | null;
  paymentsError: string | null;
  paymentError: string | null;
  upcomingBillingsError: string | null;
  detailedBillError: string | null;
  
  // Access control
  hasAccess: boolean;
  accessChecked: boolean;
  
  // Filters
  filters: {
    tower_id?: number[];
    status?: string[];
    payment_method?: string[];
    service_period_month?: number;
    service_period_year?: number;
    search?: string;
  };
  
  // Stats
  stats: {
    totalPayments: number;
    totalFeeAmount: string;
    totalPaidAmount: string;
    totalDueAmount: string;
    completedCount: number;
    completedAmount: string;
    dueCount: number;
    dueAmount: string;
    overdueCount: number;
    overdueAmount: string;
  } | null;
}

// Initial state
const initialState: ServiceFeeState = {
  units: [],
  accessibleUnits: [],
  payments: [],
  selectedUnit: null,
  upcomingBillings: [],
  detailedBill: null,
  
  isLoadingUnits: false,
  isLoadingPayments: false,
  isLoadingDetailedBill: false,
  isCreatingPayment: false,
  isUpdatingPayment: false,
  isDeletingPayment: false,
  isLoadingUpcomingBillings: false,
  
  unitsError: null,
  paymentsError: null,
  paymentError: null,
  upcomingBillingsError: null,
  detailedBillError: null,
  
  hasAccess: false,
  accessChecked: false,
  
  filters: {},
  
  stats: null,
};

// Async thunks
export const checkServiceFeeAccess = createAsyncThunk(
  'serviceFee/checkAccess',
  async (_, { getState }) => {
    const state = getState() as any;
    const user = state.auth.user;
    const accessToken = state.auth.accessToken;
    
    if (!user || !user.id) {
      throw new Error('User not authenticated');
    }
    
    if (!accessToken) {
      throw new Error('No access token available');
    }
    
    console.log('📱 [MOBILE] Checking service fee access with new mobile endpoint...');
    
    // Use dedicated mobile access check endpoint
    const response = await enhancedFetch(
      `${API_CONFIG.BASE_URL}/api/service-fee-management/mobile/check-access/`,
      {
        method: 'GET',
      },
      API_CONFIG.TIMEOUT,
      accessToken
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log('❌ [MOBILE] Access check failed:', errorData);
      throw new Error(errorData.message || 'Failed to check access');
    }
    
    const data = await response.json();
    console.log('✅ [MOBILE] Access check response:', {
      hasAccess: data.hasAccess,
      reason: data.reason || 'N/A',
      message: data.message,
      unit: data.unit || null,
      unitsCount: data.units?.length || 0
    });
    
    // User has access if the API returns hasAccess: true
    const hasAccess = data.hasAccess === true;
    
    // Get units from access check response (these are the units user has access to)
    // This ensures we have unit data even when no payment records exist
    const accessibleUnits = data.units || [];
    
    return {
      hasAccess,
      units: accessibleUnits, // Units from access check (for fallback when no payment data)
      accessMessage: data.message,
      accessReason: data.reason
    };
  }
);

export const fetchUnits = createAsyncThunk(
  'serviceFee/fetchUnits',
  async (params: any = {}, { getState }) => {
    const state = getState() as any;
    const accessToken = state.auth.accessToken;
    
    if (!accessToken) {
      throw new Error('No access token available');
    }
    
    const queryParams = new URLSearchParams();
    
    // Add filters to query params
    if (params.tower_id && params.tower_id.length > 0) {
      params.tower_id.forEach((id: number) => queryParams.append('tower_id', id.toString()));
    }
    if (params.status && params.status.length > 0) {
      params.status.forEach((status: string) => queryParams.append('status', status));
    }
    if (params.payment_method && params.payment_method.length > 0) {
      params.payment_method.forEach((method: string) => queryParams.append('payment_method', method));
    }
    
    // Support both single period and date range
    if (params.service_period_month_from && params.service_period_year_from) {
      queryParams.append('service_period_month_from', params.service_period_month_from.toString());
      queryParams.append('service_period_year_from', params.service_period_year_from.toString());
    }
    if (params.service_period_month_to && params.service_period_year_to) {
      queryParams.append('service_period_month_to', params.service_period_month_to.toString());
      queryParams.append('service_period_year_to', params.service_period_year_to.toString());
    }
    
    // Fallback to single period if no date range specified
    if (!params.service_period_month_from && !params.service_period_month_to) {
      if (params.service_period_month) {
        queryParams.append('service_period_month', params.service_period_month.toString());
      }
      if (params.service_period_year) {
        queryParams.append('service_period_year', params.service_period_year.toString());
      }
    }
    
    if (params.search) {
      queryParams.append('search', params.search);
    }
    if (params.stats) {
      queryParams.append('stats', 'true');
    }
    
    // Add source=mobile to query params
    queryParams.append('source', 'mobile');
    
    console.log('📡 fetchUnits API call params:', {
      params,
      queryString: queryParams.toString(),
      url: `${API_CONFIG.BASE_URL}/api/service-fee-management/residents/?${queryParams.toString()}`
    });
    
    const response = await enhancedFetch(
      `${API_CONFIG.BASE_URL}/api/service-fee-management/residents/?${queryParams.toString()}`,
      {
        method: 'GET',
      },
      API_CONFIG.TIMEOUT,
      accessToken
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to fetch units');
    }
    
    const data = await response.json();
    return data;
  }
);

export const fetchDetailedBill = createAsyncThunk(
  'serviceFee/fetchDetailedBill',
  async (params: { 
    payment_id?: number | string; 
    unit_id?: number | string; 
    account_holder_type?: string; 
    account_holder_id?: number | string;
    service_period_month?: number | string;
    service_period_year?: number | string;
  }, { getState }) => {
    const state = getState() as any;
    const accessToken = state.auth.accessToken;

    if (!accessToken) {
      throw new Error('No access token available');
    }

    const queryParams = new URLSearchParams();
    if (params.payment_id) queryParams.append('payment_id', params.payment_id.toString());
    if (params.unit_id) queryParams.append('unit_id', params.unit_id.toString());
    if (params.account_holder_type) queryParams.append('account_holder_type', params.account_holder_type);
    if (params.account_holder_id) queryParams.append('account_holder_id', params.account_holder_id.toString());
    
    // Support fetching by period (map to range filters for precise match)
    if (params.service_period_month) {
      queryParams.append('service_period_month_from', params.service_period_month.toString());
      queryParams.append('service_period_month_to', params.service_period_month.toString());
    }
    if (params.service_period_year) {
      queryParams.append('service_period_year_from', params.service_period_year.toString());
      queryParams.append('service_period_year_to', params.service_period_year.toString());
    }

    console.log('📡 fetchDetailedBill API call params:', {
      params,
      url: `${API_CONFIG.BASE_URL}/api/service-fee-management/billing-detailed/?${queryParams.toString()}`
    });

    const response = await enhancedFetch(
      `${API_CONFIG.BASE_URL}/api/service-fee-management/billing-detailed/?${queryParams.toString()}`,
      {
        method: 'GET',
      },
      API_CONFIG.TIMEOUT,
      accessToken
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to fetch detailed bill');
    }

    const data = await response.json();
    return data;
  }
);

export const fetchPayments = createAsyncThunk(
  'serviceFee/fetchPayments',
  async (params: any = {}, { getState }) => {
    const state = getState() as any;
    const accessToken = state.auth.accessToken;
    
    if (!accessToken) {
      throw new Error('No access token available');
    }
    
    const queryParams = new URLSearchParams();
    
    // Add filters to query params
    if (params.status && params.status.length > 0) {
      params.status.forEach((status: string) => queryParams.append('status', status));
    }
    if (params.method && params.method.length > 0) {
      params.method.forEach((method: string) => queryParams.append('method', method));
    }
    if (params.tower_id && params.tower_id.length > 0) {
      params.tower_id.forEach((id: number) => queryParams.append('tower_id', id.toString()));
    }
    if (params.resident_id) {
      queryParams.append('resident_id', params.resident_id.toString());
    }
    if (params.unit) {
      queryParams.append('unit', params.unit.toString());
    }
    if (params.search) {
      queryParams.append('search', params.search);
    }
    if (params.page) {
      queryParams.append('page', params.page.toString());
    }
    if (params.page_size) {
      queryParams.append('page_size', params.page_size.toString());
    }
    if (params.ordering) {
      queryParams.append('ordering', params.ordering);
    }
    if (params.start_date) {
      queryParams.append('start_date', params.start_date);
    }
    if (params.end_date) {
      queryParams.append('end_date', params.end_date);
    }
    
    const response = await enhancedFetch(
      `${API_CONFIG.BASE_URL}/api/service-fee-management/payments/?${queryParams.toString()}`,
      {
        method: 'GET',
      },
      API_CONFIG.TIMEOUT,
      accessToken
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to fetch payments');
    }
    
    const data = await response.json();
    console.log('🔍 fetchPayments response:', {
      success: data.success,
      paymentsCount: data.data?.payments?.length || 0,
      firstPayment: data.data?.payments?.[0] || null,
      params
    });
    
    // Check receipt_id in payments
    if (data.data?.payments?.length > 0) {
      const firstPayment = data.data.payments[0];
      console.log('📄 First payment receipt_id check:', {
        payment_id: firstPayment.id,
        receipt_id: firstPayment.receipt_id,
        has_receipt_id: !!firstPayment.receipt_id,
        transaction_id: firstPayment.transaction_id
      });
    }
    
    return data;
  }
);

export const createPayment = createAsyncThunk(
  'serviceFee/createPayment',
  async (paymentData: any, { getState }) => {
    const state = getState() as any;
    const user = state.auth.user;
    const accessToken = state.auth.accessToken;
    
    if (!user || !user.id) {
      throw new Error('User not authenticated');
    }
    
    if (!accessToken) {
      throw new Error('No access token available');
    }
    
    const response = await enhancedFetch(
      `${API_CONFIG.BASE_URL}/api/service-fee-management/payments/`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...paymentData,
          created_by_id: user.id,
        }),
      },
      API_CONFIG.TIMEOUT,
      accessToken
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to create payment');
    }
    
    return response.json();
  }
);

export const updatePayment = createAsyncThunk(
  'serviceFee/updatePayment',
  async ({ id, ...updateData }: { id: number; [key: string]: any }, { getState }) => {
    const state = getState() as any;
    const user = state.auth.user;
    const accessToken = state.auth.accessToken;
    
    if (!user || !user.id) {
      throw new Error('User not authenticated');
    }
    
    if (!accessToken) {
      throw new Error('No access token available');
    }
    
    const response = await enhancedFetch(
      `${API_CONFIG.BASE_URL}/api/service-fee-management/payments/${id}/`,
      {
        method: 'PUT',
        body: JSON.stringify({
          ...updateData,
          updated_by_id: user.id,
        }),
      },
      API_CONFIG.TIMEOUT,
      accessToken
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to update payment');
    }
    
    return response.json();
  }
);

export const deletePayment = createAsyncThunk(
  'serviceFee/deletePayment',
  async (id: number, { getState }) => {
    const state = getState() as any;
    const accessToken = state.auth.accessToken;
    
    if (!accessToken) {
      throw new Error('No access token available');
    }
    
    const response = await enhancedFetch(
      `${API_CONFIG.BASE_URL}/api/service-fee-management/payments/${id}/`,
      {
        method: 'DELETE',
      },
      API_CONFIG.TIMEOUT,
      accessToken
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to delete payment');
    }
    
    return id;
  }
);

export const fetchPaymentChoices = createAsyncThunk(
  'serviceFee/fetchPaymentChoices',
  async (_, { getState }) => {
    const state = getState() as any;
    const accessToken = state.auth.accessToken;
    
    if (!accessToken) {
      throw new Error('No access token available');
    }
    
    const response = await enhancedFetch(
      `${API_CONFIG.BASE_URL}/api/service-fee-management/payment-choices/`,
      {
        method: 'GET',
      },
      API_CONFIG.TIMEOUT,
      accessToken
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to fetch payment choices');
    }
    
    return response.json();
  }
);

export const fetchFilterOptions = createAsyncThunk(
  'serviceFee/fetchFilterOptions',
  async (_, { getState }) => {
    const state = getState() as any;
    const accessToken = state.auth.accessToken;
    
    if (!accessToken) {
      throw new Error('No access token available');
    }
    
    const response = await enhancedFetch(
      `${API_CONFIG.BASE_URL}/api/service-fee-management/filter-options/`,
      {
        method: 'GET',
      },
      API_CONFIG.TIMEOUT,
      accessToken
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to fetch filter options');
    }
    
    return response.json();
  }
);

export const fetchUpcomingBillings = createAsyncThunk(
  'serviceFee/fetchUpcomingBillings',
  async (_, { getState }) => {
    const state = getState() as any;
    const accessToken = state.auth.accessToken;
    
    if (!accessToken) {
      throw new Error('No access token available');
    }
    
    console.log('📡 Fetching upcoming billings API call...', {
      endpoint: `${API_CONFIG.BASE_URL}/api/service-fee-management/mobile/upcoming-billing/`,
      purpose: 'Get next month billing with CURRENT service fee settings (fee_amount)'
    });
    
    const response = await enhancedFetch(
      `${API_CONFIG.BASE_URL}/api/service-fee-management/mobile/upcoming-billing/`,
      {
        method: 'GET',
      },
      API_CONFIG.TIMEOUT,
      accessToken
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to fetch upcoming billings');
    }
    
    const data = await response.json();
    console.log('📥 Upcoming billings API response:', {
      success: data.success,
      billingsCount: data.data?.billings?.length || 0,
      nextMonth: data.data?.next_month,
      nextYear: data.data?.next_year,
      rawBillings: data.data?.billings?.map((b: any) => ({
        unit: `${b.tower_name}, ${b.unit_name}`,
        billing_amount: b.billing_amount,  // OLD snapshot from when bill was generated
        fee_amount: b.fee_amount,          // CURRENT service fee from ServiceFee table
        difference: parseFloat(b.fee_amount) - parseFloat(b.billing_amount),
        month: `${b.service_period_month}/${b.service_period_year}`,
        status: parseFloat(b.fee_amount) !== parseFloat(b.billing_amount) 
          ? '⚠️ UPDATED - fee_amount is the correct one to use' 
          : '✓ No change'
      }))
    });
    
    return data;
  }
);

// Slice
const serviceFeeSlice = createSlice({
  name: 'serviceFee',
  initialState,
  reducers: {
    setSelectedUnit: (state, action: PayloadAction<Unit | null>) => {
      state.selectedUnit = action.payload;
    },
    setFilters: (state, action: PayloadAction<Partial<ServiceFeeState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = {};
    },
    clearErrors: (state) => {
      state.unitsError = null;
      state.paymentsError = null;
      state.paymentError = null;
    },
    resetState: () => initialState,
  },
  extraReducers: (builder) => {
    // Check access
    builder
      .addCase(checkServiceFeeAccess.pending, (state) => {
        state.accessChecked = false;
        state.unitsError = null;
        console.log('🔄 [MOBILE] Checking access...');
      })
      .addCase(checkServiceFeeAccess.fulfilled, (state, action) => {
        state.hasAccess = action.payload.hasAccess;
        state.accessChecked = true;
        
        // ALWAYS store accessible units from access check
        // These represent ALL units the user has access to (regardless of payment records)
        if (action.payload.units && action.payload.units.length > 0) {
          state.accessibleUnits = action.payload.units;
          console.log('✅ [MOBILE] Access check completed - stored accessible units:', {
            hasAccess: action.payload.hasAccess,
            accessibleUnitsCount: action.payload.units.length,
            units: action.payload.units.map((u: any) => `${u.tower_name}, ${u.unit_name}`)
          });
          
          // Also populate units array if empty (for backward compatibility)
          if (state.units.length === 0) {
            state.units = action.payload.units;
          }
        } else {
          console.log('✅ [MOBILE] Access check completed:', {
            hasAccess: action.payload.hasAccess,
            message: action.payload.accessMessage
          });
        }
      })
      .addCase(checkServiceFeeAccess.rejected, (state, action) => {
        state.hasAccess = false;
        state.accessChecked = true;
        state.unitsError = action.error.message || 'Failed to check access';
        console.log('❌ [MOBILE] Access check failed:', state.unitsError);
      });

    // Fetch units
    builder
      .addCase(fetchUnits.pending, (state) => {
        state.isLoadingUnits = true;
        state.unitsError = null;
      })
      .addCase(fetchUnits.fulfilled, (state, action) => {
        state.isLoadingUnits = false;
        if (action.payload.success && action.payload.data) {
          const newUnits = action.payload.data.payments || [];
          
          // If API returns empty data but we have units from access check, preserve them
          // This ensures the screen shows properly even when no payment records exist
          if (newUnits.length === 0 && state.units.length > 0) {
            // Check if current units are from access check (have service_status: 'no_records')
            const hasAccessCheckUnits = state.units.some((unit: any) => unit.service_status === 'no_records');
            
            if (hasAccessCheckUnits) {
              console.log('✅ fetchUnits: API returned empty data, preserving units from access check', {
                currentUnitsCount: state.units.length,
                units: state.units.map((u: any) => `${u.tower_name}, ${u.unit_name}`)
              });
              // Keep the existing units from access check - don't clear them
              if (action.payload.data.stats) {
                state.stats = action.payload.data.stats;
              }
              return;
            }
            
            // Check if previous units have unpaid payments for the selected unit
            if (state.selectedUnit) {
              const hasUnpaidPayments = state.units.some(unit => {
                const matchesUnit = (unit.unit_id && state.selectedUnit?.unit_id && unit.unit_id === state.selectedUnit.unit_id) ||
                                   (unit.tower_name === state.selectedUnit?.tower_name && unit.unit_name === state.selectedUnit?.unit_name);
                if (!matchesUnit) return false;
                
                // Check if it's an unpaid payment (has due_amount > 0 or status is overdue/due/partial)
                const dueAmount = parseFloat(unit.due_amount || '0');
                const isUnpaid = dueAmount > 0 || 
                                unit.service_status === 'overdue' || 
                                unit.service_status === 'due' || 
                                unit.service_status === 'partial';
                return isUnpaid;
              });
              
              if (hasUnpaidPayments) {
                const unpaidMonths = state.units
                  .filter(unit => {
                    const matchesUnit = (unit.unit_id && state.selectedUnit?.unit_id && unit.unit_id === state.selectedUnit.unit_id) ||
                                       (unit.tower_name === state.selectedUnit?.tower_name && unit.unit_name === state.selectedUnit?.unit_name);
                    if (!matchesUnit) return false;
                    
                    const dueAmount = parseFloat(unit.due_amount || '0');
                    const isUnpaid = dueAmount > 0 || 
                                    unit.service_status === 'overdue' || 
                                    unit.service_status === 'due' || 
                                    unit.service_status === 'partial';
                    return isUnpaid;
                  })
                  .map(unit => `${unit.service_period_month}/${unit.service_period_year}`);
                
                console.log('⚠️ fetchUnits: API returned empty data, preserving previous unpaid payments', {
                  previousUnitsCount: state.units.length,
                  selectedUnitId: state.selectedUnit.unit_id,
                  unpaidPaymentsFound: true,
                  unpaidMonths: unpaidMonths.join(', '),
                  totalUnpaidCount: unpaidMonths.length
                });
                // Keep the existing units array - don't clear it
                // This preserves all unpaid months when API temporarily returns empty
                // Only update stats if provided
                if (action.payload.data.stats) {
                  state.stats = action.payload.data.stats;
                }
                return; // Don't update units, preserve previous data
              }
            }
          }
          
          // Normal case: update units with new data (if we have payment records)
          if (newUnits.length > 0) {
            const unpaidMonthsList = newUnits
              .filter((unit: Unit) => {
                const dueAmount = parseFloat(unit.due_amount || '0');
                return dueAmount > 0 || 
                       unit.service_status === 'overdue' || 
                       unit.service_status === 'due' || 
                       unit.service_status === 'partial';
              })
              .map((unit: Unit) => `${unit.service_period_month}/${unit.service_period_year}`)
              .join(', ');
            
            console.log('✅ fetchUnits: API returned data', {
              totalUnits: newUnits.length,
              unpaidMonths: unpaidMonthsList,
              unpaidCount: unpaidMonthsList.split(', ').filter((m: string) => m).length
            });
            
            state.units = newUnits;
            state.stats = action.payload.data.stats || null;
            
            // Update selectedUnit with fresh data if one is currently selected
            // Use unit_id instead of id (which includes month/year)
            if (state.selectedUnit) {
              const updatedUnit = newUnits.find((unit: Unit) => unit.unit_id === state.selectedUnit?.unit_id);
              if (updatedUnit) {
                state.selectedUnit = updatedUnit;
              }
            }
          } else {
            // No payment records but we might have access check units already
            console.log('ℹ️ fetchUnits: No payment records found, keeping existing units:', {
              existingUnitsCount: state.units.length
            });
            // Don't clear units - keep the ones from access check
            if (action.payload.data.stats) {
              state.stats = action.payload.data.stats;
            }
          }
        }
      })
      .addCase(fetchUnits.rejected, (state, action) => {
        state.isLoadingUnits = false;
        state.unitsError = action.error.message || 'Failed to fetch units';
      });

    // Fetch payments
    builder
      .addCase(fetchPayments.pending, (state) => {
        state.isLoadingPayments = true;
        state.paymentsError = null;
      })
      .addCase(fetchPayments.fulfilled, (state, action) => {
        state.isLoadingPayments = false;
        console.log('🔍 Redux fetchPayments.fulfilled:', {
          success: action.payload.success,
          hasData: !!action.payload.data,
          paymentsCount: action.payload.data?.payments?.length || 0,
          firstPayment: action.payload.data?.payments?.[0] || null
        });
        
        // Check receipt_id in received payments
        if (action.payload.data?.payments?.length > 0) {
          const firstPayment = action.payload.data.payments[0];
          console.log('📄 Redux storing payment with receipt_id:', {
            payment_id: firstPayment.id,
            receipt_id: firstPayment.receipt_id,
            has_receipt_id: !!firstPayment.receipt_id,
            transaction_id: firstPayment.transaction_id
          });
        }
        
        if (action.payload.success && action.payload.data) {
          state.payments = action.payload.data.payments || [];
          console.log('📄 Redux state updated. Total payments stored:', state.payments.length);
        }
      })
      .addCase(fetchPayments.rejected, (state, action) => {
        state.isLoadingPayments = false;
        state.paymentsError = action.error.message || 'Failed to fetch payments';
      });

    // Create payment
    builder
      .addCase(createPayment.pending, (state) => {
        state.isCreatingPayment = true;
        state.paymentError = null;
      })
      .addCase(createPayment.fulfilled, (state, action) => {
        state.isCreatingPayment = false;
        if (action.payload.success && action.payload.data) {
          state.payments.unshift(action.payload.data);
        }
      })
      .addCase(createPayment.rejected, (state, action) => {
        state.isCreatingPayment = false;
        state.paymentError = action.error.message || 'Failed to create payment';
      });

    // Update payment
    builder
      .addCase(updatePayment.pending, (state) => {
        state.isUpdatingPayment = true;
        state.paymentError = null;
      })
      .addCase(updatePayment.fulfilled, (state, action) => {
        state.isUpdatingPayment = false;
        if (action.payload.success && action.payload.data) {
          const index = state.payments.findIndex(p => p.id === action.payload.data.id);
          if (index !== -1) {
            state.payments[index] = action.payload.data;
          }
        }
      })
      .addCase(updatePayment.rejected, (state, action) => {
        state.isUpdatingPayment = false;
        state.paymentError = action.error.message || 'Failed to update payment';
      });

    // Delete payment
    builder
      .addCase(deletePayment.pending, (state) => {
        state.isDeletingPayment = true;
        state.paymentError = null;
      })
      .addCase(deletePayment.fulfilled, (state, action) => {
        state.isDeletingPayment = false;
        state.payments = state.payments.filter(p => p.id !== action.payload);
      })
      .addCase(deletePayment.rejected, (state, action) => {
        state.isDeletingPayment = false;
        state.paymentError = action.error.message || 'Failed to delete payment';
      });

    // Fetch upcoming billings
    builder
      .addCase(fetchUpcomingBillings.pending, (state) => {
        state.isLoadingUpcomingBillings = true;
        state.upcomingBillingsError = null;
      })
      .addCase(fetchUpcomingBillings.fulfilled, (state, action) => {
        state.isLoadingUpcomingBillings = false;
        if (action.payload.success && action.payload.data) {
          state.upcomingBillings = action.payload.data.billings || [];
          console.log('✅ Upcoming billings stored in Redux:', {
            count: state.upcomingBillings.length,
            billings: state.upcomingBillings.map(b => ({
              unit: `${b.tower_name}, ${b.unit_name}`,
              billing_amount: b.billing_amount,  // OLD snapshot (should NOT be used in UI)
              fee_amount: b.fee_amount,          // CURRENT service fee (MUST be used in UI)
              amount_difference: parseFloat(b.fee_amount) - parseFloat(b.billing_amount),
              month: `${b.service_period_month}/${b.service_period_year}`,
              warning: parseFloat(b.fee_amount) !== parseFloat(b.billing_amount) 
                ? '⚠️ fee_amount differs from billing_amount - UI MUST use fee_amount' 
                : '✓ Amounts match'
            }))
          });
        }
      })
      .addCase(fetchUpcomingBillings.rejected, (state, action) => {
        state.isLoadingUpcomingBillings = false;
        state.upcomingBillingsError = action.error.message || 'Failed to fetch upcoming billings';
        console.log('❌ Failed to fetch upcoming billings:', state.upcomingBillingsError);
      })
      
      // Fetch detailed bill
      .addCase(fetchDetailedBill.pending, (state) => {
        state.isLoadingDetailedBill = true;
        state.detailedBillError = null;
        state.detailedBill = null;
      })
      .addCase(fetchDetailedBill.fulfilled, (state, action) => {
        state.isLoadingDetailedBill = false;
        if (action.payload.success) {
          state.detailedBill = action.payload.data;
          console.log('✅ Detailed bill stored in Redux:', {
            hasData: !!state.detailedBill,
            billId: state.detailedBill?.bill?.id
          });
        }
      })
      .addCase(fetchDetailedBill.rejected, (state, action) => {
        state.isLoadingDetailedBill = false;
        state.detailedBillError = action.error.message || 'Failed to fetch detailed bill';
        console.log('❌ Failed to fetch detailed bill:', state.detailedBillError);
      })

      // Clear service fee data when user logs out
      .addCase(logout, (state) => {
        console.log('🧹 Clearing service fee data on logout');
        return initialState;
      });
  },
});

export const {
  setSelectedUnit,
  setFilters,
  clearFilters,
  clearErrors,
  resetState,
} = serviceFeeSlice.actions;

export default serviceFeeSlice.reducer;
