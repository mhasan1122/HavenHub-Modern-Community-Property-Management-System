import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import type { RootState } from '../../store';
import { API_CONFIG, enhancedFetch } from '../../utils/networkUtils';

interface ReceiptViewScreenProps {
  route?: {
    params: {
      payment: any;
      unit: any;
    };
  };
}

const ReceiptViewScreen: React.FC<ReceiptViewScreenProps> = ({ route }) => {
  const navigation = useNavigation();
  const routeParams = useRoute().params as { payment: any; unit: any; groupedAllocations?: any[] };
  const { payment: routePayment, unit, groupedAllocations } = routeParams;
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const [displayPayment, setDisplayPayment] = useState(routePayment);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [fetchedAllocations, setFetchedAllocations] = useState<any[] | null>(null);
  const [isLoadingAllocations, setIsLoadingAllocations] = useState(false);
  const payment = displayPayment;
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch full payment detail so Penalty & Waived are always available for the receipt
  useEffect(() => {
    const paymentId = routePayment?.payment_id ?? routePayment?.id;
    if (!paymentId || !accessToken) return;
    const hasPenaltyWaived = routePayment.penalty_amount != null || routePayment.waived_amount != null;
    if (hasPenaltyWaived) return; // list already sent penalty/waived
    let cancelled = false;
    setIsLoadingDetail(true);
    (async () => {
      try {
        const res = await enhancedFetch(
          `${API_CONFIG.BASE_URL}/api/service-fee-management/payments/${paymentId}/`,
          { method: 'GET' },
          API_CONFIG.TIMEOUT,
          accessToken
        );
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (cancelled || !json?.success || !json?.data) return;
        setDisplayPayment((prev: any) => ({
          ...prev,
          ...json.data,
          penalty_amount: json.data.penalty_amount ?? prev.penalty_amount,
          waived_amount: json.data.waived_amount ?? prev.waived_amount,
          gross_penalty_amount: json.data.gross_penalty_amount ?? prev.gross_penalty_amount,
        }));
      } catch (_e) {
        if (!cancelled) setDisplayPayment(routePayment);
      } finally {
        if (!cancelled) setIsLoadingDetail(false);
      }
    })();
    return () => { cancelled = true; };
  }, [routePayment?.id ?? routePayment?.payment_id, accessToken]);

  // Fetch payment allocation from payment-history API (same as web) when groupedAllocations not passed
  useEffect(() => {
    const txnId = routePayment?.transaction_id || routePayment?.receipt_id;
    const unitId = unit?.unit_id ?? unit?.id;
    const towerId = unit?.tower_id;

    console.log('🔍 Allocation Fetch Check:', {
      hasGroupedAllocations: groupedAllocations && groupedAllocations.length > 0,
      txnId,
      unitId,
      towerId,
      hasAccessToken: !!accessToken,
      willFetch: !((groupedAllocations && groupedAllocations.length > 0) || !txnId || !unitId || !accessToken)
    });

    if ((groupedAllocations && groupedAllocations.length > 0) || !txnId || !unitId || !accessToken) {
      if (groupedAllocations?.length) setFetchedAllocations(null);
      return;
    }
    let cancelled = false;
    setIsLoadingAllocations(true);
    setFetchedAllocations(null);
    (async () => {
      try {
        const params = new URLSearchParams();
        params.append('unit_id', String(unitId));
        if (towerId != null) params.append('tower_id', String(towerId));
        params.append('min_amount', '0');
        const res = await enhancedFetch(
          `${API_CONFIG.BASE_URL}/api/service-fee-management/payment-history/?${params.toString()}`,
          { method: 'GET' },
          API_CONFIG.TIMEOUT,
          accessToken
        );
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (cancelled || !json?.success || !Array.isArray(json?.data?.payments)) return;
        const payments = json.data.payments as any[];
        const getDetails = (row: any) => {
          let pd = row?.payment_details;
          if (typeof pd === 'string') try { pd = JSON.parse(pd); } catch { pd = []; }
          return Array.isArray(pd) && pd[0] ? pd[0] : {};
        };
        const match = (row: any) => {
          const d = getDetails(row);
          return (d.transaction_id && d.transaction_id === txnId) || (d.receipt_id && d.receipt_id === routePayment?.receipt_id);
        };
        const rows = payments.filter(match);

        console.log('📋 Payment History API Response:', {
          totalPayments: payments.length,
          filteredRows: rows.length,
          firstRow: rows[0] ? {
            month_name: rows[0].month_name,
            payment_details: rows[0].payment_details,
            paid_amount: rows[0].paid_amount
          } : null
        });

        // Parse payment_details to extract individual month allocations
        const mapped: any[] = [];
        rows.forEach((row: any) => {
          let paymentDetails = row?.payment_details;
          if (typeof paymentDetails === 'string') {
            try { paymentDetails = JSON.parse(paymentDetails); } catch { paymentDetails = []; }
          }
          if (!Array.isArray(paymentDetails)) paymentDetails = [];

          console.log('🔍 Processing Row:', {
            row_month: row.month_name,
            paymentDetails_count: paymentDetails.length,
            paymentDetails_sample: paymentDetails.map((pd: any) => ({
              id: pd.id,
              month_name: pd.month_name,
              service_period_month: pd.service_period_month,
              service_period_year: pd.service_period_year,
              amount_paid: pd.amount_paid
            }))
          });

          // If payment_details has multiple entries, create allocation for each
          if (paymentDetails.length > 1) {
            const startLength = mapped.length;

            paymentDetails.forEach((pd: any) => {
              // Use service period from payment_details if available
              const monthName = pd.month_name || row.month_name;
              const month = pd.service_period_month || row.service_period_month;
              const year = pd.service_period_year || row.service_period_year;

              // Include either bill payments (with service period) OR advance payments
              if ((monthName && month && year) || pd.payment_type === 'advance_payment') {
                mapped.push({
                  id: pd.id ?? row.payment_id,
                  transaction_id: pd.transaction_id ?? txnId,
                  receipt_id: pd.receipt_id ?? routePayment?.receipt_id,
                  service_period_display: pd.payment_type === 'advance_payment' ? 'Advance Payment' : monthName,
                  month_name: pd.payment_type === 'advance_payment' ? 'Advance Payment' : monthName,
                  service_period_month: month,
                  service_period_year: year,
                  amount: pd.amount_paid ?? '0',
                  payment_type: pd.payment_type ?? (row.service_status === 'advance' ? 'advance_payment' : undefined),
                  service_status: pd.payment_type === 'advance_payment' ? 'advance' : 'paid',
                  original_amount: row.original_amount,
                  service_fee_amount: row.service_fee_amount,
                  total_amount: row.total_amount,
                  gross_penalty_amount: pd.gross_penalty_amount ?? '0',
                  penalty_amount: pd.penalty_amount ?? '0',
                  waived_amount: pd.waived_amount ?? '0',
                  payment_date: pd.payment_date ?? routePayment?.payment_date,
                  payment_status: 'completed',
                  is_fully_paid: true,
                  base_service_amount: row.base_service_amount ?? row.original_amount,
                  additional_bill_charges: row.additional_bill_charges,
                });
              }
            });

            // If no valid allocations were created (no service periods), fall back to single allocation
            if (mapped.length === startLength) {
              const d = getDetails(row);
              mapped.push({
                id: row.payment_id ?? d.id,
                transaction_id: d.transaction_id ?? txnId,
                receipt_id: d.receipt_id ?? routePayment?.receipt_id,
                service_period_display: row.month_name ?? 'N/A',
                month_name: row.month_name,
                amount: row.paid_amount ?? d.amount_paid ?? row.advance_amount ?? '0',
                payment_type: d.payment_type ?? (row.service_status === 'advance' ? 'advance_payment' : undefined),
                service_status: row.service_status,
                original_amount: row.original_amount,
                service_fee_amount: row.service_fee_amount,
                total_amount: row.total_amount,
                gross_penalty_amount: row.gross_penalty_amount,
                penalty_amount: row.penalty_amount,
                waived_amount: row.waived_amount,
                payment_date: d.payment_date ?? routePayment?.payment_date,
                payment_status: row.payment_status,
                is_fully_paid: row.payment_status === 'completed',
                base_service_amount: row.base_service_amount ?? row.original_amount,
                additional_bill_charges: row.additional_bill_charges,
              });
            }
          } else {
            // Single or no payment details - use row as single allocation
            const d = getDetails(row);
            mapped.push({
              id: row.payment_id ?? d.id,
              transaction_id: d.transaction_id ?? txnId,
              receipt_id: d.receipt_id ?? routePayment?.receipt_id,
              service_period_display: row.month_name ?? 'N/A',
              month_name: row.month_name,
              amount: row.paid_amount ?? d.amount_paid ?? row.advance_amount ?? '0',
              payment_type: d.payment_type ?? (row.service_status === 'advance' ? 'advance_payment' : undefined),
              service_status: row.service_status,
              original_amount: row.original_amount,
              service_fee_amount: row.service_fee_amount,
              total_amount: row.total_amount,
              gross_penalty_amount: row.gross_penalty_amount,
              penalty_amount: row.penalty_amount,
              waived_amount: row.waived_amount,
              payment_date: d.payment_date ?? routePayment?.payment_date,
              payment_status: row.payment_status,
              is_fully_paid: row.payment_status === 'completed',
              base_service_amount: row.base_service_amount ?? row.original_amount,
              additional_bill_charges: row.additional_bill_charges,
            });
          }
        });

        if (!cancelled && mapped.length > 0) {
          console.log('📊 Fetched Allocations:', {
            count: mapped.length,
            allocations: mapped.map(a => ({
              month: a.month_name,
              amount: a.amount,
              service_period: `${a.service_period_month}/${a.service_period_year}`
            }))
          });
          setFetchedAllocations(mapped);
        }
      } catch (_e) {
        if (!cancelled) setFetchedAllocations(null);
      } finally {
        if (!cancelled) setIsLoadingAllocations(false);
      }
    })();
    return () => { cancelled = true; };
  }, [routePayment?.transaction_id, routePayment?.receipt_id, unit?.unit_id, unit?.id, unit?.tower_id, groupedAllocations, accessToken]);

  // Console log the payment data to check receipt_id
  console.log('📄 ReceiptViewScreen - Payment Data:', {
    payment_id: payment.id,
    transaction_id: payment.transaction_id,
    receipt_id: payment.receipt_id,
    reference_number: payment.reference_number,
    full_payment_object: payment
  });

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return 'N/A';
    }
  };

  const formatCurrency = (amount: string | number) => {
    if (!amount) return '0.00';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return '0.00';
    return numAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getPaymentMethodDisplay = (method: string) => {
    if (!method) return 'N/A';

    // Handle SSLCommerz card type format: "Card Type: NAGAD-Nagad"
    if (method.includes('Card Type:')) {
      const cardType = method.split('Card Type:')[1]?.trim();
      return cardType || method;
    }

    const methodLower = method.toLowerCase();

    switch (methodLower) {
      case 'bkash':
        return 'bKash';
      case 'nagad':
        return 'Nagad';
      case 'rocket':
        return 'Rocket';
      case 'upay':
        return 'Upay';
      case 'bank_transfer':
      case 'bank transfer':
      case 'bank':
        return 'Bank Transfer';
      case 'card':
      case 'credit card':
      case 'debit card':
        return 'Card';
      case 'visa':
        return 'Visa';
      case 'mastercard':
        return 'Mastercard';
      case 'amex':
        return 'Amex';
      case 'cash':
        return 'Cash';
      // Don't display gateway names to users
      case 'paystation':
      case 'sslcommerz':
        return 'N/A';
      default:
        return method;
    }
  };

  const getPaymentMethodWithCardType = (payment: any) => {
    console.log('Extracting payment method from:', payment);

    // Prefer API value (PayStation now stores actual method e.g. bKash)
    const apiMethod = payment.payment_method_display || payment.method_display || payment.payment_method;
    if (apiMethod && apiMethod !== 'Not Set' && apiMethod !== 'N/A') {
      return getPaymentMethodDisplay(apiMethod);
    }

    // Then try to extract payment method from notes if available
    if (payment.notes) {
      console.log('Checking notes:', payment.notes);

      // Look for SSLCommerz card type pattern and clean it up
      const cardTypeMatch = payment.notes.match(/Card Type:\s*([^,]+)/);
      if (cardTypeMatch) {
        let cardType = cardTypeMatch[1].trim();
        console.log('Found card type in notes:', cardType);

        // Clean up the card type format (e.g., "BKASH-Bkash" -> "bKash")
        if (cardType.includes('-')) {
          const parts = cardType.split('-');
          if (parts.length >= 2) {
            // Take the second part and format it properly
            const secondPart = parts[1].trim();
            // Convert to proper case (first letter uppercase, rest lowercase)
            cardType = secondPart.charAt(0).toUpperCase() + secondPart.slice(1).toLowerCase();
          }
        }

        // Handle specific payment method formatting
        switch (cardType.toLowerCase()) {
          case 'bkash':
            return 'bKash';
          case 'nagad':
            return 'Nagad';
          case 'rocket':
            return 'Rocket';
          case 'bank transfer':
            return 'Bank Transfer';
          case 'cash':
            return 'Cash';
          default:
            return cardType;
        }
      }

      // Look for other payment method patterns in notes
      const bkashMatch = payment.notes.match(/bKash|BKash/i);
      if (bkashMatch) {
        console.log('Found bKash in notes');
        return 'bKash';
      }

      const nagadMatch = payment.notes.match(/Nagad|NAGAD/i);
      if (nagadMatch) {
        console.log('Found Nagad in notes');
        return 'Nagad';
      }

      const rocketMatch = payment.notes.match(/Rocket|ROCKET/i);
      if (rocketMatch) {
        console.log('Found Rocket in notes');
        return 'Rocket';
      }

      const bankMatch = payment.notes.match(/Bank Transfer|bank transfer/i);
      if (bankMatch) {
        console.log('Found Bank Transfer in notes');
        return 'Bank Transfer';
      }

      const cashMatch = payment.notes.match(/Cash|cash/i);
      if (cashMatch) {
        console.log('Found Cash in notes');
        return 'Cash';
      }
    }

    // Fallback: show "N/A" for unknown/missing methods
    return 'N/A';
  };

  const getPaymentStatus = (payment: any) => {
    // Advance payments: "Advance paid" with blue background (same as Payment History)
    if (payment.payment_type === 'advance_payment') {
      return {
        label: 'Advance paid',
        color: '#ffffff',
        bgColor: '#3b82f6',
      };
    }

    // Receipts should always show "PAYMENT RECEIVED" since a receipt confirms payment was received
    // regardless of whether it's partial or full payment
    return {
      label: 'PAYMENT RECEIVED',
      color: '#1f2937',
      bgColor: '#dcfce7',
    };
  };

  // Full bill total for the period (base + utility + gross penalty - waived). Used so utility is not shown as advance.
  const getFullBillAmount = () => {
    const base = parseFloat(payment.base_service_amount || payment.original_amount || payment.service_fee_amount || payment.fee_amount || '0');
    const utility = parseFloat(payment.additional_bill_charges || payment.gas_fee || '0') || 0;
    const grossPenalty = parseFloat(payment.gross_penalty_amount ?? payment.penalty_amount ?? '0') || 0;
    const waived = parseFloat(payment.waived_amount ?? '0') || 0;
    return base + utility + grossPenalty - waived;
  };

  const getBillAmount = () => {
    return getFullBillAmount();
  };

  // Base bill amount WITHOUT penalty (for "Bill" column). Prefer API original_amount/service_fee_amount so we never show amount paid as bill amount.
  const getBaseBillAmount = () => {
    const fromApi = parseFloat(payment.original_amount ?? payment.service_fee_amount ?? '0');
    if (!isNaN(fromApi) && fromApi > 0) return fromApi;
    const base = parseFloat(payment.base_service_amount || payment.service_fee_amount || payment.fee_amount || '0');
    const utility = parseFloat(payment.additional_bill_charges || payment.gas_fee || '0') || 0;
    return base + utility;
  };

  // Per-allocation bill amount: complete generated bill (base + utility + penalty - waived) from service_fee_management_servicefeegenerate.amount
  const getBillAmountForAllocation = (alloc: any) => {
    const base = parseFloat(alloc.original_amount || alloc.service_fee_amount || alloc.base_service_amount || '0');
    const utility = parseFloat(alloc.additional_bill_charges || alloc.gas_fee || '0');
    const penalty = parseFloat(alloc.gross_penalty_amount || alloc.penalty_amount || '0');
    const waived = parseFloat(alloc.waived_amount || '0');
    return base + utility + penalty - waived;
  };

  // Total due for the bill (base + utility + gross penalty - waived). Used for status and correctness.
  const getTotalDueForBill = () => {
    const base = parseFloat(payment.base_service_amount || payment.original_amount || payment.service_fee_amount || payment.fee_amount || '0');
    const utility = parseFloat(payment.additional_bill_charges || payment.gas_fee || '0') || 0;
    const grossPenalty = parseFloat(payment.gross_penalty_amount ?? payment.penalty_amount ?? '0') || 0;
    const waived = parseFloat(payment.waived_amount ?? '0') || 0;
    return base + utility + grossPenalty - waived;
  };

  // Per-row allocation status: PAID FULL if amount paid >= total due, else PARTIAL (for bill rows). Advance rows show PARTIAL.
  const getAllocationRowStatus = () => getAllocationRowStatusFor(payment);

  const getAllocationRowStatusFor = (alloc: any) => {
    if (alloc.payment_type === 'advance_payment' || alloc.service_status === 'advance' || alloc.month_name === 'Advance Payment') {
      return 'PARTIAL';
    }
    // Trust backend: if backend says bill is completed/paid, show PAID FULL (e.g. after advance applied)
    if (alloc.payment_status === 'completed' || alloc.service_status === 'paid' || alloc.is_fully_paid === true) {
      return 'PAID FULL';
    }
    const base = parseFloat(alloc.base_service_amount || alloc.original_amount || alloc.service_fee_amount || alloc.fee_amount || '0');
    const utility = parseFloat(alloc.additional_bill_charges || alloc.gas_fee || '0') || 0;
    const grossPenalty = parseFloat(alloc.gross_penalty_amount ?? alloc.penalty_amount ?? '0') || 0;
    const waived = parseFloat(alloc.waived_amount ?? '0') || 0;
    const totalDue = base + utility + grossPenalty - waived;
    const paid = parseFloat(alloc.paid_amount ?? alloc.amount ?? '0') || 0;
    if (totalDue <= 0) return paid > 0 ? 'PAID FULL' : 'PARTIAL';
    return paid >= totalDue ? 'PAID FULL' : 'PARTIAL';
  };

  // Waived display: "-" when zero or missing, otherwise formatted amount.
  const formatWaived = (val: string | number | null | undefined) => {
    if (val == null || val === '') return '-';
    const n = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(n) || n === 0) return '-';
    return formatCurrency(n);
  };

  // Only the amount paid in excess of the full bill (base + utility + penalty) is advance.
  const getAdvanceAmount = () => {
    const totalPaid = parseFloat(payment.amount || '0');
    const fullBill = getFullBillAmount();
    if (totalPaid > fullBill) {
      return totalPaid - fullBill;
    }
    return 0;
  };

  const generateReceiptHTML = () => {
    const paymentStatus = getPaymentStatus(payment);
    const paymentMethod = getPaymentMethodWithCardType(payment);
    // Use the same allocation logic as the screen display
    const pdfRows = (groupedAllocations && groupedAllocations.length > 0)
      ? groupedAllocations
      : (fetchedAllocations && fetchedAllocations.length > 0)
        ? fetchedAllocations
        : [payment];
    const pdfSubtotalBills = pdfRows
      .filter((a: any) => a.payment_type !== 'advance_payment' && a.service_status !== 'advance' && a.month_name !== 'Advance Payment')
      .reduce((sum: number, a: any) => sum + (parseFloat(a.amount || '0') || 0), 0);
    const pdfAdvanceTotal = pdfRows
      .filter((a: any) => a.payment_type === 'advance_payment' || a.service_status === 'advance' || a.month_name === 'Advance Payment')
      .reduce((sum: number, a: any) => sum + (parseFloat(a.amount || '0') || 0), 0);
    const pdfTotal = pdfRows.reduce((sum: number, a: any) => sum + (parseFloat(a.amount || '0') || 0), 0);
    const advanceAmount = pdfAdvanceTotal > 0 ? pdfAdvanceTotal : getAdvanceAmount();
    const billAmount = getBillAmount();
    const baseBillAmount = getBaseBillAmount();
    const subtotal = pdfRows.length > 1 ? pdfSubtotalBills : (payment.payment_type === 'advance_payment' ? 0 : Math.min(parseFloat(payment.amount || '0'), billAmount));
    const allocationRowStatus = payment.payment_type === 'advance_payment' ? 'PARTIAL' : getAllocationRowStatus();
    const waivedDisplay = formatWaived(payment.waived_amount);
    const waivedDisplayPdf = waivedDisplay === '-' ? '-' : `Tk ${waivedDisplay}`;
    const pdfTableRows = pdfRows.map((alloc: any, idx: number) => {
      const rowStatus = getAllocationRowStatusFor(alloc);
      const billAmt = alloc.payment_type === 'advance_payment' || alloc.month_name === 'Advance Payment' ? 0 : getBillAmountForAllocation(alloc);
      const rowLabel = alloc.service_period_display || alloc.month_name || (alloc.payment_type === 'advance_payment' ? 'Advance Payment' : 'N/A');
      const wd = formatWaived(alloc.waived_amount);
      const wdPdf = wd === '-' ? '-' : `Tk ${wd}`;
      return `<tr>
        <td>${rowLabel}</td>
        <td class="text-right">${alloc.payment_type === 'advance_payment' || alloc.month_name === 'Advance Payment' ? '-' : 'Tk ' + formatCurrency(billAmt)}</td>
        <td class="text-right">${alloc.payment_type === 'advance_payment' || alloc.month_name === 'Advance Payment' ? '-' : 'Tk ' + formatCurrency(alloc.gross_penalty_amount ?? alloc.penalty_amount)}</td>
        <td class="text-right">${wdPdf}</td>
        <td class="text-right">Tk ${formatCurrency(alloc.amount || '0')}</td>
        <td class="text-right">${rowStatus}</td>
      </tr>`;
    }).join('');

    // Check if this is a partial payment (based on remaining amount, not label)
    // Receipt header will always show "PAYMENT RECEIVED" but we still track partial status for internal logic
    const remainingAmount = parseFloat(payment.remaining_amount || '0');
    const isPartialPayment = remainingAmount > 0 && remainingAmount < billAmount;

    // Debug: Log payment data for PDF generation
    console.log('📄 PDF Generation - Payment Data:', {
      payment_id: payment.id,
      receipt_id: payment.receipt_id,
      transaction_id: payment.transaction_id,
      reference_number: payment.reference_number,
      payment_method: paymentMethod,
      has_receipt_id: !!payment.receipt_id,
      receipt_id_value: payment.receipt_id || 'N/A',
      isPartialPayment: isPartialPayment,
      // Debug original amount fields
      service_fee_amount: payment.service_fee_amount,
      billing_amount: payment.billing_amount,
      original_amount: payment.original_amount,
      fee_amount: payment.fee_amount,
      amount: payment.amount,
      remaining_amount: payment.remaining_amount,
      // Log all available fields
      all_payment_fields: Object.keys(payment)
    });

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Receipt</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            background: white;
            padding: 40px;
            color: #333;
            font-size: 12px;
            line-height: 1.5;
          }
          
          .header {
            margin-bottom: 30px;
            border-bottom: 2px solid #3C9D9B;
            padding-bottom: 20px;
          }
          
          .company-name {
            font-size: 24px;
            font-weight: bold;
            color: #3C9D9B;
            margin-bottom: 5px;
          }
          
          .company-info {
            font-size: 12px;
            color: #666;
          }

          .receipt-title {
            font-size: 18px;
            font-weight: bold;
            text-transform: uppercase;
            margin-top: 20px;
            color: #333;
          }
          
          .grid-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-bottom: 30px;
          }
          
          .info-group {
            margin-bottom: 15px;
          }
          
          .label {
            font-size: 10px;
            text-transform: uppercase;
            color: #888;
            font-weight: bold;
            margin-bottom: 2px;
          }
          
          .value {
            font-size: 14px;
            font-weight: 500;
            color: #000;
          }
          
          .section-title {
            font-size: 14px;
            font-weight: bold;
            color: #3C9D9B;
            text-transform: uppercase;
            margin-bottom: 15px;
            border-bottom: 1px solid #eee;
            padding-bottom: 5px;
            margin-top: 20px;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          
          th {
            text-align: left;
            padding: 10px;
            background: #f8f9fa;
            color: #666;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            border-bottom: 1px solid #ddd;
          }
          
          td {
            padding: 12px 10px;
            border-bottom: 1px solid #eee;
            font-size: 12px;
          }
          
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          
          .summary-table {
            width: 300px;
            margin-left: auto;
          }
          
          .summary-table td {
            padding: 8px 10px;
            border-bottom: none;
          }
          
          .total-row td {
            border-top: 2px solid #3C9D9B;
            font-weight: bold;
            font-size: 14px;
            padding-top: 15px;
          }
          
          .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 10px;
            color: #888;
            text-align: center;
          }
          
          .notes-box {
            background: #f9f9f9;
            padding: 15px;
            border-radius: 4px;
            margin-top: 20px;
            font-size: 11px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">EstateLink Community Management</div>
          <div class="company-info">123 Community Street, Dhaka | (880) 123-4567</div>
          <div class="receipt-title">Official Payment Receipt</div>
        </div>
        
        <div class="grid-container">
          <div class="left-col">
            <div class="info-group">
              <div class="label">Receipt Number</div>
              <div class="value">${payment.receipt_id || 'N/A'}</div>
            </div>
            <div class="info-group">
              <div class="label">Transaction ID</div>
              <div class="value">${payment.transaction_id || 'N/A'}</div>
            </div>
            <div class="info-group">
              <div class="label">Payment Date</div>
              <div class="value">${formatDate(payment.payment_date)}</div>
            </div>
          </div>
          
          <div class="right-col">
            <div class="section-title" style="margin-top: 0">Resident Information</div>
            <div class="info-group">
              <div class="label">Tower</div>
              <div class="value">${unit.tower_name}</div>
            </div>
            <div class="info-group">
              <div class="label">Unit Number</div>
              <div class="value">${unit.unit_name}</div>
            </div>
            <div class="info-group">
              <div class="label">Resident Name</div>
              <div class="value">N/A</div>
            </div>
          </div>
        </div>
        
        <div class="section-title">Payment Method</div>
        <div class="grid-container">
          <div class="left-col">
            <div class="info-group">
              <div class="label">Method</div>
              <div class="value">${paymentMethod}</div>
            </div>
            <div class="info-group">
              <div class="label">From Account Number</div>
              <div class="value">N/A</div>
            </div>
          </div>
          <div class="right-col">
            <div class="info-group">
              <div class="label">To Account Name</div>
              <div class="value">Estate Link Management</div>
            </div>
            <div class="info-group">
              <div class="label">To Account Number</div>
              <div class="value">9876543210987</div>
            </div>
          </div>
        </div>
        
        <div class="section-title">Payment Allocation</div>
        <table>
          <thead>
            <tr>
              <th>Bill Month</th>
              <th class="text-right">Bill Amount</th>
              <th class="text-right">Gross Penalty</th>
              <th class="text-right">Waived</th>
              <th class="text-right">Amount Paid</th>
              <th class="text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            ${pdfTableRows}
          </tbody>
        </table>
        
        <table class="summary-table">
          <tr>
            <td>Subtotal (Bills Payment)</td>
            <td class="text-right">Tk ${formatCurrency(pdfRows.length > 1 ? String(pdfSubtotalBills) : String(subtotal))}</td>
          </tr>
          ${(advanceAmount > 0 || pdfAdvanceTotal > 0) ? `
          <tr>
            <td>Advance Payment (Future Bills)</td>
            <td class="text-right">Tk ${formatCurrency(pdfRows.length > 1 ? String(pdfAdvanceTotal) : String(advanceAmount))}</td>
          </tr>
          ` : ''}
          <tr class="total-row">
            <td>Total Amount Paid</td>
            <td class="text-right">Tk ${formatCurrency(pdfRows.length > 1 ? String(pdfTotal) : (payment.amount || '0'))}</td>
          </tr>
        </table>
        
        <div class="notes-box">
          <div style="font-style: italic; color: #666;">
             ${advanceAmount > 0 ? 'Advance payment credited for next month.' : ''}
          </div>
        </div>
        
        <div class="grid-container" style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
          <div></div>
          <div class="info-group text-right">
            <div class="label">Recorded At</div>
            <div class="value">${formatDate(payment.payment_date)} at ${formatTime(payment.payment_date)}</div>
          </div>
        </div>
        
        <div class="footer">
          This is an official receipt from Estate Link Property Management.<br>
          For any inquiries, please contact the management office.
        </div>
      </body>
      </html>
    `;
  };

  const handleDownloadPDF = async () => {
    console.log('📄 PDF Download Started:', {
      payment_id: payment.id,
      receipt_id: payment.receipt_id,
      amount: payment.amount,
      service_fee_amount: payment.service_fee_amount,
      original_amount: payment.original_amount,
      fee_amount: payment.fee_amount,
      billing_amount: payment.billing_amount,
      remaining_amount: payment.remaining_amount
    });

    setIsDownloading(true);
    try {
      // Generate PDF from HTML with optimized settings for single page
      const { uri } = await Print.printToFileAsync({
        html: generateReceiptHTML(),
        base64: false,
        width: 595, // A4 width in points
        height: 842, // A4 height in points
      });

      console.log('📄 PDF Generated Successfully:', { uri });

      // Create a filename with timestamp
      const fileName = `Receipt_${payment.receipt_id || payment.transaction_id || 'payment'}_${Date.now()}.pdf`;

      // Use sharing approach for both platforms (works without permissions)
      const isAvailable = await Sharing.isAvailableAsync();

      if (!isAvailable) {
        Alert.alert(
          'Error',
          'Sharing is not available on this device.',
          [{ text: 'OK' }]
        );
        setIsDownloading(false);
        return;
      }

      // Share the PDF - user can save to Downloads, Files, etc.
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Save Receipt PDF',
        UTI: 'com.adobe.pdf',
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      Alert.alert(
        'Error',
        'Failed to generate PDF. Please try again or contact support if the problem persists.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    console.log('📄 PDF Share Started:', {
      payment_id: payment.id,
      receipt_id: payment.receipt_id,
      amount: payment.amount,
      service_fee_amount: payment.service_fee_amount,
      original_amount: payment.original_amount,
      fee_amount: payment.fee_amount,
      billing_amount: payment.billing_amount,
      remaining_amount: payment.remaining_amount
    });

    setIsDownloading(true);
    try {
      // Generate PDF from HTML with optimized settings for single page
      const { uri } = await Print.printToFileAsync({
        html: generateReceiptHTML(),
        base64: false,
        width: 595, // A4 width in points
        height: 842, // A4 height in points
      });

      console.log('📄 PDF Generated for Share:', { uri });

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();

      if (isAvailable) {
        // Share the PDF file
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Payment Receipt',
          UTI: 'com.adobe.pdf',
        });
      } else {
        // Fallback to basic share if PDF sharing is not available
        Alert.alert(
          'PDF Generated',
          'Your receipt PDF has been generated but sharing is not available on this device.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error sharing receipt:', error);
      Alert.alert(
        'Error',
        'Failed to share receipt PDF. Please try again or contact support if the problem persists.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const paymentStatus = getPaymentStatus(payment);
  // When we have grouped allocations (same invoice = bill + advance), show all rows; else use fetched allocation from payment-history API; else single payment
  const allocationRows = (groupedAllocations && groupedAllocations.length > 0)
    ? groupedAllocations
    : (fetchedAllocations && fetchedAllocations.length > 0)
      ? fetchedAllocations
      : [payment];
  const totalAmountPaid = allocationRows.reduce((sum, a) => sum + (parseFloat(a.amount || '0') || 0), 0);
  const subtotalBills = allocationRows
    .filter((a: any) => a.payment_type !== 'advance_payment' && a.service_status !== 'advance' && a.month_name !== 'Advance Payment')
    .reduce((sum, a) => sum + (parseFloat(a.amount || '0') || 0), 0);
  const advanceTotal = allocationRows
    .filter((a: any) => a.payment_type === 'advance_payment' || a.service_status === 'advance' || a.month_name === 'Advance Payment')
    .reduce((sum, a) => sum + (parseFloat(a.amount || '0') || 0), 0);
  const advanceAmount = advanceTotal > 0 ? advanceTotal : getAdvanceAmount();
  const billAmount = getBillAmount();
  const billAmt = allocationRows.length > 1
    ? allocationRows
      .filter((a: any) => a.payment_type !== 'advance_payment' && a.service_status !== 'advance' && a.month_name !== 'Advance Payment')
      .reduce((sum, a) => sum + (getBillAmountForAllocation(a) || 0), 0)
    : billAmount;
  const subtotal = allocationRows.length > 1 ? subtotalBills : (payment.payment_type === 'advance_payment' ? 0 : Math.min(parseFloat(payment.amount || '0'), billAmt));

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 py-3 flex-row items-center">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          disabled={isDownloading}
          className="flex-row items-center pr-2"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={isDownloading ? "#ccc" : "#3C9D9B"} />
        </TouchableOpacity>
        <Text className="text-black text-xl font-oxanium-bold flex-1">
          Payment Receipt
        </Text>
        <TouchableOpacity onPress={handleShare} disabled={isDownloading}>
          {isDownloading ? (
            <ActivityIndicator size="small" color="#3C9D9B" />
          ) : (
            <Ionicons name="share-outline" size={24} color="#3C9D9B" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1">
        {/* Receipt Header */}
        <View className="p-6 items-center">
          <View className="w-16 h-16 rounded-full items-center justify-center mb-4">
            <Ionicons name="receipt" size={32} color="#3C9D9B" />
          </View>
          <Text className="text-black text-xl font-lato-bold mb-1">
            Payment Receipt
          </Text>
          <Text className="text-black text-lg font-lato">
            EstateLink Community Management
          </Text>
        </View>

        {/* Receipt Content */}
        <View className="px-4 pb-6">
          {/* Status Badge */}
          <View className="items-center mb-6">
            <View
              style={{ backgroundColor: paymentStatus.bgColor }}
              className="px-4 py-2 flex-row items-center justify-center rounded-full"
            >
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={paymentStatus.color}
              />
              <Text
                style={{ color: paymentStatus.color }}
                className="text-base font-lato-semibold uppercase ml-2"
              >
                {paymentStatus.label}
              </Text>
            </View>
          </View>

          {/* Key Info Grid */}
          <View className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-100">
            <View className="mb-4">
              <Text className="text-gray-500 text-sm uppercase font-bold mb-1">Receipt Number</Text>
              <Text className="text-black text-lg font-bold">{payment.receipt_id || 'N/A'}</Text>
            </View>
            <View className="mb-4">
              <Text className="text-gray-500 text-sm uppercase font-bold mb-1">Transaction ID</Text>
              <Text className="text-black text-lg font-bold">{payment.transaction_id || 'N/A'}</Text>
            </View>
            <View>
              <Text className="text-gray-500 text-sm uppercase font-bold mb-1">Payment Date</Text>
              <Text className="text-black text-lg font-bold">{formatDate(payment.payment_date)}</Text>
            </View>
          </View>

          {/* Resident Information */}
          <View className="mb-6">
            <Text className="text-[#3C9D9B] text-sm font-bold uppercase mb-2 border-b border-gray-100 pb-1">Resident Information</Text>
            <View className="flex-row justify-between mb-2">
              <View className="flex-1">
                <Text className="text-gray-500 text-sm uppercase font-bold mb-1">Tower</Text>
                <Text className="text-black text-base font-medium">{unit.tower_name || 'N/A'}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-gray-500 text-sm uppercase font-bold mb-1">Unit Number</Text>
                <Text className="text-black text-base font-medium">{unit.unit_name || 'N/A'}</Text>
              </View>
            </View>
            <View>
              <Text className="text-gray-500 text-sm uppercase font-bold mb-1">Resident Name</Text>
              <Text className="text-black text-base font-medium">{unit.resident_name || 'N/A'}</Text>
            </View>
          </View>

          {/* Payment Method */}
          <View className="mb-6">
            <Text className="text-[#3C9D9B] text-sm font-bold uppercase mb-2 border-b border-gray-100 pb-1">Payment Method</Text>
            <View className="flex-row justify-between mb-4">
              <View className="flex-1">
                <Text className="text-gray-500 text-sm uppercase font-bold mb-1">Method</Text>
                <Text className="text-black text-base font-medium">{getPaymentMethodWithCardType(payment)}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-gray-500 text-sm uppercase font-bold mb-1">From Account</Text>
                <Text className="text-black text-base font-medium">N/A</Text>
              </View>
            </View>
            <View className="flex-row justify-between">
              <View className="flex-1">
                <Text className="text-gray-500 text-sm uppercase font-bold mb-1">To Account Name</Text>
                <Text className="text-black text-base font-medium">Estate Link Management</Text>
              </View>
              <View className="flex-1">
                <Text className="text-gray-500 text-sm uppercase font-bold mb-1">To Account No</Text>
                <Text className="text-black text-base font-medium">9876543210987</Text>
              </View>
            </View>
          </View>

          {/* Payment Allocation - Simplified Card Layout */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3 border-b border-gray-100 pb-1">
              <Text className="text-[#3C9D9B] text-sm font-bold uppercase">Payment Allocation</Text>
              {isLoadingAllocations && (
                <ActivityIndicator size="small" color="#3C9D9B" />
              )}
            </View>

            {allocationRows.map((alloc: any, idx: number) => {
              const isAdvance = alloc.payment_type === 'advance_payment' || alloc.service_status === 'advance' || alloc.month_name === 'Advance Payment';
              const rowStatus = getAllocationRowStatusFor(alloc);
              const billAmt = isAdvance ? 0 : getBillAmountForAllocation(alloc);
              const rowLabel = alloc.service_period_display || alloc.month_name || (isAdvance ? 'Advance Payment' : 'N/A');
              const grossPenalty = parseFloat(alloc.gross_penalty_amount ?? alloc.penalty_amount ?? '0');
              const waived = parseFloat(alloc.waived_amount ?? '0');

              return (
                <View key={`alloc-${idx}-${alloc.id ?? alloc.transaction_id}`} className="bg-gray-50 rounded-lg p-4 mb-3">
                  {/* Header Row */}
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-black text-base font-lato-bold">
                      {isAdvance ? 'Advance Payment' : rowLabel}
                    </Text>
                    <View style={{ backgroundColor: isAdvance ? '#dbeafe' : (rowStatus === 'PAID FULL' ? '#dcfce7' : '#fff7ed') }} className="px-4 py-1.5 rounded-full">
                      <Text className={`text-xs font-bold ${isAdvance ? 'text-blue-700' : (rowStatus === 'PAID FULL' ? 'text-green-700' : 'text-orange-700')}`}>
                        {isAdvance ? 'Advance paid' : (rowStatus === 'PAID FULL' ? 'PAID' : 'PARTIAL')}
                      </Text>
                    </View>
                  </View>

                  {/* Details */}
                  {!isAdvance && (
                    <>
                      <View className="flex-row justify-between py-1.5 border-b border-gray-200">
                        <Text className="text-gray-600 text-sm">Bill Amount</Text>
                        <Text className="text-black text-sm font-semibold">Tk {formatCurrency(billAmt)}</Text>
                      </View>
                      {grossPenalty > 0 && (
                        <View className="flex-row justify-between py-1.5 border-b border-gray-200">
                          <Text className="text-gray-600 text-sm">Penalty</Text>
                          <Text className="text-black text-sm font-semibold">Tk {formatCurrency(grossPenalty)}</Text>
                        </View>
                      )}
                      {waived > 0 && (
                        <View className="flex-row justify-between py-1.5 border-b border-gray-200">
                          <Text className="text-gray-600 text-sm">Waived</Text>
                          <Text className="text-green-600 text-sm font-semibold">-Tk {formatCurrency(waived)}</Text>
                        </View>
                      )}
                    </>
                  )}

                  {/* Amount Paid */}
                  <View className="flex-row justify-between pt-2">
                    <Text className="text-black text-base font-lato-bold">Amount Paid</Text>
                    <Text className="text-primary text-base font-lato-bold">Tk {formatCurrency(alloc.amount || '0')}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Summary Section */}
          <View className="mb-6 items-end">
            <View className="w-full max-w-[300px]">
              <View className="flex-row justify-between py-2 border-b border-gray-100">
                <Text className="text-black text-base">Subtotal (Bills Payment)</Text>
                <Text className="text-black text-base font-medium">Tk {formatCurrency(subtotal)}</Text>
              </View>
              {(advanceAmount > 0 || advanceTotal > 0) && (
                <View className="flex-row justify-between py-2 border-b border-gray-100">
                  <Text className="text-black text-base">Advance Payment</Text>
                  <Text className="text-black text-base font-medium">Tk {formatCurrency(allocationRows.length > 1 ? String(advanceTotal) : String(advanceAmount))}</Text>
                </View>
              )}
              <View className="flex-row justify-between py-2 border-t-2 border-[#3C9D9B] mt-1">
                <Text className="text-black text-xl font-bold">Total Amount Paid</Text>
                <Text className="text-black text-xl font-bold">Tk {formatCurrency(allocationRows.length > 1 ? String(totalAmountPaid) : (payment.amount || '0'))}</Text>
              </View>
            </View>
          </View>

          {/* Notes & Footer Info */}
          <View className="bg-gray-50 p-4 rounded-lg mb-6">
            {advanceAmount > 0 && (
              <Text className="text-gray-500 text-sm italic mb-4">Advance payment credited for next month.</Text>
            )}

            <View className="flex-row justify-end">
              <View className="items-end">
                <Text className="text-gray-500 text-sm font-bold uppercase mb-1">Recorded At</Text>
                <Text className="text-black text-base">{formatDate(payment.payment_date)}</Text>
                <Text className="text-gray-500 text-sm">{formatTime(payment.payment_date)}</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-col gap-4">
            <TouchableOpacity
              onPress={handleDownloadPDF}
              disabled={isDownloading}
              className="rounded-lg p-4 flex-row items-center justify-center bg-primary"
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="download-outline" size={20} color="white" />
              )}
              <Text className="text-white font-lato-bold ml-2">
                {isDownloading ? 'Preparing PDF...' : 'Download PDF'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShare}
              className="rounded-lg p-4 flex-row items-center justify-center bg-primary"
            >
              <Ionicons name="share-outline" size={20} color="white" />
              <Text className="text-white font-lato-bold ml-2">
                Share Receipt
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer Disclaimer */}
          <View className="mt-8 mb-4">
            <Text className="text-gray-400 text-sm text-center">
              This is an official receipt from Estate Link Property Management.
            </Text>
            <Text className="text-gray-400 text-sm text-center mt-1">
              For any inquiries, please contact the management office.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ReceiptViewScreen;









