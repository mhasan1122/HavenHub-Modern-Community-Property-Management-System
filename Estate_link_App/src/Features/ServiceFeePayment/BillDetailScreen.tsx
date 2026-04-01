import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  RefreshControl,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RootState, AppDispatch } from '../../store';
import { fetchDetailedBill } from '../../store/slices/serviceFeeSlice';
import { API_CONFIG, enhancedFetch } from '../../utils/networkUtils';
import { useAppSelector } from '../../store/hooks';

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const CURRENCY_SYMBOL = '৳';

const BillDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch<AppDispatch>();
  const accessToken = useAppSelector((state: RootState) => state.auth.accessToken);

  const { payment, unit } = route.params as { payment: any; unit: any };
  const { detailedBill, isLoadingDetailedBill, detailedBillError } = useSelector((state: RootState) => state.serviceFee);

  const [paymentInstructions, setPaymentInstructions] = useState<any>(null);
  const [loadingInstructions, setLoadingInstructions] = useState(false);

  const onRefresh = React.useCallback(() => {
    // Determine if payment.id is a valid database ID (integer) or a generated string (e.g. SF-...)
    // The backend expects an integer for payment_id
    const rawId = payment?.id;
    const isNumericId = rawId && !isNaN(Number(rawId)) && String(rawId).indexOf('-') === -1;

    const fetchParams: any = {
      unit_id: payment.unit_id || unit?.id || unit?.unit_id,
      account_holder_type: payment.account_holder_type,
      account_holder_id: payment.account_holder_id,
      service_period_month: payment.service_period_month,
      service_period_year: payment.service_period_year,
    };

    if (isNumericId) {
      fetchParams.payment_id = rawId;
    }

    if (fetchParams.unit_id) {
      dispatch(fetchDetailedBill(fetchParams));
    }
  }, [dispatch, payment, unit]);

  React.useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  // Fetch payment instructions when bill data is available
  useEffect(() => {
    const fetchInstructions = async () => {
      const billToUse = detailedBill?.bill || payment;
      if (!billToUse?.service_fee_id || !accessToken) return;

      try {
        setLoadingInstructions(true);
        const response = await enhancedFetch(
          `${API_CONFIG.BASE_URL}/api/service-fee/${billToUse.service_fee_id}/`,
          { method: 'GET' },
          API_CONFIG.TIMEOUT,
          accessToken
        );

        if (response.ok) {
          const data = await response.json();
          if (data?.success && data?.data) {
            setPaymentInstructions(data.data);
          }
        }
      } catch (err) {
        console.error('❌ Error fetching payment instructions:', err);
      } finally {
        setLoadingInstructions(false);
      }
    };

    fetchInstructions();
  }, [detailedBill?.bill?.service_fee_id, payment?.service_fee_id, accessToken]);

  // Use detailed bill from API if available, otherwise fallback to params
  const billToUse = detailedBill?.bill || payment;

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return '0';
    return numAmount.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 // Web view uses 0 digits
    });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
      return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    } catch {
      return dateString;
    }
  };

  // Get billing period label (e.g., "February 2026")
  const getBillingPeriodLabel = (payment: any): string => {
    if (payment.period || payment.month_name) {
      return payment.period || payment.month_name;
    }
    if (payment.service_period_year && payment.service_period_month) {
      const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
      return `${monthNames[payment.service_period_month - 1]} ${payment.service_period_year}`;
    }
    return 'N/A';
  };

  const period = getBillingPeriodLabel(billToUse);

  // Parse bill_category_details from serviceFees or API response
  const parseBillCategories = () => {
    // PRIORITY 1: Try to get from service_fee_items (new structure with item_type)
    if (billToUse.service_fee_items) {
      try {
        let items: any[] = [];
        if (typeof billToUse.service_fee_items === 'string') {
          items = JSON.parse(billToUse.service_fee_items);
        } else if (Array.isArray(billToUse.service_fee_items)) {
          items = billToUse.service_fee_items;
        }

        if (!Array.isArray(items)) items = [];

        // Map items to ensure consistent field names and enrich with usage
        const mappedItems = items.map((item: any) => {
          let description = item.description || '';
          const itemType = (item.item_type || '').toLowerCase();
          let finalItemName = item.item_name || item.bill_category_name || (itemType === 'penalty' ? 'Late Payment Penalty' : 'Service Fee');

          // Enrichment for Penalty items
          if (itemType === 'penalty') {
            const percentage = parseFloat(item.tier_percentage || 0);
            const daysOverdue = item.tier_days_overdue;


          }
          // Enrichment for Bill Category items (Readings/Usage)
          else if (itemType === 'bill_category') {
            const usage = parseFloat(item.consumption || 0);
            const rate = parseFloat(item.price_per_unit || 0);
            const prev = parseFloat(item.previous_reading || 0);
            const curr = parseFloat(item.current_reading || 0);

            if (usage > 0 || rate > 0 || curr > 0 || prev > 0) {
              const uom = item.unit_of_measurement || 'units';
              description = `(Reading: ${curr} - ${prev}) (${usage} ${uom} × ${formatCurrency(rate)})`;
            } else {
              description = item.description || '';
            }
          }
          // Enrichment for Base Fee items
          else if (itemType === 'base_fee') {
            finalItemName = `Base service fee for ${period}`;
            description = '';
          }

          return {
            ...item,
            item_name: finalItemName,
            description: description
          };
        });
        return mappedItems;
      } catch (e) {
        console.error('Error parsing service_fee_items:', e);
      }
    }

    // PRIORITY 2: Fallback to serviceFees (transformed data)
    if (billToUse.serviceFees && Array.isArray(billToUse.serviceFees)) {
      const items: any[] = [];
      billToUse.serviceFees.forEach((category: any) => {
        if (category.items && Array.isArray(category.items)) {
          category.items.forEach((item: any) => {
            items.push(item);
          });
        }
      });
      return items;
    }

    // PRIORITY 3: Fallback to bill_category_details
    if (!billToUse.bill_category_details) {
      return [];
    }
    try {
      const parsed = typeof billToUse.bill_category_details === 'string'
        ? JSON.parse(billToUse.bill_category_details)
        : billToUse.bill_category_details;
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Error parsing bill_category_details:', e);
      return [];
    }
  };

  const feeItems = parseBillCategories();

  // Calculate days overdue
  const getDaysOverdue = (payment: any): number => {
    if (!payment || !payment.due_date) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(payment.due_date);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - dueDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const getStatusConfig = (statusInput: string | undefined, payment: any) => {
    let status = statusInput?.toLowerCase() || 'due';

    // Fallback logic if status is not explicit
    if (!statusInput) {
      const dueAmount = parseFloat(payment.due_amount || '0');
      const feeAmount = parseFloat(payment.fee_amount || '0');
      const dueDate = new Date(payment.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < today && dueAmount > 0) status = 'overdue';
      else if (dueAmount === 0) status = 'paid';
      else if (dueAmount > 0 && dueAmount < feeAmount) status = 'partial';
    }

    switch (status) {
      case 'paid':
        return { text: 'Paid', bgColor: 'bg-green-100', textColor: 'text-green-700' };
      case 'partial':
        return { text: 'Partial', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' };
      case 'overdue':
        return { text: 'Overdue', bgColor: 'bg-red-100', textColor: 'text-red-700' };
      default:
        return { text: 'Due', bgColor: 'bg-blue-100', textColor: 'text-blue-700' };
    }
  };

  // --- Data Preparation ---
  // billToUse is already defined at top level

  const baseServiceFee = feeItems
    .filter((item: any) => (item.item_type || '').toLowerCase() === 'base_fee')
    .reduce((sum: number, item: any) => sum + parseFloat(item.amount || 0), 0) || parseFloat(billToUse.base_service_amount || billToUse.service_fee_amount || billToUse.original_amount || 0);

  const additionalCharges = feeItems
    .filter((item: any) => (item.item_type || '').toLowerCase() === 'bill_category')
    .reduce((sum: number, item: any) => sum + parseFloat(item.amount || 0), 0);

  const penaltyAmount = feeItems
    .filter((item: any) => (item.item_type || '').toLowerCase() === 'penalty')
    .reduce((sum: number, item: any) => sum + parseFloat(item.amount || 0), 0) || parseFloat(billToUse.penalty_amount || 0);

  const penaltyPercentage = parseFloat(billToUse.penalty_percentage || 0);

  const subtotal = baseServiceFee + additionalCharges;
  const totalDueBeforePayments = subtotal + penaltyAmount;

  // For compatibility with existing render code if needed
  const originalAmount = baseServiceFee;
  const gasFee = additionalCharges;

  const paidAmount = billToUse.paid_amount != null && String(billToUse.paid_amount).trim() !== ''
    ? parseFloat(String(billToUse.paid_amount))
    : 0;

  const totalReceived = paidAmount;

  const remainingAmount = parseFloat(billToUse.remaining_amount ?? billToUse.due_amount ?? '0');
  const netBalance = totalDueBeforePayments - totalReceived;
  const balanceLabel = 'Total Due';
  const balanceColorClass = netBalance > 0 ? 'text-red-600' : 'text-green-600';

  const daysOverdue = getDaysOverdue(billToUse);

  const statusConfig = getStatusConfig(billToUse.service_status || billToUse.status, billToUse);

  // Invoice Date Logic (matching Web BillDetailView.jsx):
  // 1. invoiceDate (camelCase)
  // 2. createdAt (camelCase)
  // 3. created_at (snake_case)
  // 4. Fallback: Today's date (new Date().toISOString())
  const invoiceDate = billToUse.invoiceDate || billToUse.createdAt || billToUse.created_at || new Date().toISOString();

  const dueDate = billToUse.dueDate || billToUse.due_date || (() => {
    const date = new Date(invoiceDate);
    date.setDate(date.getDate() + 14); // Default 14 days
    return date.toISOString();
  })();

  // Match web app & API: backend returns bill_number (snake_case)
  const billNumber = billToUse.bill_number || billToUse.billNumber || `BILL-${billToUse.service_period_year}${String(billToUse.service_period_month).padStart(2, '0')}-${billToUse.payment_id || billToUse.id}`;

  // Breakdown Items
  const serviceFeeItems = Array.isArray(billToUse.service_fee_items) ? billToUse.service_fee_items : [];

  // Filter items like web view
  const baseAndBillItems = serviceFeeItems.filter((item: any) => {
    const itemType = (item.item_type || '').toLowerCase();
    return itemType === 'base_fee' || itemType === 'bill_category';
  });

  // If no items, fallback to showing base + gas
  const showFallbackItems = baseAndBillItems.length === 0;

  // Payment Details
  let paymentDetails = billToUse.payment_details;
  if (typeof paymentDetails === 'string') {
    try { paymentDetails = JSON.parse(paymentDetails); } catch { paymentDetails = []; }
  }
  const hasPayments = Array.isArray(paymentDetails) && paymentDetails.length > 0;
  const isPaidOnly = (billToUse.service_status || billToUse.status || '').toLowerCase() === 'paid';

  const handleDownload = async () => {
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invoice ${billNumber}</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
              color: #111827; 
              line-height: 1.5; 
              font-size: 14px; 
              padding: 0; 
              margin: 0;
              background-color: #f3f4f6;
            }
            .page {
              background-color: #ffffff;
              width: 100%;
              max-width: 800px;
              margin: 0 auto;
              min-height: 100vh;
              box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
            }
            .header {
              background-color: #0d9488;
              padding: 40px;
              color: white;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .header-left h1 {
              margin: 0;
              font-size: 32px;
              font-weight: 800;
              letter-spacing: -0.025em;
            }
            .header-left p {
              margin: 4px 0 0 0;
              color: #ccfbf1;
              font-size: 16px;
            }
            .company-contact {
              margin-top: 20px;
              font-size: 12px;
              color: #f0fdfa;
            }
            .company-contact div {
              margin-bottom: 2px;
            }
            .header-right {
              text-align: right;
            }
            .invoice-card {
              background-color: white;
              border-radius: 16px;
              padding: 12px 24px;
              margin-bottom: 16px;
              display: inline-block;
            }
            .invoice-card-label {
              color: #0f766e;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 4px;
            }
            .invoice-card-number {
              color: #0f766e;
              font-size: 20px;
              font-weight: 800;
              margin: 0;
            }
            .header-dates {
              font-size: 12px;
              color: white;
            }
            .header-dates div {
              margin-bottom: 4px;
            }
            
            .billing-section {
              padding: 32px 40px;
              display: flex;
              justify-content: space-between;
              border-bottom: 1px solid #f3f4f6;
            }
            .section-label {
              color: #9ca3af;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 12px;
            }
            .bill-to-info h3 {
              margin: 0 0 4px 0;
              font-size: 18px;
              font-weight: 700;
              color: #111827;
            }
            .bill-to-info p {
              margin: 0;
              color: #374151;
              font-size: 14px;
            }
            .billing-period-info {
              text-align: right;
            }
            .billing-period-info h3 {
              margin: 0 0 8px 0;
              font-size: 20px;
              font-weight: 700;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 9999px;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
            }
            .badge-overdue { background-color: #fee2e2; color: #b91c1c; }
            .badge-paid { background-color: #dcfce7; color: #15803d; }
            .badge-due { background-color: #dbeafe; color: #1d4ed8; }

            .content-area {
              padding: 32px 40px;
            }
            .content-area h2 {
              margin: 0 0 24px 0;
              font-size: 18px;
              font-weight: 700;
            }
            .breakdown-row {
              display: flex;
              justify-content: space-between;
              padding: 16px 0;
              border-bottom: 1px solid #f3f4f6;
            }
            .item-info h4 {
              margin: 0 0 4px 0;
              font-size: 14px;
              font-weight: 600;
              color: #1f2937;
            }
            .item-info p {
              margin: 0;
              font-size: 12px;
              color: #6b7280;
            }
            .item-amount {
              font-size: 14px;
              font-weight: 700;
              color: #1f2937;
            }
            .penalty-text {
              color: #dc2626 !important;
            }

            .summary-section {
              margin-top: 32px;
              border-top: 2px solid #e5e7eb;
              padding-top: 16px;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              font-size: 14px;
              font-weight: 600;
            }
            .total-due-card {
              margin-top: 24px;
              background-color: #0d9488;
              border-radius: 12px;
              padding: 20px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              color: white;
            }
            .total-due-label {
              font-size: 18px;
              font-weight: 700;
              color: white;
            }
            .total-due-amount {
              font-size: 24px;
              font-weight: 800;
              color: white;
            }

            .payment-info-box {
              margin-top: 32px;
              background-color: #f0fdf4;
              border: 1px solid #dcfce7;
              border-radius: 20px;
              padding: 24px;
            }
            .payment-info-box h3 {
              margin: 0 0 16px 0;
              font-size: 18px;
              font-weight: 800;
              color: #166534;
              border-bottom: 1px solid #dcfce7;
              padding-bottom: 12px;
            }
            .payment-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
            }
            .payment-detail-label {
              font-size: 10px;
              font-weight: 700;
              color: #6b7280;
              text-transform: uppercase;
              margin-bottom: 4px;
            }
            .payment-detail-value {
              font-size: 16px;
              font-weight: 800;
              color: #0f766e;
            }
            .payment-received-msg {
              margin-top: 20px;
              padding-top: 16px;
              border-top: 1px solid #dcfce7;
              display: flex;
              align-items: center;
              color: #059669;
              font-size: 18px;
              font-weight: 800;
            }

            .instructions-section {
              margin-top: 40px;
              padding-top: 24px;
              border-top: 1px solid #e5e7eb;
            }
            .instruction-item {
              margin-bottom: 24px;
            }
            .instruction-title {
              font-size: 14px;
              font-weight: 700;
              color: #1f2937;
              margin-bottom: 8px;
            }
            .instruction-content {
              font-size: 14px;
              color: #4b5563;
              line-height: 1.6;
            }

            .footer {
              padding: 32px 40px;
              background-color: #f9fafb;
              border-top: 1px solid #f3f4f6;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <div class="header-left">
                <h1>Estate Link</h1>
                <p>Property Management Services</p>
                <div class="company-contact">
                  <div>123 Property Lane, Dhaka 1212, Bangladesh</div>
                  <div>Phone: +880 1234-567890</div>
                  <div>Email: billing@estatelink.com</div>
                </div>
              </div>
              <div class="header-right">
                <div class="invoice-card">
                  <div class="invoice-card-label">INVOICE</div>
                  <div class="invoice-card-number">${billNumber}</div>
                </div>
                <div class="header-dates">
                  <div>Invoice Date: ${formatDate(invoiceDate)}</div>
                  <div>Due Date: ${formatDate(dueDate)}</div>
                </div>
              </div>
            </div>

            <div class="billing-section">
              <div class="bill-to-info">
                <div class="section-label">BILL TO</div>
                <h3>${billToUse.resident || billToUse.primary_name || 'N/A'}</h3>
                <p>${unit?.unit_name || billToUse.unit_name || billToUse.unit || 'N/A'}</p>
                <p>${billToUse.email || billToUse.primary_email || 'N/A'}</p>
              </div>
              <div class="billing-period-info">
                <div class="section-label">BILLING PERIOD</div>
                <h3>${period}</h3>
                <span class="status-badge ${statusConfig.text === 'Overdue' ? 'badge-overdue' : statusConfig.text === 'Paid' ? 'badge-paid' : 'badge-due'}">
                  ${statusConfig.text.toUpperCase()}
                </span>
              </div>
            </div>

            <div class="content-area">
              <h2>Service Fee Breakdown</h2>
              
              <div class="breakdown-list">
                ${feeItems.length > 0 ?
          feeItems.filter((item: any) => {
            const itemType = (item.item_type || '').toLowerCase();
            return itemType === 'base_fee' || itemType === 'bill_category';
          }).map((item: any) => `
                    <div class="breakdown-row">
                      <div class="item-info">
                        <h4>${item.item_name}</h4>
                        ${item.description ? `<p>${item.description}</p>` : ''}
                      </div>
                      <div class="item-amount">৳ ${formatCurrency(Math.abs(parseFloat(item.amount || 0)))}</div>
                    </div>
                  `).join('')
          : `
                    <div class="breakdown-row">
                      <div class="item-info">
                        <h4>Base service fee for ${period}</h4>
                      </div>
                      <div class="item-amount">৳ ${formatCurrency(originalAmount)}</div>
                    </div>
                  `
        }

                ${feeItems.filter((item: any) => (item.item_type || '').toLowerCase() === 'penalty').map(item => `
                  <div class="breakdown-row">
                    <div class="item-info">
                      <h4 class="penalty-text">${item.item_name} (${item.tier_percentage || penaltyPercentage}%)</h4>
                      ${item.description ? `<p class="penalty-text">${item.description}</p>` : ''}
                      ${daysOverdue > 0 && !(item.description || '').toLowerCase().includes('overdue') ? `
                        <p class="penalty-text">Payment is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue</p>
                      ` : ''}
                      <p class="penalty-text">৳ ${formatCurrency(baseServiceFee)} x ${item.tier_percentage || penaltyPercentage}% = ৳ ${formatCurrency(item.amount)}</p>
                    </div>
                    <div class="item-amount penalty-text">৳ ${formatCurrency(item.amount)}</div>
                  </div>
                `).join('')}

                ${(feeItems.filter((item: any) => (item.item_type || '').toLowerCase() === 'penalty').length === 0 && penaltyAmount > 0) ? `
                  <div class="breakdown-row">
                    <div class="item-info">
                      <h4 class="penalty-text">Late Payment Penalty (${penaltyPercentage}%)</h4>
                      ${daysOverdue > 0 ? `
                        <p class="penalty-text">Payment is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue</p>
                      ` : ''}
                      <p class="penalty-text">৳ ${formatCurrency(baseServiceFee)} x ${penaltyPercentage}% = ৳ ${formatCurrency(penaltyAmount)}</p>
                    </div>
                    <div class="item-amount penalty-text">৳ ${formatCurrency(penaltyAmount)}</div>
                  </div>
                ` : ''}

                ${penaltyAmount > 0 ? `
                  <div style="margin-top: 16px; padding: 12px; background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; font-size: 11px; color: #92400e; line-height: 1.4;">
                    Note: Late penalties are automatically calculated based on the number of days past the due date. Pay immediately to avoid additional charges.
                  </div>
                ` : ''}
              </div>

              <div class="summary-section">
                <div class="summary-row">
                  <span>Base Service Fee</span>
                  <span>৳ ${formatCurrency(baseServiceFee)}</span>
                </div>
                ${additionalCharges > 0 ? `
                  <div class="summary-row">
                    <span>Additional Charges</span>
                    <span>৳ ${formatCurrency(additionalCharges)}</span>
                  </div>
                ` : ''}
                ${penaltyAmount > 0 ? `
                  <div class="summary-row penalty-text">
                    <span>Late Penalties</span>
                    <span>+৳ ${formatCurrency(penaltyAmount)}</span>
                  </div>
                ` : ''}

                <div class="total-due-card">
                  <div class="total-due-label">Total Amount Due</div>
                  <div class="total-due-amount">৳ ${formatCurrency(totalDueBeforePayments)}</div>
                </div>

                ${totalReceived > 0 ? `
                  <div class="summary-row" style="margin-top: 16px; color: #059669;">
                    <span>Total Received</span>
                    <span>-৳ ${formatCurrency(totalReceived)}</span>
                  </div>
                  <div class="summary-row" style="font-size: 18px; font-weight: 800; border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 8px;">
                    <span>Net Balance</span>
                    <span style="${netBalance > 0 ? 'color: #dc2626;' : 'color: #059669;'}">৳ ${formatCurrency(netBalance > 0 ? netBalance : 0)}</span>
                  </div>
                ` : ''}
              </div>

              ${hasPayments && isPaidOnly ? `
                <div class="payment-info-box">
                  <h3>Payment Information</h3>
                  ${paymentDetails.map((pay: any) => `
                    <div class="payment-grid">
                      <div>
                        <div class="payment-detail-label">PAYMENT METHOD</div>
                        <div class="payment-detail-value">${pay.payment_method || 'N/A'}</div>
                      </div>
                      <div>
                        <div class="payment-detail-label">TRANSACTION ID</div>
                        <div class="payment-detail-value" style="font-family: monospace;">${pay.reference_number || pay.transaction_id || 'N/A'}</div>
                      </div>
                      <div>
                        <div class="payment-detail-label">PAYMENT DATE</div>
                        <div class="payment-detail-value">${pay.payment_date ? formatDate(pay.payment_date) : 'N/A'}</div>
                      </div>
                      <div>
                        <div class="payment-detail-label">AMOUNT PAID</div>
                        <div class="payment-detail-value" style="font-size: 20px; color: #0d9488;">৳ ${formatCurrency(pay.amount_paid || 0)}</div>
                      </div>
                    </div>
                  `).join('')}
                  <div class="payment-received-msg">
                    <span style="margin-right: 8px;">✓</span> Payment Received - Thank You!
                  </div>
                </div>
              ` : ''}

              ${!isPaidOnly ? `
                <div class="instructions-section">
                  <h2>Payment Instructions</h2>
                  
                  <div class="instruction-item">
                    <div class="instruction-title">Bank Transfer</div>
                    <div class="instruction-content">
                      Account Name: Estate Link Management<br>
                      Account Number: 1234567890<br>
                      Bank: ABC Bank Ltd.<br>
                      <small style="color: #6b7280;">Please include invoice #${billNumber} as reference</small>
                    </div>
                  </div>

                  <div class="instruction-item">
                    <div class="instruction-title">Mobile Financial Service (MFS)</div>
                    <div class="instruction-content">
                      bKash/Nagad/Rocket: 01712-345678<br>
                      <small style="color: #6b7280;">Send payment and share transaction ID via email</small>
                    </div>
                  </div>

                  <div class="instruction-item">
                    <div class="instruction-title">Cash Payment</div>
                    <div class="instruction-content">
                      Visit the management office during business hours<br>
                      Mon-Fri: 9:00 AM - 5:00 PM
                    </div>
                  </div>
                </div>
              ` : ''}
            </div>

            <div class="footer">
              <p>Questions about this invoice? Contact us at billing@estatelink.com or call +880 1234-567890</p>
              <p>This is a computer-generated invoice. No signature required.</p>
              <p>Estate Link Property Management | Tax ID: 123456789 | Registration No: ABC-12345</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate invoice PDF');
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-gray-100">
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* App Header (Outside Invoice) */}
      <View className="flex-row items-center px-4 py-3 bg-gray-100">
        <TouchableOpacity onPress={() => navigation.goBack()} className="flex-row items-center p-2">
          <Ionicons name="arrow-back" size={24} color="#374151" />
          <Text className="text-lg text-gray-700 ml-1 font-medium">Back</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-center text-xl font-semibold text-gray-900">Bill Details</Text>
        <TouchableOpacity onPress={handleDownload} className="p-2">
          <Ionicons name="download-outline" size={24} color="#374151" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 pb-10"
        refreshControl={
          <RefreshControl refreshing={isLoadingDetailedBill} onRefresh={onRefresh} />
        }
      >

        {detailedBillError && (
          <View className="p-4 bg-red-100 m-4 rounded-lg">
            <Text className="text-red-700">{detailedBillError}</Text>
          </View>
        )}

        {/* Invoice Container */}
        <View className="bg-white rounded-lg overflow-hidden mb-5 shadow-sm elevation-3">

          {/* Invoice Header - Teal Background */}
          <View className="bg-teal-600 px-6 py-6">
            <View className="flex-row justify-between items-start mb-4">
              {/* Left: Company Information */}
              <View className="flex-1">
                <Text className="text-2xl font-bold text-white mb-1">Estate Link</Text>
                <Text className="text-sm text-teal-100 mb-3">Property Management Services</Text>
                <View>
                  <Text className="text-xs text-teal-50 mb-0.5">123 Property Lane, Dhaka 1212, Bangladesh</Text>
                  <Text className="text-xs text-teal-50 mb-0.5">Phone: +880 1234-567890</Text>
                  <Text className="text-xs text-teal-50">Email: billing@estatelink.com</Text>
                </View>
              </View>

              {/* Right: Invoice Details Card */}
              <View className="items-end">
                <View className="bg-white rounded-2xl px-4 py-3 mb-3">
                  <Text className="text-xs font-semibold uppercase text-teal-700 mb-1 text-right">INVOICE</Text>
                  <Text className="text-lg font-bold text-teal-700 text-center">{billNumber}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs text-white">Invoice Date: {formatDate(invoiceDate)}</Text>
                  <Text className="text-xs text-white">Due Date: {formatDate(dueDate)}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Billing Section */}
          <View className="flex-row justify-between px-6 py-6 bg-white border-b border-gray-100">
            <View className="flex-1">
              <Text className="text-xs font-bold text-gray-400 uppercase mb-2">BILL TO</Text>
              <Text className="text-base font-bold text-gray-900 mb-1">
                {billToUse.resident || billToUse.primary_name || 'N/A'}
                {billToUse.account_holder_type === 'owner' && (
                  <Text className="text-xs text-gray-500 ml-2">OWNER</Text>
                )}
              </Text>
              <Text className="text-sm text-gray-700">{unit?.unit_name || billToUse.unit_name || billToUse.unit || 'N/A'}</Text>
              <Text className="text-sm text-gray-600 mt-1">{billToUse.email || billToUse.primary_email || 'N/A'}</Text>
            </View>

            <View className="flex-1 items-end">
              <Text className="text-xs font-bold text-gray-400 uppercase mb-2">BILLING PERIOD</Text>
              <Text className="text-lg font-bold text-gray-900 mb-2">{period}</Text>
              {statusConfig.text === 'Overdue' && (
                <View className="bg-red-100 px-3 py-1 rounded-full">
                  <Text className="text-xs font-bold text-red-700 uppercase">OVERDUE</Text>
                </View>
              )}
            </View>
          </View>

          {/* Content Area */}
          <View className="px-6 py-6 bg-white">
            <Text className="text-base font-bold text-gray-900 mb-4">Service Fee Breakdown</Text>

            <View>
              {feeItems.length > 0 ? (
                // Use new feeItems structure
                feeItems.filter((item: any) => {
                  const itemType = (item.item_type || '').toLowerCase();
                  return itemType === 'base_fee' || itemType === 'bill_category';
                }).map((item: any, index: number) => {
                  const itemAmount = parseFloat(item.amount || 0);
                  return (
                    <View key={index} className="flex-row justify-between py-3 border-b border-gray-100">
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-gray-800">{item.item_name}</Text>
                        {item.description ? (
                          <Text className="text-xs text-gray-500 mt-0.5">{item.description}</Text>
                        ) : null}
                      </View>
                      <Text className="text-sm font-bold text-gray-800">{CURRENCY_SYMBOL}{formatCurrency(Math.abs(itemAmount))}</Text>
                    </View>
                  );
                })
              ) : (
                // Fallback if no items
                <View className="flex-row justify-between py-3 border-b border-gray-100">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-800">Base service fee for {period}</Text>
                  </View>
                  <Text className="text-sm font-bold text-gray-800">{CURRENCY_SYMBOL}{formatCurrency(originalAmount)}</Text>
                </View>
              )}

              {/* Late Payment Penalty from feeItems or legacy */}
              {(() => {
                const penaltyItems = feeItems.filter((item: any) => (item.item_type || '').toLowerCase() === 'penalty');

                if (penaltyItems.length > 0) {
                  return penaltyItems.map((item: any, index: number) => (
                    <View key={`penalty-${index}`} className="py-3 border-b border-gray-100">
                      <View className="flex-row justify-between mb-2">
                        <Text className="text-sm font-bold text-red-600">
                          {item.item_name} ({item.tier_percentage || penaltyPercentage}%)
                        </Text>
                        <Text className="text-sm font-bold text-red-600">{CURRENCY_SYMBOL}{formatCurrency(item.amount)}</Text>
                      </View>
                      {item.description ? (
                        <Text className="text-xs text-red-600 mb-1">{item.description}</Text>
                      ) : null}
                      {daysOverdue > 0 && !item.description?.includes('overdue') && (
                        <Text className="text-xs text-red-600 mb-1">Payment is {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue</Text>
                      )}
                      <Text className="text-xs text-red-600 mb-1">
                        {CURRENCY_SYMBOL}{formatCurrency(baseServiceFee)} x {item.tier_percentage || penaltyPercentage}% = {CURRENCY_SYMBOL}{formatCurrency(item.amount)}
                      </Text>
                    </View>
                  ));
                } else if (penaltyAmount > 0) {
                  // Legacy penalty display
                  return (
                    <View className="py-3 border-b border-gray-100">
                      <View className="flex-row justify-between mb-2">
                        <Text className="text-sm font-bold text-red-600">
                          Late Payment Penalty ({penaltyPercentage > 0 ? `${penaltyPercentage}%` : 'N/A'})
                        </Text>
                        <Text className="text-sm font-bold text-red-600">{CURRENCY_SYMBOL}{formatCurrency(penaltyAmount)}</Text>
                      </View>
                      {daysOverdue > 0 && (
                        <Text className="text-xs text-red-600 mb-1">Payment is {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue</Text>
                      )}
                      <Text className="text-xs text-red-600 mb-1">
                        {CURRENCY_SYMBOL}{formatCurrency(baseServiceFee)} x {penaltyPercentage}% = {CURRENCY_SYMBOL}{formatCurrency(penaltyAmount)}
                      </Text>
                    </View>
                  );
                }
                return null;
              })()}
            </View>

            {/* Important Note Section */}
            {penaltyAmount > 0 && (
              <View className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                <Text className="text-xs text-yellow-800 leading-5">
                  Note: Late penalties are automatically calculated based on the number of days past the due date. Pay immediately to avoid additional charges.
                </Text>
              </View>
            )}

            {/* Summary Section */}
            <View className="mt-6 border-t-2 border-gray-200 pt-4">
              <View className="flex-row justify-between py-2">
                <Text className="text-sm font-semibold text-gray-900">Base Service Fee</Text>
                <Text className="text-sm font-semibold text-gray-900">{CURRENCY_SYMBOL}{formatCurrency(baseServiceFee)}</Text>
              </View>

              {additionalCharges > 0 && (
                <View className="flex-row justify-between py-2">
                  <Text className="text-sm font-semibold text-gray-900">Additional Charges</Text>
                  <Text className="text-sm font-semibold text-gray-900">{CURRENCY_SYMBOL}{formatCurrency(additionalCharges)}</Text>
                </View>
              )}

              {penaltyAmount > 0 && (
                <View className="flex-row justify-between py-2">
                  <Text className="text-sm font-semibold text-red-600">Late Penalties</Text>
                  <Text className="text-sm font-semibold text-red-600">+{CURRENCY_SYMBOL}{formatCurrency(penaltyAmount)}</Text>
                </View>
              )}

              <View className="bg-primary my-4 -mx-2 px-4 py-4 rounded-lg border border-primary flex-row justify-between items-center">
                <Text className="text-base font-bold text-white">Total Amount Due</Text>
                <Text className="text-xl font-bold text-white">{CURRENCY_SYMBOL}{formatCurrency(totalDueBeforePayments)}</Text>
              </View>
            </View>

            {/* Payment Information */}
            {hasPayments && isPaidOnly && (
              <View className="mt-6 bg-green-50 border border-green-100 rounded-2xl p-5">
                <Text className="text-lg font-extrabold text-green-800 mb-4 border-b border-green-100 pb-2.5">Payment Information</Text>
                {paymentDetails.map((pay: any, index: number) => (
                  <View key={index} className="mb-5">
                    <View className="flex-row justify-between gap-3">
                      <View className="flex-1">
                        <Text className="text-xs font-bold text-gray-500 uppercase mb-1">PAYMENT METHOD</Text>
                        <Text className="text-base font-extrabold text-teal-700">{pay.payment_method || 'N/A'}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-bold text-gray-500 uppercase mb-1">TRANSACTION ID</Text>
                        <Text className={`text-base font-extrabold text-teal-700 ${Platform.OS === 'ios' ? 'font-mono' : 'font-mono'}`}>
                          {pay.reference_number || pay.transaction_id || 'N/A'}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row justify-between gap-3 mt-3">
                      <View className="flex-1">
                        <Text className="text-xs font-bold text-gray-500 uppercase mb-1">PAYMENT DATE</Text>
                        <Text className="text-base font-extrabold text-teal-700">
                          {pay.payment_date ? formatDate(pay.payment_date) : 'N/A'}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-bold text-gray-500 uppercase mb-1">AMOUNT PAID</Text>
                        <Text className="text-xl font-black text-teal-600">{CURRENCY_SYMBOL}{formatCurrency(pay.amount_paid || 0)}</Text>
                      </View>
                    </View>

                    <View className="flex-row items-center gap-2 mt-4 pt-4 border-t border-green-100">
                      <Ionicons name="checkmark-circle" size={20} color="#059669" />
                      <Text className="text-lg font-extrabold text-green-600">Payment Received - Thank You!</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Payment Instructions Section - Only show for unpaid bills */}
            {(billToUse.service_status || '').toLowerCase() !== 'paid' && (
              <View className="mt-8 border-t border-gray-200 pt-6">
                <Text className="text-base font-bold text-gray-800 mb-6">Payment Instructions</Text>

                <View>
                  {/* Bank Transfer */}
                  <View className="pb-4 border-b border-gray-50 mb-6">
                    <Text className="text-sm font-bold text-gray-800 mb-3">Bank Transfer</Text>
                    <View>
                      <Text className="text-sm text-gray-600 mb-1">Account Name: Estate Link Management</Text>
                      <Text className="text-sm text-gray-600 mb-1">Account Number: 1234567890</Text>
                      <Text className="text-sm text-gray-600 mb-1">Bank: ABC Bank Ltd.</Text>
                      <Text className="text-xs text-gray-400 mt-2">
                        Please include invoice #{billNumber} as reference
                      </Text>
                    </View>
                  </View>

                  {/* Mobile Financial Service */}
                  <View className="pb-4 border-b border-gray-50 mb-6">
                    <Text className="text-sm font-bold text-gray-800 mb-3">Mobile Financial Service (MFS)</Text>
                    <View>
                      <Text className="text-sm text-gray-600 mb-1">bKash/Nagad/Rocket: 01712-345678</Text>
                      <Text className="text-xs text-gray-400 mt-1">
                        Send payment and share transaction ID via email
                      </Text>
                    </View>
                  </View>

                  {/* Cash Payment */}
                  <View className="pb-2">
                    <Text className="text-sm font-bold text-gray-800 mb-3">Cash Payment</Text>
                    <View>
                      <Text className="text-sm text-gray-600 mb-1">Visit the management office during business hours</Text>
                      <Text className="text-xs text-gray-400">Mon-Fri: 9:00 AM - 5:00 PM</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

          </View>

          {/* Footer */}
          <View className="px-6 py-6 bg-gray-50 border-t border-gray-100">
            <Text className="text-xs text-gray-500 text-center mb-2">
              Questions about this invoice? Contact us at billing@estatelink.com or call +880 1234-567890
            </Text>
            <Text className="text-xs text-gray-400 text-center mb-2">
              This is a computer-generated invoice. No signature required.
            </Text>
            <Text className="text-xs text-gray-400 text-center">
              Estate Link Property Management | Tax ID: 123456789 | Registration No: ABC-12345
            </Text>
          </View>

        </View>

        <View className="h-24" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default BillDetailScreen;
