import PropTypes from 'prop-types';
import { FaBuilding, FaPrint, FaDownload, FaArrowLeft, FaCheckCircle, FaExclamationCircle, FaClock, FaFileInvoice, FaTimes, FaUniversity, FaMobileAlt, FaMoneyBillWave } from 'react-icons/fa';
import { IoCheckmarkCircle, IoTimeOutline, IoReceiptOutline, IoInformationCircleOutline } from 'react-icons/io5';
import { useState, useEffect } from 'react';
import html2pdf from 'html2pdf.js';
import axiosInstance from '../../../../utils/axiosInstance';



import calculateDaysOverdue from '../../utils/feeUtils';





const BillDetailView = ({ bill, onBack, onPrint, onDownloadPDF }) => {
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [billData, setBillData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentInstructions, setPaymentInstructions] = useState(null);
  const [loadingInstructions, setLoadingInstructions] = useState(false);

  if (!bill) return null;

  // Always fetch fresh bill details when modal opens - use ONLY API data
  useEffect(() => {
    const fetchBillData = async () => {
      console.log('=== Fetching Bill Data ===');
      const paymentId = bill.payment_id || bill.id;
      console.log('Payment ID:', paymentId);

      if (!paymentId) {
        setError('No payment ID provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await axiosInstance.get('/api/service-fee-management/billing-detailed/', {
          params: {
            payment_id: paymentId,
            unit_id: bill.unit_id || bill.unitId,
            account_holder_type: bill.account_holder_type,
            account_holder_id: bill.account_holder_id
          }
        });

        console.log('✅ API Response:', response.data);

        if (response.data?.success && response.data?.data?.payments && response.data.data.payments.length > 0) {
          const freshData = response.data.data.payments[0];
          setBillData(freshData);
          console.log('✅ Bill data loaded:', freshData);
        } else {
          setError('No bill data found');
          console.warn('⚠️ No payment data in response');
        }
      } catch (error) {
        console.error('❌ Error fetching bill data:', error);
        setError(error.response?.data?.message || 'Failed to load bill data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBillData();
  }, [bill.payment_id, bill.id]);

  // Fetch payment instructions when bill data is available
  useEffect(() => {
    const fetchInstructions = async () => {
      if (!billData?.service_fee_id) return;

      try {
        setLoadingInstructions(true);
        console.log('Fetching payment instructions for service fee:', billData.service_fee_id);
        const response = await axiosInstance.get(`/api/service-fee/${billData.service_fee_id}/`);

        if (response.data?.success && response.data?.data) {
          setPaymentInstructions(response.data.data);
          console.log('✅ Payment instructions loaded:', response.data.data);
        }
      } catch (err) {
        console.error('❌ Error fetching payment instructions:', err);
      } finally {
        setLoadingInstructions(false);
      }
    };

    fetchInstructions();
  }, [billData?.service_fee_id]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading bill details...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !billData) {
    return (
      <div className="w-full">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors mb-6"
        >
          <FaArrowLeft className="w-4 h-4" />
          <span className="font-medium">Back to Bills List</span>
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <FaExclamationCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-900 mb-2">Failed to Load Bill</h3>
          <p className="text-red-700">{error || 'Unable to load bill data'}</p>
        </div>
      </div>
    );
  }

  // Use ONLY API data - no fallback to bill prop
  const billToUse = billData;

  // Debug logging - using only API data
  console.log('BillDetailView - API billData:', billToUse);
  console.log('BillDetailView - service_status:', billToUse.service_status);
  console.log('BillDetailView - payment_details:', billToUse.payment_details);

  // Define waived and advance amounts at component level
  const totalWaived = parseFloat(billToUse.waived_amount || billToUse.waiverAmount || 0);
  const totalAdvance = parseFloat(billToUse.advance_amount || billToUse.advanceAmount || 0);

  const formatCurrency = (amount) => {
    return `৳${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatDate = (dateString) => {
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

  const getInvoiceHtml = () => {
    const period = billToUse.period || billToUse.month_name || `${billToUse.service_period_year}${String(billToUse.service_period_month).padStart(2, '0')}`;
    const statusConfig = getStatusConfig(billToUse.service_status || billToUse.status);

    // Preparation for breakdown
    const baseAndBillItems = feeItems.filter(item => {
      const itemType = (item.item_type || '').toLowerCase();
      return itemType === 'base_fee' || itemType === 'bill_category';
    });
    const penaltyItems = feeItems.filter(item => {
      const itemType = (item.item_type || '').toLowerCase();
      return itemType === 'penalty';
    });

    const waiverHtml = '';

    const breakdownHtml = `
      ${baseAndBillItems.map(item => {
      const itemAmount = parseFloat(item.amount || 0);
      let itemName = item.item_name || item.bill_category_name || 'Service Fee';
      if (item.item_type === 'base_fee') itemName = 'Service Fee';
      return `
          <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f3f4f6;">
            <div style="flex: 1;">
              <div style="font-weight: 600; font-size: 13px; color: #1f2937;">${itemName}</div>
              ${item.description ? `<div style="font-size: 10px; color: #6b7280; margin-top: 1px;">${item.description}</div>` : ''}
            </div>
            <div style="text-align: right; margin-left:16px; font-weight: 700; font-size: 13px; color: #1f2937;">
              ${formatCurrency(Math.abs(itemAmount))}
            </div>
          </div>
        `;
    }).join('')}

      ${penaltyItems.map(item => {
      const itemAmount = parseFloat(item.amount || 0);
      const percentage = parseFloat(item.tier_percentage || 0);
      const baseAmount = parseFloat(billToUse.service_fee_amount || 0);

      // Calculate days overdue
      const baseDate = billToUse.payment_date ? new Date(billToUse.payment_date) : new Date();
      const daysOverdueActual = calculateDaysOverdue(dueDate, baseDate);
      const isOverdue = daysOverdueActual > 0;

      return `
          <div style="padding: 16px 0; border-bottom: 1px solid #f3f4f6;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div style="flex: 1;">
                <div style="font-weight: 800; font-size: 14px; color: #7f1d1d; margin-bottom: 4px;">Late Payment Penalty (${percentage}%)</div>
                
                ${isOverdue ? `
                  <div style="font-size: 13px; color: #b91c1c; font-weight: 600; margin-bottom: 8px;">
                    Payment is ${daysOverdueActual} ${daysOverdueActual === 1 ? 'day' : 'days'} overdue
                  </div>
                ` : ''}

                ${baseAmount > 0 && percentage > 0 ? `
                  <div style="display: inline-block; background: #fff1f2; border-radius: 4px; padding: 4px 10px;">
                    <span style="font-size: 11px; font-weight: 800; color: #be123c; letter-spacing: -0.01em;">
                      ${formatCurrency(baseAmount)} &times; ${percentage}% = ${formatCurrency(itemAmount)}
                    </span>
                  </div>
                ` : ''}
              </div>
              <div style="text-align: right; margin-left: 16px; font-weight: 800; font-size: 14px; color: #7f1d1d;">
                ${formatCurrency(Math.abs(itemAmount))}
              </div>
            </div>
          </div>
        `;
    }).join('')}

      ${penaltyItems.length > 0 ? `
        <div style="margin-top: 16px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px;">
          <p style="font-size: 11px; color: #92400e; margin: 0; line-height: 1.5; font-weight: 500;">
            <strong style="font-weight: 800;">Note:</strong> Late penalties are automatically calculated based on the number of days past the due date. Pay immediately to avoid additional charges.
          </p>
        </div>
      ` : ''}

      ${waiverHtml}

      ${totalAdvance > 0 ? `
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 13px; color: #2563eb;">Advance Credit</div>
          </div>
          <div style="text-align: right; margin-left:16px; font-weight: 700; font-size: 13px; color: #2563eb;">
            ${formatCurrency(totalAdvance)}
          </div>
        </div>
      ` : ''}
    `;

    // Payment Information
    let paymentDetails = billToUse.payment_details;
    if (typeof paymentDetails === 'string') {
      try { paymentDetails = JSON.parse(paymentDetails); } catch { paymentDetails = []; }
    }
    const hasPayments = Array.isArray(paymentDetails) && paymentDetails.length > 0;
    const isPaidOnly = (billToUse.service_status || billToUse.status || '').toLowerCase() === 'paid';

    let paymentInfoHtml = '';
    if (hasPayments && isPaidOnly) {
      paymentInfoHtml = `
        <div style="margin-top: 25px; background: #f0fdf4; border: 1px solid #dcfce7; border-radius: 16px; padding: 25px;">
          <h3 style="font-size: 16px; font-weight: 800; color: #065f46; margin-bottom: 20px; border-bottom: 1px solid #dcfce7; padding-bottom: 10px; letter-spacing: -0.025em;">Payment Information</h3>
          
          ${paymentDetails.map(payment => `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
              <div>
                <p style="font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin: 0 0 4px 0;">Payment Method</p>
                <p style="font-size: 14px; font-weight: 800; color: #0f766e; margin: 0;">${payment.payment_method || 'N/A'}</p>
              </div>
              <div>
                <p style="font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin: 0 0 4px 0;">Transaction ID</p>
                <p style="font-size: 14px; font-weight: 800; color: #0f766e; font-family: monospace; margin: 0;">${payment.reference_number || payment.transaction_id || 'TXN-' + new Date().getTime()}</p>
              </div>
              <div>
                <p style="font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin: 0 0 4px 0;">Payment Date</p>
                <p style="font-size: 14px; font-weight: 800; color: #1f2937; margin: 0;">${payment.payment_date ? formatDate(payment.payment_date) : 'N/A'}</p>
              </div>
              <div>
                <p style="font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin: 0 0 4px 0;">Amount Paid</p>
                <p style="font-size: 18px; font-weight: 900; color: #0d9488; margin: 0;">${formatCurrency(payment.amount_paid || 0)}</p>
              </div>
            </div>
            
            <div style="padding-top: 15px; border-top: 1px solid #dcfce7; display: flex; align-items: center; gap: 8px; color: #059669;">
              <span style="font-size: 18px; font-weight: 900;">✔</span>
              <span style="font-size: 16px; font-weight: 800; letter-spacing: -0.025em;">Payment Received - Thank You!</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    const netBalance = totalDueAmount - (paidAmount + totalAdvance);
    const balanceLabel = netBalance < 0 ? 'Advance Credit Balance' : 'Total Due';
    const balanceColor = netBalance > 0 ? '#dc2626' : '#059669';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - ${billToUse.bill_number || `BILL-${billToUse.service_period_year}${String(billToUse.service_period_month).padStart(2, '0')}-${billToUse.payment_id}`}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            @page { margin: 0; size: A4; }
            body { 
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              color: #1f2937; margin: 0; padding: 0; background: white; line-height: 1.4;
            }
            .invoice-container { width: 100%; max-width: 1000px; margin: 0 auto; background: white; padding-bottom: 20mm; }
            .header { 
              background: #0d9488; color: white; padding: 20px 30px; 
              display: flex; justify-content: space-between; align-items: flex-start;
              -webkit-print-color-adjust: exact; print-color-adjust: exact;
            }
            .company-info h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em; }
            .company-info p { margin: 2px 0 0; opacity: 0.9; font-size: 13px; }
            .invoice-card { 
              background: white; color: #0d9488; padding: 10px 18px; border-radius: 10px; 
              text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin-bottom: 8px;
            }
            .billing-section { padding: 15px 30px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #f3f4f6; }
            .label-small { font-size: 9px; font-weight: 800; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
            .status-badge { 
              display: inline-block; padding: 4px 12px; border-radius: 12px; font-weight: 700; font-size: 10px; 
              text-transform: uppercase; letter-spacing: 0.05em; text-align: center; line-height: 1; vertical-align: baseline;
            }
            .content-area { padding: 0 30px 10px; }
            .breakdown-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; margin: 15px 0 8px; }
            .summary-section { margin-top: 15px; border-top: 2px solid #e5e7eb; padding-top: 12px; }
            .summary-row { display: flex; justify-content: space-between; padding: 1px 0; font-size: 12px; }
            .total-row { 
              display: flex; justify-content: space-between; align-items: center; 
              margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;
            }
            .footer { margin-top: 15px; padding: 15px 30px; text-align: center; border-top: 1px solid #f3f4f6; font-size: 10px; color: #6b7280; }
            @media print {
              body { background: white; }
              .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .status-badge { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="header">
              <div>
                <h1>Estate Link</h1>
                <p>Property Management Services</p>
                <div style="margin-top: 12px; font-size: 11px; opacity: 0.9; line-height: 1.5;">
                  123 Property Lane, Dhaka 1212, Bangladesh<br>
                  Phone: +880 1234-567890 | Email: billing@estatelink.com
                </div>
              </div>
              <div style="display: flex; flex-direction: column; align-items: flex-end;">
                <div class="invoice-card">
                  <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; opacity: 0.7;">Invoice</div>
                  <div style="font-size: 16px; font-weight: 800;">${billToUse.bill_number || billToUse.billNumber || `BILL-${billToUse.service_period_year}${String(billToUse.service_period_month).padStart(2, '0')}-${billToUse.payment_id}`}</div>
                </div>
                <div style="text-align: right; font-size: 11px; opacity: 0.9;">
                  Invoice Date: ${formatDate(invoiceDate)}<br>
                  Due Date: ${formatDate(dueDate)}
                </div>
              </div>
            </div>

            <div class="billing-section">
              <div>
                <div class="label-small">BILL TO</div>
                <div style="font-size: 15px; font-weight: 700; color: #111827;">
                  ${billToUse.resident || billToUse.primary_name || 'N/A'}
                  <span style="font-size: 10px; font-weight: normal; color: #6b7280; margin-left: 5px; text-transform: uppercase; letter-spacing: 0.05em;">
                    ${billToUse.account_holder_type === 'owner' ? 'Owner' : 'Resident'}
                  </span>
                </div>
                <div style="font-size: 13px; color: #374151; margin-top: 2px;">${billToUse.unit || billToUse.unit_display || 'N/A'}</div>
                <div style="font-size: 12px; color: #6b7280; margin-top: 1px;">${billToUse.email || billToUse.primary_email || 'N/A'}</div>
              </div>
              <div style="text-align: right;">
                <div class="label-small">Billing Period</div>
                <div style="font-size: 16px; font-weight: 700; color: #111827;">${period}</div>
                <div style="margin-top: 6px; text-align: right;">
                  <span style="display: inline-block; padding: 5px 14px; border-radius: 12px; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1; background: ${statusConfig.bgColor.replace('bg-', '') === 'emerald-100' ? '#dcfce7' : statusConfig.bgColor.replace('bg-', '') === 'blue-100' ? '#dbeafe' : statusConfig.bgColor.replace('bg-', '') === 'yellow-100' ? '#fef9c3' : '#fee2e2'}; color: ${statusConfig.textColor.replace('text-', '') === 'emerald-700' ? '#047857' : statusConfig.textColor.replace('text-', '') === 'blue-700' ? '#1d4ed8' : statusConfig.textColor.replace('text-', '') === 'yellow-700' ? '#a16207' : '#b91c1c'};">${statusConfig.text}</span>
                </div>
              </div>
            </div>

            <div class="content-area">
              <div class="breakdown-title">
                Service Fee Breakdown
              </div>
              <div style="border-top: 1px solid #f3f4f6;">
                ${breakdownHtml}
              </div>

              <div class="summary-section">
                ${(() => {
        const baseServiceFee = parseFloat(billToUse.base_service_amount || billToUse.service_fee_amount || billToUse.original_amount || 0);
        const penaltyAmount = parseFloat(billToUse.penalty_amount || 0);
        const billCategoryItems = feeItems.filter(item => (item.item_type || '').toLowerCase() === 'bill_category');
        const additionalCharges = billCategoryItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
        const subtotal = baseServiceFee + additionalCharges;
        const totalDueBeforePayments = subtotal + penaltyAmount;

        return `
                    <div class="summary-row" style="font-weight: 600;">
                      <span style="color: #6b7280; font-weight: 400;">Base Service Fee</span>
                      <span style="color: #111827;">${formatCurrency(baseServiceFee)}</span>
                    </div>
                    <div class="summary-row" style="font-weight: 600;">
                      <span style="color: #6b7280; font-weight: 400;">Additional Charges</span>
                      <span style="color: #111827;">${formatCurrency(additionalCharges)}</span>
                    </div>
                    ${penaltyAmount > 0 ? `
                    <div class="summary-row" style="border-top: 1px solid #f3f4f6; margin-top: 4px; padding-top: 4px;">
                      <span style="color: #dc2626;">Late Penalties</span>
                      <span style="color: #dc2626; font-weight: 800;">+${formatCurrency(penaltyAmount)}</span>
                    </div>
                    ` : ''}
                    <div class="summary-row" style="background: #f0fdfa; margin: 8px -10px; padding: 12px 20px; border-radius: 12px; border: 1px solid #ccfbf1; font-weight: 800; display: flex; align-items: center; justify-content: space-between;">
                      <span style="color: #134e4a; font-size: 15px; letter-spacing: -0.01em;">Total Amount Due</span>
                      <span style="color: #0d9488; font-size: 20px;">${formatCurrency(totalDueBeforePayments)}</span>
                    </div>
                  `;
      })()}
      </div>

              ${paymentInfoHtml}

              ${(billToUse.service_status || '').toLowerCase() !== 'paid' ? `
                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-family: 'Inter', sans-serif;">
                  <h3 style="font-size: 16px; font-weight: 700; color: #1f2937; margin-bottom: 12px;">Payment Instructions</h3>
                  
                  <div style="display: flex; flex-direction: column; gap: 12px;">
                    <div style="padding-bottom: 12px; border-bottom: 1px solid #f3f4f6;">
                      <div style="font-size: 14px; font-weight: 700; color: #1f2937; margin-bottom: 10px;">Bank Transfer</div>
                      <div style="font-size: 13px; color: #4b5563; line-height: 1.6; font-weight: 400;">
                        <div style="margin-bottom: 4px;">Account Name: Estate Link Management</div>
                        <div style="margin-bottom: 4px;">Account Number: 1234567890</div>
                        <div style="margin-bottom: 8px;">Bank: ABC Bank Ltd.</div>
                        <div style="color: #9ca3af; font-size: 12px; margin-top: 8px;">
                          Please include invoice #${billToUse.billNumber || 'BILL'} as reference
                        </div>
                      </div>
                    </div>

                    <div style="padding-bottom: 12px; border-bottom: 1px solid #f3f4f6;">
                      <div style="font-size: 14px; font-weight: 700; color: #1f2937; margin-bottom: 10px;">Mobile Financial Service (MFS)</div>
                      <div style="font-size: 13px; color: #4b5563; font-weight: 400;">
                        <div style="margin-bottom: 8px;">bKash/Nagad/Rocket: 01712-345678</div>
                        <div style="color: #9ca3af; font-size: 12px;">
                          Send payment and share transaction ID via email
                        </div>
                      </div>
                    </div>

                    <div>
                      <div style="font-size: 14px; font-weight: 700; color: #1f2937; margin-bottom: 10px;">Cash Payment</div>
                      <div style="font-size: 13px; color: #4b5563; font-weight: 400;">
                        <div>Visit the management office during business hours</div>
                        <div style="color: #9ca3af; margin-top: 4px;">Mon-Fri: 9:00 AM - 5:00 PM</div>
                      </div>
                    </div>
                  </div>
                </div>
              ` : ''}
            </div>

            <div class="footer">
              <p style="margin-bottom: 6px;">Questions about this invoice? Contact us at <strong>billing@estatelink.com</strong> or call <strong>+880 1234-567890</strong></p>
              <p style="margin-bottom: 2px;">This is a computer-generated invoice. No signature required.</p>
              <p style="font-weight: 800; color: #374151;">Estate Link Property Management | Tax ID: 123456789 | Registration No: ABC-12345</p>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  // Handle print functionality
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      alert('Pop-up blocked! Please allow pop-ups to print the invoice.');
      return;
    }

    const html = getInvoiceHtml();

    // Add print script
    const printScript = `
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 500);
        };
        window.onafterprint = function() {
          window.close();
        };
      </script>
    `;

    printWindow.document.open();
    printWindow.document.write(html.replace('</body>', `${printScript}</body>`));
    printWindow.document.close();
  };

  // Handle PDF download functionality
  const handleDownloadPDF = () => {
    const element = document.createElement('div');
    element.innerHTML = getInvoiceHtml();

    const opt = {
      margin: 0,
      filename: `Bill-${billToUse.billNumber || `${billToUse.service_period_year}${String(billToUse.service_period_month).padStart(2, '0')}-${billToUse.payment_id}`}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, windowWidth: 1000 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // New Promise-based usage:
    html2pdf().from(element).set(opt).save();
  };


  const getStatusConfig = (status) => {
    const statusLower = (status || '').toLowerCase();

    switch (statusLower) {
      case 'paid':
        return {
          icon: IoCheckmarkCircle,
          text: 'PAID',
          bgColor: 'bg-emerald-100',
          textColor: 'text-emerald-700',
          iconColor: 'text-emerald-700',
          badgeColor: 'bg-emerald-100 text-emerald-700'
        };
      case 'partial':
        return {
          icon: IoCheckmarkCircle,
          text: 'PARTIAL',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-700',
          iconColor: 'text-blue-700',
          badgeColor: 'bg-blue-100 text-blue-700'
        };
      case 'due':
        return {
          icon: IoTimeOutline,
          text: 'DUE',
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-700',
          iconColor: 'text-yellow-700',
          badgeColor: 'bg-yellow-100 text-yellow-700'
        };
      case 'overdue':
        return {
          icon: FaExclamationCircle,
          text: 'OVERDUE',
          bgColor: 'bg-red-100',
          textColor: 'text-red-700',
          iconColor: 'text-red-700',
          badgeColor: 'bg-red-100 text-red-700'
        };
      default:
        return {
          icon: FaClock,
          text: (status || 'PENDING').toUpperCase(),
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-700',
          iconColor: 'text-gray-700',
          badgeColor: 'bg-gray-100 text-gray-700'
        };
    }
  };

  const statusConfig = getStatusConfig(billToUse.service_status || billToUse.status || bill.status);
  const StatusIcon = statusConfig.icon;

  // Calculate dates
  const invoiceDate = billToUse.invoiceDate || billToUse.createdAt || billToUse.created_at || new Date().toISOString();
  const dueDate = billToUse.dueDate || billToUse.due_date || (() => {
    const date = new Date(invoiceDate);
    date.setDate(date.getDate() + 14); // Default 14 days
    return date.toISOString();
  })();

  // Parse bill_category_details from serviceFees or API response
  const parseBillCategories = () => {
    console.log('parseBillCategories - billToUse.service_fee_items:', billToUse.service_fee_items);
    console.log('parseBillCategories - typeof:', typeof billToUse.service_fee_items);

    // PRIORITY 1: Try to get from service_fee_items (new structure with item_type)
    if (billToUse.service_fee_items) {
      try {
        let items = [];
        if (typeof billToUse.service_fee_items === 'string') {
          items = JSON.parse(billToUse.service_fee_items);
        } else if (Array.isArray(billToUse.service_fee_items)) {
          items = billToUse.service_fee_items;
        }

        if (!Array.isArray(items)) items = [];

        // Parse bill_category_details for enrichment
        let billDetails = [];
        if (billToUse.bill_category_details) {
          try {
            billDetails = typeof billToUse.bill_category_details === 'string'
              ? JSON.parse(billToUse.bill_category_details)
              : billToUse.bill_category_details;
            if (!Array.isArray(billDetails)) billDetails = [];
          } catch (e) {
            console.error('Error parsing bill_category_details for enrichment:', e);
          }
        }

        // Parse bill_upload_data for fallback enrichment
        let uploadData = [];
        if (billToUse.bill_upload_data) {
          try {
            uploadData = typeof billToUse.bill_upload_data === 'string'
              ? JSON.parse(billToUse.bill_upload_data)
              : billToUse.bill_upload_data;
            if (!Array.isArray(uploadData)) uploadData = [];
            console.log('Parsed bill_upload_data:', uploadData);
          } catch (e) {
            console.error('Error parsing bill_upload_data:', e);
          }
        }

        // Map items to ensure consistent field names and enrich with usage
        const mappedItems = items.map(item => {
          let description = item.description || '';
          const itemType = (item.item_type || '').toLowerCase();

          // Enrichment for Penalty items
          if (itemType === 'penalty') {
            const percentage = parseFloat(item.tier_percentage || 0);
            const tierName = item.tier_name || '';
            const daysOverdue = item.tier_days_overdue;

            if (percentage > 0) {
              description = `${percentage}% late penalty ${daysOverdue ? `after ${daysOverdue} days` : ''}`;
            }
          }
          // Enrichment for Bill Category items (Readings/Usage)
          else if (itemType === 'bill_category') {
            // Try to get consumption info from item itself (new structure with JOIN)
            const usage = parseFloat(item.consumption || 0);
            const rate = parseFloat(item.price_per_unit || 0);
            const prev = parseFloat(item.previous_reading || 0);
            const curr = parseFloat(item.current_reading || 0);

            // Only show reading info if there's actual usage or readings (avoid noise for fixed charges)
            if (usage > 0 || rate > 0 || curr > 0 || prev > 0) {
              const uom = item.unit_of_measurement || 'units';
              description = `(Reading: ${curr} - ${prev}) (${usage} ${uom} × ${formatCurrency(rate)})`;
            } else {
              // Stay with original description for fixed charges
              description = item.description || '';
            }
          }

          return {
            ...item,
            item_name: item.item_name || item.bill_category_name || (itemType === 'penalty' ? 'Late Payment Penalty' : 'Service Fee'),
            description: description
          };
        });
        console.log('parseBillCategories - returning mapped items:', mappedItems);
        return mappedItems;
      } catch (e) {
        console.error('Error parsing service_fee_items:', e);
        console.error('service_fee_items value:', billToUse.service_fee_items);
      }
    }

    // PRIORITY 2: Fallback to serviceFees (transformed data)
    if (billToUse.serviceFees && Array.isArray(billToUse.serviceFees)) {
      const items = [];
      billToUse.serviceFees.forEach(category => {
        if (category.items && Array.isArray(category.items)) {
          category.items.forEach(item => {
            items.push(item);
          });
        }
      });
      console.log('parseBillCategories - returning from serviceFees:', items);
      return items;
    }

    // PRIORITY 3: Fallback to bill_category_details
    if (!billToUse.bill_category_details) {
      console.log('parseBillCategories - no bill_category_details, returning empty');
      return [];
    }
    try {
      const parsed = typeof billToUse.bill_category_details === 'string'
        ? JSON.parse(billToUse.bill_category_details)
        : billToUse.bill_category_details;
      console.log('parseBillCategories - returning from bill_category_details:', parsed);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Error parsing bill_category_details:', e);
      return [];
    }
  };

  const feeItems = parseBillCategories();
  console.log('BillDetailView - feeItems:', feeItems);
  console.log('BillDetailView - billToUse:', billToUse);

  // Calculate total from service_fee_items: (base_fee + bill_items + penalty) - waiver
  // Do NOT subtract paid amounts - show the bill total before payment
  const calculateTotal = () => {
    let total = 0;
    feeItems.forEach(item => {
      const itemType = (item.item_type || '').toLowerCase();
      const amount = parseFloat(item.amount || 0);
      // Add base_fee, bill_category, and penalty
      if (itemType === 'base_fee' || itemType === 'bill_category' || itemType === 'penalty') {
        total += amount;
      }
    });
    // Subtract waiver
    const waiverAmount = parseFloat(billToUse.waived_amount || billToUse.waiverAmount || 0);
    total -= waiverAmount;
    return Math.max(0, total);
  };

  const paidAmount = parseFloat(billToUse.amountPaid || billToUse.paid_amount || 0);
  const totalDueAmount = calculateTotal();
  const hideOverdueMessage = true; // Hide overdue payment message
  console.log('BillDetailView stats:', { totalDueAmount, paidAmount });

  return (
    <div className="w-full">
      {/* Back Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
        >
          <FaArrowLeft className="w-4 h-4" />
          <span className="font-medium">Back to Bills List</span>
        </button>
        {/* <div className="text-lg font-semibold text-gray-900">
          {billToUse.billNumber || `BILL-${billToUse.service_period_year}${String(billToUse.service_period_month).padStart(2, '0')}-${billToUse.payment_id}`}
        </div> */}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 mb-6">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <FaPrint className="w-4 h-4" />
          Print Invoice
        </button>
        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <FaDownload className="w-4 h-4" />
          Download PDF
        </button>
      </div>

      {/* Invoice Container */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header Section with Teal Background */}
        <div className="bg-teal-600 text-white p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: Company Information */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <FaBuilding className="w-8 h-8" />
                <div>
                  <h2 className="text-2xl font-bold">Estate Link</h2>
                  <p className="text-teal-100">Property Management Services</p>
                </div>
              </div>
              <div className="space-y-1 text-teal-50 text-sm">
                <p>123 Property Lane, Dhaka 1212, Bangladesh</p>
                <p>Phone: +880 1234-567890</p>
                <p>Email: billing@estatelink.com</p>
              </div>
            </div>

            {/* Right: Invoice Details */}
            <div className="flex flex-col items-end">
              {/* Invoice Number Card - White Background */}
              <div className="bg-white text-teal-700 rounded-2xl p-4 mb-4">
                <h3 className="text-sm font-semibold uppercase mb-2 text-right">Invoice</h3>
                <p className="text-lg font-bold text-center">{billToUse.bill_number || billToUse.billNumber || `BILL-${billToUse.service_period_year}${String(billToUse.service_period_month).padStart(2, '0')}-${billToUse.payment_id}`}</p>
              </div>
              {/* Date Information - On Teal Background */}
              <div className="space-y-1 text-white text-sm">
                <div>
                  <span>Invoice Date: {formatDate(invoiceDate)}</span>
                </div>
                <div>
                  <span>Due Date: {formatDate(dueDate)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Billing Information Section */}
        <div className="p-8 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Bill To */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">BILL TO</h3>
              <div className="space-y-1 text-gray-900">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-lg">{billToUse.resident || billToUse.primary_name || 'N/A'}</p>
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {billToUse.account_holder_type === 'owner' ? 'Owner' : 'Resident'}
                  </span>
                </div>
                <p>{billToUse.unit || billToUse.unit_display || 'N/A'}</p>
                <p>{billToUse.email || billToUse.primary_email || 'N/A'}</p>
              </div>
            </div>

            {/* Billing Period & Status */}
            <div className="flex flex-col items-end">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Billing Period</h3>
                <p className="text-lg font-semibold text-gray-900">{billToUse.period || billToUse.month_name || `Month ${billToUse.service_period_month}, ${billToUse.service_period_year}`}</p>
              </div>
              <button
                className={`flex items-center gap-2 px-6 py-3 rounded-lg ${statusConfig.bgColor} ${statusConfig.textColor} font-semibold`}
              >
                <StatusIcon className={`w-5 h-5 ${statusConfig.iconColor}`} />
                {statusConfig.text}
              </button>
            </div>


          </div>

          {/* Service Fee Breakdown */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <FaFileInvoice className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Service Fee Breakdown</h3>
            </div>

            <div className="space-y-2">
              {(() => {
                console.log('Rendering breakdown - feeItems:', feeItems);
                // Parse service_fee_items to separate base items, penalties, and waivers
                // Use item_type field for accurate filtering
                const baseAndBillItems = feeItems.filter(item => {
                  const itemType = (item.item_type || '').toLowerCase();
                  const matches = itemType === 'base_fee' || itemType === 'bill_category';
                  console.log('Filtering item:', item, 'itemType:', itemType, 'matches base/bill:', matches);
                  return matches;
                });
                const penaltyItems = feeItems.filter(item => {
                  const itemType = (item.item_type || '').toLowerCase();
                  return itemType === 'penalty';
                });
                // Get waiver amount from billToUse directly (not from service_fee_items)
                const totalWaived = parseFloat(billToUse.waived_amount || billToUse.waiverAmount || 0);

                console.log('Filtered results - base:', baseAndBillItems, 'penalty:', penaltyItems, 'totalWaived:', totalWaived);

                return (
                  <>
                    {/* Base and Bill Items */}
                    {baseAndBillItems.length > 0 ? (
                      baseAndBillItems.map((item, index) => {
                        const itemAmount = parseFloat(item.amount || 0);
                        // Clean up item name - remove "for Month Year" and extra details
                        let itemName = item.item_name || item.bill_category_name || 'Service Fee';
                        // If it's base_fee, just show "Service Fee"
                        if (item.item_type === 'base_fee') {
                          itemName = 'Service Fee';
                        }

                        return (
                          <div key={index} className="flex justify-between items-start py-2 border-b border-gray-100">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">
                                {itemName}
                              </p>
                              {item.description && (
                                <p className="text-sm text-gray-500 mt-1">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              <p className="font-semibold text-gray-900">
                                {formatCurrency(Math.abs(itemAmount))}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-2 text-gray-500 italic">No service fee items available</div>
                    )}

                    {/* Penalties */}
                    {penaltyItems && penaltyItems.length > 0 ? (
                      <>
                        {penaltyItems.map((item, index) => {
                          const itemAmount = parseFloat(item.amount || 0);
                          const percentage = parseFloat(item.tier_percentage || 0);

                          return (
                            <div key={index} className="flex justify-between items-start py-4 border-b border-gray-100">
                              <div className="flex-1 space-y-2">
                                <h4 className="font-bold text-[#7f1d1d] text-lg">
                                  Late Payment Penalty ({percentage}%)
                                </h4>

                                {(() => {
                                  // For penalties, we use the payment date if already paid, otherwise today
                                  const baseDate = billToUse.payment_date || new Date();
                                  const overdueDays = calculateDaysOverdue(dueDate, baseDate);

                                  return overdueDays > 0 ? (
                                    <p className="text-[#b91c1c] font-medium text-base">
                                      Payment is {overdueDays} {overdueDays === 1 ? 'day' : 'days'} overdue
                                    </p>
                                  ) : null;
                                })()}


                                {parseFloat(billToUse.service_fee_amount || 0) > 0 && percentage > 0 && (
                                  <div className="inline-block bg-[#fff1f2] rounded px-3 py-1 mt-1">
                                    <span className="text-sm font-bold text-[#be123c] tracking-tight">
                                      {formatCurrency(parseFloat(billToUse.service_fee_amount))} &times; {percentage}% = {formatCurrency(itemAmount)}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="text-right ml-4">
                                <p className="font-bold text-[#7f1d1d] text-lg">
                                  {formatCurrency(Math.abs(itemAmount))}
                                </p>
                              </div>
                            </div>
                          );
                        })}

                        <div className="mt-4 bg-[#fffbeb] border border-amber-100 rounded-lg p-4">
                          <p className="text-sm text-amber-900 leading-relaxed font-medium">
                            <span className="font-bold">Note:</span> Late penalties are automatically calculated based on the number of days past the due date. Pay immediately to avoid additional charges.
                          </p>
                        </div>
                      </>
                    ) : null}


                    {/* Waivers completely removed per request */}
                  </>
                );
              })()}
            </div>

            {/* Total Summary */}
            <div className="mt-6 pt-6 border-t-2 border-gray-300 space-y-3">
              {(() => {
                // Calculate base service fee and additional charges separately
                const baseServiceFee = parseFloat(billToUse.base_service_amount || billToUse.service_fee_amount || billToUse.original_amount || 0);
                const penaltyAmount = parseFloat(billToUse.penalty_amount || 0);

                // Calculate additional charges (all bill category items)
                const billCategoryItems = feeItems.filter(item =>
                  (item.item_type || '').toLowerCase() === 'bill_category'
                );
                const additionalCharges = billCategoryItems.reduce((sum, item) =>
                  sum + parseFloat(item.amount || 0), 0
                );

                const subtotal = baseServiceFee + additionalCharges;
                const totalDueBeforePayments = subtotal + penaltyAmount;

                return (
                  <>
                    {/* Subtotal (Sum of Base Fee + Additional Charges) */}
                    <div className="flex justify-between items-center text-gray-600">
                      <span className="text-base">Base Service Fee</span>
                      <span className="text-base text-gray-900 font-semibold">{formatCurrency(baseServiceFee)}</span>
                    </div>

                    <div className="flex justify-between items-center text-gray-600">
                      <span className="text-base">Additional Charges</span>
                      <span className="text-base text-gray-900 font-semibold">{formatCurrency(additionalCharges)}</span>
                    </div>

                    {/* Late Penalties */}
                    {penaltyAmount > 0 && (
                      <div className="flex justify-between items-center border-t border-gray-100 pt-3">
                        <span className="text-sm text-red-600 font-bold tracking-tight">Late Penalties</span>
                        <span className="text-base text-red-600 font-black">+{formatCurrency(penaltyAmount)}</span>
                      </div>
                    )}

                    {/* Total Amount Due (before payments) */}
                    <div className="bg-[#f0fdfa] rounded-2xl p-6 flex justify-between items-center border border-teal-100 mt-6 -mx-4">
                      <span className="text-lg font-bold text-teal-900 tracking-tighter">Total Amount Due</span>
                      <span className="text-2xl font-black text-teal-600 tabular-nums">{formatCurrency(totalDueBeforePayments)}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Payment Information - Show only for partial or paid status */}
          {(() => {
            // Parse payment_details if it's a string
            let paymentDetails = billToUse.payment_details;
            if (typeof paymentDetails === 'string') {
              try {
                paymentDetails = JSON.parse(paymentDetails);
              } catch (e) {
                console.error('Error parsing payment_details:', e);
                paymentDetails = [];
              }
            }

            const hasPayments = Array.isArray(paymentDetails) && paymentDetails.length > 0;
            const isPaidOnly = (billToUse.service_status || billToUse.status || '').toLowerCase() === 'paid';

            if (!hasPayments || !isPaidOnly) {
              return null;
            }

            return (
              <div className="mt-8 pt-8 border-t border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6 font-primary text-teal-800">Payment Information</h3>

                <div className="bg-emerald-50/50 rounded-2xl p-8 border border-emerald-100">
                  {paymentDetails.map((payment, idx) => {
                    return (
                      <div key={idx} className="space-y-8">
                        {/* 2-Column Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Payment Method</p>
                            <p className="text-lg font-bold text-teal-700">{payment.payment_method || 'N/A'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Transaction ID</p>
                            <p className="text-lg font-bold text-teal-700 font-mono tracking-tight">{payment.reference_number || payment.transaction_id || `TXN-${new Date().getTime()}`}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Payment Date</p>
                            <p className="text-lg font-bold text-gray-800">{payment.payment_date ? formatDate(payment.payment_date) : 'N/A'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Amount Paid</p>
                            <p className="text-2xl font-black text-teal-600">{formatCurrency(payment.amount_paid || 0)}</p>
                          </div>
                        </div>

                        {/* Success Banner */}
                        <div className="pt-6 border-t border-emerald-100">
                          <div className="flex items-center gap-3 text-emerald-600">
                            <FaCheckCircle className="w-6 h-6 animate-pulse" />
                            <p className="text-xl font-bold tracking-tight">Payment Received - Thank You!</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}




          {/* Payment Instructions Section */}
          {(billToUse.service_status || '').toLowerCase() !== 'paid' && (
            <div className="mt-12 border-t border-gray-100 pt-10">
              <h3 className="text-lg font-bold text-gray-800 mb-8 font-primary">Payment Instructions</h3>

              <div className="space-y-10">
                {/* Bank Transfer */}
                <div className="space-y-4">
                  <h4 className="text-base font-bold text-gray-800 tracking-tight">Bank Transfer</h4>
                  <div className="space-y-1 text-sm text-gray-600 font-normal">
                    <p>Account Name: Estate Link Management</p>
                    <p>Account Number: 1234567890</p>
                    <p>Bank: ABC Bank Ltd.</p>
                    <p className="text-gray-400 mt-2 text-xs">
                      Please include invoice #{billToUse.billNumber || 'BILL'} as reference
                    </p>
                  </div>
                  <div className="border-b border-gray-50 pt-2"></div>
                </div>

                {/* MFS Accounts */}
                <div className="space-y-4">
                  <h4 className="text-base font-bold text-gray-800 tracking-tight">Mobile Financial Service (MFS)</h4>
                  <div className="space-y-1 text-sm text-gray-600 font-normal">
                    <p>bKash/Nagad/Rocket: 01712-345678</p>
                    <p className="text-gray-400 text-xs">
                      Send payment and share transaction ID via email
                    </p>
                  </div>
                  <div className="border-b border-gray-50 pt-2"></div>
                </div>

                {/* Cash Payment */}
                <div className="space-y-3">
                  <h4 className="text-base font-bold text-gray-800 tracking-tight">Cash Payment</h4>
                  <div className="space-y-1 text-sm text-gray-600 font-normal">
                    <p>Visit the management office during business hours</p>
                    <p className="text-gray-400 text-xs">Mon-Fri: 9:00 AM - 5:00 PM</p>
                  </div>
                  <div className="border-b border-gray-50 pt-1"></div>
                </div>
              </div>
            </div>
          )}

          {/* Payment Pending Status - Show for due status */}
          {(billToUse.status === 'PENDING' || billToUse.status === 'due' || billToUse.service_status === 'PENDING' || billToUse.service_status === 'due') && (
            <div className="mt-8 bg-yellow-50 rounded-lg p-6 border border-yellow-200">
              <div className="flex items-center gap-2 text-yellow-800">
                <IoTimeOutline className="w-5 h-5" />
                <p className="font-semibold">Payment Pending - Due Date: {formatDate(dueDate)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Section */}
        <div className="bg-gray-100 p-6 border-t border-gray-200">
          <div className="text-center space-y-2 text-sm text-gray-600">
            <p>
              Questions about this invoice? Contact us at{' '}
              <a href="mailto:billing@estatelink.com" className="text-teal-600 hover:text-teal-700 underline">
                billing@estatelink.com
              </a>
              {' '}or call +880 1234-567890
            </p>
            <p>This is a computer-generated invoice. No signature required.</p>
            <p className="font-medium">
              Estate Link Property Management | Tax ID: 123456789 | Registration No: ABC-12345
            </p>
          </div>
        </div>
      </div >

      {/* Print Preview Modal */}
      {
        showPrintPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2">
            <div className="bg-white rounded-lg shadow-2xl w-[95vw] h-[95vh] flex flex-col">
              {/* Header - Fixed */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0 bg-white">
                <h2 className="text-lg font-bold text-gray-900">Print Preview - {billToUse.billNumber || `BILL-${billToUse.service_period_year}${String(billToUse.service_period_month).padStart(2, '0')}-${billToUse.payment_id}`}</h2>
                <button
                  onClick={() => setShowPrintPreview(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  <FaTimes className="w-6 h-6" />
                </button>
              </div>
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto">
                {/* Copy exact design from main bill detail */}
                <div className="bg-white">
                  {/* Header Section with Teal Background */}
                  <div className="bg-teal-600 text-white px-8 py-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left: Company Information */}
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <FaBuilding className="w-8 h-8" />
                          <div>
                            <h2 className="text-xl font-bold">Estate Link</h2>
                            <p className="text-teal-100 text-sm">Property Management Services</p>
                          </div>
                        </div>
                        <div className="space-y-0.5 text-teal-50 text-xs">
                          <p>123 Property Lane, Dhaka 1212, Bangladesh</p>
                          <p>Phone: +880 1234-567890</p>
                          <p>Email: billing@estatelink.com</p>
                        </div>
                      </div>

                      {/* Right: Invoice Details */}
                      <div className="flex flex-col items-end">
                        {/* Invoice Number Card - White Background */}
                        <div className="bg-white text-teal-700 rounded-xl p-3 mb-3 min-w-[150px]">
                          <h3 className="text-[10px] font-semibold uppercase mb-1 text-center opacity-70">Invoice</h3>
                          <p className="text-base font-bold text-center">{billToUse.billNumber || `BILL-${billToUse.service_period_year}${String(billToUse.service_period_month).padStart(2, '0')}-${billToUse.payment_id}`}</p>
                        </div>
                        {/* Date Information - On Teal Background */}
                        <div className="space-y-0.5 text-white text-xs text-right">
                          <p>Invoice Date: {formatDate(invoiceDate)}</p>
                          <p>Due Date: {formatDate(dueDate)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Billing Information Section */}
                  <div className="px-8 py-5 bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      {/* Bill To */}
                      <div>
                        <h3 className="text-[10px] font-semibold text-gray-500 uppercase mb-2">{billToUse.account_holder_type === 'owner' ? 'Owner' : 'Resident'}</h3>
                        <div className="space-y-0.5 text-gray-900">
                          <p className="font-semibold text-base">{billToUse.resident || billToUse.primary_name || 'N/A'}</p>
                          <p className="text-sm">{billToUse.unit || billToUse.unit_display || 'N/A'}</p>
                          <p className="text-xs text-gray-500">{billToUse.email || billToUse.primary_email || 'N/A'}</p>
                        </div>
                      </div>

                      {/* Billing Period & Status */}
                      <div className="flex flex-col items-end">
                        <div className="mb-3 text-right">
                          <h3 className="text-[10px] font-semibold text-gray-500 uppercase mb-2">Billing Period</h3>
                          <p className="text-base font-semibold text-gray-900">{billToUse.period || billToUse.month_name || `Month ${billToUse.service_period_month}, ${billToUse.service_period_year}`}</p>
                        </div>
                        <button
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${statusConfig.bgColor} ${statusConfig.textColor} font-semibold text-sm`}
                        >
                          <StatusIcon className={`w-4 h-4 ${statusConfig.iconColor}`} />
                          {statusConfig.text}
                        </button>
                      </div>


                    </div>

                    {/* Service Fee Breakdown */}
                    <div className="border-t border-gray-200 pt-5">
                      <div className="flex items-center gap-2 mb-3">
                        <FaFileInvoice className="w-5 h-5 text-gray-600" />
                        <h3 className="text-base font-semibold text-gray-900">Service Fee Breakdown</h3>
                      </div>

                      <div className="space-y-1.5">
                        {(() => {
                          const baseAndBillItems = feeItems.filter(item => {
                            const itemType = (item.item_type || '').toLowerCase();
                            return itemType === 'base_fee' || itemType === 'bill_category';
                          });
                          const penaltyItems = feeItems.filter(item => {
                            const itemType = (item.item_type || '').toLowerCase();
                            return itemType === 'penalty';
                          });

                          return (
                            <>
                              {/* Base and Bill Items */}
                              {baseAndBillItems.length > 0 ? (
                                baseAndBillItems.map((item, index) => {
                                  const itemAmount = parseFloat(item.amount || 0);
                                  let itemName = item.item_name || item.bill_category_name || 'Service Fee';
                                  if (item.item_type === 'base_fee') {
                                    itemName = 'Service Fee';
                                  }

                                  return (
                                    <div key={index} className="flex justify-between items-start py-1.5 border-b border-gray-50">
                                      <div className="flex-1">
                                        <p className="font-medium text-gray-900 text-sm">
                                          {itemName}
                                        </p>
                                        {item.description && (
                                          <p className="text-[10px] text-gray-500 mt-0.5">
                                            {item.description}
                                          </p>
                                        )}
                                      </div>
                                      <div className="text-right ml-4">
                                        <p className="font-semibold text-gray-900 text-sm">
                                          {formatCurrency(Math.abs(itemAmount))}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="py-2 text-gray-500 italic text-sm">No service fee items available</div>
                              )}

                              {/* Penalties */}
                              {penaltyItems.length > 0 ? (
                                <>
                                  {penaltyItems.map((item, index) => {
                                    const itemAmount = parseFloat(item.amount || 0);
                                    const percentage = parseFloat(item.tier_percentage || 0);

                                    // Calculate days overdue
                                    const baseDate = billToUse.payment_date ? new Date(billToUse.payment_date) : new Date();
                                    const daysOverdueActual = calculateDaysOverdue(dueDate, baseDate);
                                    const isOverdue = daysOverdueActual > 0;

                                    return (
                                      <div key={index} className="flex justify-between items-start py-4 border-b border-gray-100">
                                        <div className="flex-1 space-y-2">
                                          <h4 className="font-bold text-[#7f1d1d] text-base">
                                            Late Payment Penalty ({percentage}%)
                                          </h4>

                                          {isOverdue && (
                                            <p className="text-[#b91c1c] font-semibold text-sm">
                                              Payment is {daysOverdueActual} {daysOverdueActual === 1 ? 'day' : 'days'} overdue
                                            </p>
                                          )}

                                          {parseFloat(billToUse.service_fee_amount || 0) > 0 && percentage > 0 && (
                                            <div className="inline-block bg-[#fff1f2] rounded px-2 py-1 mt-1">
                                              <span className="text-[11px] font-bold text-[#be123c] tracking-tight">
                                                {formatCurrency(parseFloat(billToUse.service_fee_amount))} &times; {percentage}% = {formatCurrency(itemAmount)}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                        <div className="text-right ml-4">
                                          <p className="font-bold text-[#7f1d1d] text-base">
                                            {formatCurrency(Math.abs(itemAmount))}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}

                                  <div className="mt-4 bg-[#fffbeb] border border-amber-100 rounded-lg p-3">
                                    <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
                                      <span className="font-bold">Note:</span> Late penalties are automatically calculated based on the number of days past the due date. Pay immediately to avoid additional charges.
                                    </p>
                                  </div>
                                </>
                              ) : null}

                              {/* No Waivers Rendered for Print */}
                            </>
                          );
                        })()}
                      </div>

                      {/* Total Summary Section - Now cleanly separated */}
                      {/* Detailed Summary for Print */}
                      <div className="mt-8 pt-6 border-t-2 border-gray-300 space-y-3 px-2">
                        <div className="flex justify-between items-center text-sm text-gray-600">
                          <span>Base Service Fee</span>
                          <span className="font-bold text-gray-900">{formatCurrency(baseServiceFee)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm text-gray-600">
                          <span>Additional Charges</span>
                          <span className="font-bold text-gray-900">{formatCurrency(additionalCharges)}</span>
                        </div>

                        {penaltyAmount > 0 && (
                          <div className="flex justify-between items-center text-sm text-red-600 border-t border-gray-100 pt-3">
                            <span className="text-xs font-bold tracking-tighter">Late Penalties</span>
                            <span className="font-black">+{formatCurrency(penaltyAmount)}</span>
                          </div>
                        )}

                        <div className="bg-[#f0fdfa] rounded-xl p-5 flex justify-between items-center border border-teal-100 mt-4">
                          <span className="text-base font-bold text-teal-900 tracking-tighter">Total Amount Due</span>
                          <span className="text-2xl font-black text-teal-600 tabular-nums">{formatCurrency(totalDueBeforePayments)}</span>
                        </div>
                      </div>


                      {/* Payment Information */}
                      {
                        (() => {
                          let paymentDetails = billToUse.payment_details;
                          if (typeof paymentDetails === 'string') {
                            try { paymentDetails = JSON.parse(paymentDetails); } catch { paymentDetails = []; }
                          }

                          const hasPayments = Array.isArray(paymentDetails) && paymentDetails.length > 0;
                          const isPaidOnly = (billToUse.service_status || billToUse.status || '').toLowerCase() === 'paid';

                          if (!hasPayments || !isPaidOnly) {
                            return null;
                          }

                          return (
                            <div className="mt-6 border-t border-emerald-100 pt-6 bg-emerald-50/30 p-6 rounded-2xl mx-2 shadow-sm">
                              <h3 className="text-base font-black text-emerald-900 mb-4 tracking-tight">Payment Information</h3>

                              <div className="space-y-6">
                                {paymentDetails.map((payment, idx) => {
                                  return (
                                    <div key={idx} className="space-y-6">
                                      {/* 2-Column Grid for print */}
                                      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                        <div className="space-y-0.5">
                                          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Payment Method</p>
                                          <p className="text-xs font-black text-emerald-700">{payment.payment_method || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-0.5">
                                          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Transaction ID</p>
                                          <p className="text-xs font-black text-emerald-700 font-mono tracking-tighter">{payment.reference_number || payment.transaction_id || `TXN-${new Date().getTime()}`}</p>
                                        </div>
                                        <div className="space-y-0.5">
                                          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Payment Date</p>
                                          <p className="text-xs font-bold text-gray-800">{payment.payment_date ? formatDate(payment.payment_date) : 'N/A'}</p>
                                        </div>
                                        <div className="space-y-0.5">
                                          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Amount Paid</p>
                                          <p className="text-sm font-black text-teal-600">{formatCurrency(payment.amount_paid || 0)}</p>
                                        </div>
                                      </div>

                                      {/* Success Banner */}
                                      <div className="pt-4 border-t border-emerald-100/50 flex items-center gap-2 text-emerald-600">
                                        <FaCheckCircle className="w-4 h-4" />
                                        <p className="text-sm font-black tracking-tight">Payment Received - Thank You!</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()
                      }

                      {/* Payment Status Banners */}
                      {
                        (billToUse.status === 'PENDING' || billToUse.status === 'due' || billToUse.service_status === 'PENDING' || billToUse.service_status === 'due') && (
                          <div className="mt-8 bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                            <div className="flex items-center gap-2 text-yellow-800">
                              <IoTimeOutline className="w-4 h-4" />
                              <p className="font-semibold text-sm">Payment Pending - Due Date: {formatDate(dueDate)}</p>
                            </div>
                          </div>
                        )
                      }
                      {/* Divider moved to footer section logic */}
                    </div>

                    {/* Payment Instructions for Print */}
                    {(billToUse.service_status || '').toLowerCase() !== 'paid' && (
                      <div className="mt-8 border-t border-gray-100 pt-8 px-8">
                        <h4 className="text-[15px] font-bold text-gray-800 mb-6 font-primary">Payment Instructions</h4>

                        <div className="space-y-8">
                          {/* Bank Details */}
                          <div className="space-y-3">
                            <p className="text-sm font-bold text-gray-800">Bank Transfer</p>
                            <div className="space-y-1 text-xs text-gray-600 font-normal">
                              <p>Account Name: Estate Link Management</p>
                              <p>Account Number: 1234567890</p>
                              <p>Bank: ABC Bank Ltd.</p>
                              <p className="text-gray-400 mt-2 text-[11px]">
                                Please include invoice #{billToUse.billNumber || 'BILL'} as reference
                              </p>
                            </div>
                            <div className="border-b border-gray-50 pt-3"></div>
                          </div>

                          {/* MFS Details */}
                          <div className="space-y-3">
                            <p className="text-sm font-bold text-gray-800">Mobile Financial Service (MFS)</p>
                            <div className="space-y-1 text-xs text-gray-600 font-normal">
                              <p>bKash/Nagad/Rocket: 01712-345678</p>
                              <p className="text-gray-400 text-[11px]">
                                Send payment and share transaction ID via email
                              </p>
                            </div>
                            <div className="border-b border-gray-50 pt-3"></div>
                          </div>

                          {/* Cash Details */}
                          <div className="space-y-2">
                            <p className="text-sm font-bold text-gray-800">Cash Payment</p>
                            <div className="space-y-1 text-xs text-gray-600 font-normal">
                              <p>Visit the management office during business hours</p>
                              <p className="text-gray-400 text-[11px]">Mon-Fri: 9:00 AM - 5:00 PM</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Footer Section */}
                    <div className="bg-gray-100 p-6 border-t border-gray-200">
                      <div className="text-center space-y-2 text-sm text-gray-600">
                        <p>
                          Questions about this invoice? Contact us at{' '}
                          <a href="mailto:billing@estatelink.com" className="text-teal-600 hover:text-teal-700 underline">
                            billing@estatelink.com
                          </a>
                          {' '}or call +880 1234-567890
                        </p>
                        <p>This is a computer-generated invoice. No signature required.</p>
                        <p className="font-medium">
                          Estate Link Property Management | Tax ID: 123456789 | Registration No: ABC-12345
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons - Fixed */}
                    <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                      <button
                        onClick={() => setShowPrintPreview(false)}
                        className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                      >
                        Close
                      </button>
                      <button
                        onClick={handlePrint}
                        className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 font-medium"
                      >
                        <FaPrint className="w-4 h-4" />
                        Print Now
                      </button>

                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* PDF Download Message Modal */}
      {
        showPDFPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Download PDF</h2>
                <button
                  onClick={() => setShowPDFPreview(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <FaTimes className="w-6 h-6" />
                </button>
              </div>
              <div className="text-gray-600 mb-6">
                <p>PDF download functionality will be implemented soon. For now, you can:</p>
                <ul className="list-disc list-inside mt-3 space-y-1 text-sm">
                  <li>Use the Print Preview to save as PDF</li>
                  <li>Use your browser's print dialog (Ctrl+P)</li>
                </ul>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowPDFPreview(false)}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

BillDetailView.propTypes = {
  bill: PropTypes.object,
  onBack: PropTypes.func.isRequired,
  onPrint: PropTypes.func,
  onDownloadPDF: PropTypes.func,
};

export default BillDetailView;