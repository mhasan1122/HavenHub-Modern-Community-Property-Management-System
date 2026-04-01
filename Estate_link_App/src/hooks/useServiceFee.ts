import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import {
  checkServiceFeeAccess,
  fetchUnits,
  fetchPayments,
  createPayment,
  updatePayment,
  deletePayment,
  fetchPaymentChoices,
  fetchFilterOptions,
  fetchUpcomingBillings,
  setSelectedUnit,
  setFilters,
  clearFilters,
  clearErrors,
  resetState,
  ServiceFeePayment,
  Unit,
  UpcomingBilling,
} from '../store/slices/serviceFeeSlice';

export const useServiceFee = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    units,
    accessibleUnits,
    payments,
    selectedUnit,
    upcomingBillings,
    isLoadingUnits,
    isLoadingPayments,
    isCreatingPayment,
    isUpdatingPayment,
    isDeletingPayment,
    isLoadingUpcomingBillings,
    unitsError,
    paymentsError,
    paymentError,
    upcomingBillingsError,
    hasAccess,
    accessChecked,
    filters,
    stats,
  } = useSelector((state: RootState) => state.serviceFee);

  // Check access on mount
  useEffect(() => {
    if (!accessChecked) {
      dispatch(checkServiceFeeAccess());
    }
  }, [dispatch, accessChecked]);

  // Actions
  const checkAccess = useCallback(() => {
    dispatch(checkServiceFeeAccess());
  }, [dispatch]);

  const loadUnits = useCallback((params?: any) => {
    dispatch(fetchUnits({ ...filters, ...params }));
  }, [dispatch, filters]);

  const loadPayments = useCallback((params?: any) => {
    dispatch(fetchPayments(params));
  }, [dispatch]);

  const createNewPayment = useCallback((paymentData: any) => {
    return dispatch(createPayment(paymentData));
  }, [dispatch]);

  const updateExistingPayment = useCallback((id: number, updateData: any) => {
    return dispatch(updatePayment({ id, ...updateData }));
  }, [dispatch]);

  const removePayment = useCallback((id: number) => {
    return dispatch(deletePayment(id));
  }, [dispatch]);

  const loadPaymentChoices = useCallback(() => {
    dispatch(fetchPaymentChoices());
  }, [dispatch]);

  const loadFilterOptions = useCallback(() => {
    dispatch(fetchFilterOptions());
  }, [dispatch]);

  const loadUpcomingBillings = useCallback(() => {
    return dispatch(fetchUpcomingBillings());
  }, [dispatch]);

  const selectUnit = useCallback((unit: Unit | null) => {
    dispatch(setSelectedUnit(unit));
  }, [dispatch]);

  const updateFilters = useCallback((newFilters: any) => {
    dispatch(setFilters(newFilters));
  }, [dispatch]);

  const resetFilters = useCallback(() => {
    dispatch(clearFilters());
  }, [dispatch]);

  const clearAllErrors = useCallback(() => {
    dispatch(clearErrors());
  }, [dispatch]);

  const resetServiceFeeState = useCallback(() => {
    dispatch(resetState());
  }, [dispatch]);

  // Computed values
  const currentUnitPayments = selectedUnit 
    ? payments.filter(payment => payment.unit === selectedUnit.id)
    : [];

  const upcomingPayments = units.filter(unit => 
    unit.service_status === 'due' || unit.service_status === 'overdue'
  );

  const paidPayments = units.filter(unit => 
    unit.service_status === 'paid'
  );

  const totalOutstanding = units.reduce((sum, unit) => {
    const dueAmount = parseFloat(unit.due_amount) || 0;
    return sum + dueAmount;
  }, 0);

  const isLoading = isLoadingUnits || isLoadingPayments || isCreatingPayment || isUpdatingPayment || isDeletingPayment || isLoadingUpcomingBillings;
  const error = unitsError || paymentsError || paymentError || upcomingBillingsError;

  return {
    // Data
    units,
    accessibleUnits,
    payments,
    selectedUnit,
    upcomingBillings,
    stats,
    
    // Loading states
    isLoadingUnits,
    isLoadingPayments,
    isCreatingPayment,
    isUpdatingPayment,
    isDeletingPayment,
    isLoadingUpcomingBillings,
    isLoading,
    
    // Error states
    unitsError,
    paymentsError,
    paymentError,
    upcomingBillingsError,
    error,
    
    // Access control
    hasAccess,
    accessChecked,
    
    // Filters
    filters,
    
    // Computed values
    currentUnitPayments,
    upcomingPayments,
    paidPayments,
    totalOutstanding,
    
    // Actions
    checkAccess,
    loadUnits,
    loadPayments,
    createNewPayment,
    updateExistingPayment,
    removePayment,
    loadPaymentChoices,
    loadFilterOptions,
    loadUpcomingBillings,
    selectUnit,
    updateFilters,
    resetFilters,
    clearAllErrors,
    resetServiceFeeState,
  };
};
