import { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../../../../../utils/axiosInstance';

/**
 * Hook to fetch service invoice data
 * Uses the payment-history endpoint with the query format specified in views.py (lines 3125-3262)
 * 
 * @param {number} unitId - Unit ID
 * @param {number} serviceFeeId - Service Fee ID
 * @param {number} month - Service period month
 * @param {number} year - Service period year
 * @returns {object} - { invoiceData, loading, error, refetch }
 */
export const useServiceInvoice = (unitId, serviceFeeId, month, year) => {
  const [invoiceData, setInvoiceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchInvoiceData = useCallback(async () => {
    if (!unitId || !serviceFeeId || !month || !year) {
      setError('Missing required parameters');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await axiosInstance.get(
        '/api/service-fee-management/payment-history/',
        {
          params: {
            unit_id: unitId,
            service_fee_id: serviceFeeId,
            service_period_month: month,
            service_period_year: year
          }
        }
      );

      if (response.data.success && Array.isArray(response.data.data)) {
        if (response.data.data.length > 0) {
          setInvoiceData(response.data.data[0]);
        } else {
          setError('No invoice data found for the specified period');
          setInvoiceData(null);
        }
      } else {
        setError('Invalid response format');
        setInvoiceData(null);
      }
    } catch (err) {
      const errorMessage = 
        err.response?.data?.message || 
        err.response?.data?.error || 
        err.message || 
        'Failed to fetch invoice data';
      setError(errorMessage);
      setInvoiceData(null);
      console.error('[useServiceInvoice] Error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [unitId, serviceFeeId, month, year]);

  useEffect(() => {
    fetchInvoiceData();
  }, [fetchInvoiceData]);

  return {
    invoiceData,
    loading,
    error,
    refetch: fetchInvoiceData
  };
};

export default useServiceInvoice;
