/**
 * Utility to generate HTML template for Payment Receipt
 * Consistent with ViewReceiptModal's print view but optimized for both Print and PDF
 */

const getMonthName = (monthNumber) => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[monthNumber - 1] || 'Unknown';
};

const formatDate = (dateValue) => {
  if (!dateValue || dateValue === '1970-01-01T00:00:00Z' || dateValue === '1970-01-01') {
    return 'N/A';
  }
  try {
    const date = new Date(dateValue);
    const day = String(date.getDate()).padStart(2, '0');
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return 'N/A';
  }
};

const formatDateTime = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, '0');

  return `${day}/${month}/${year}, ${formattedHours}:${minutes}:${seconds} ${ampm}`;
};

const getPaymentMethodFromNotes = (payment) => {
  return payment.method_display || payment.payment_method || 'N/A';
};

const getPaymentChannelDetails = (payment) => {
  let details = {
    method: getPaymentMethodFromNotes(payment),
    from: 'N/A',
    to: 'N/A',
    toName: ''
  };

  const pd = payment.parsed_payment_details && payment.parsed_payment_details.length > 0
    ? payment.parsed_payment_details[0]
    : null;

  if (pd) {
    if (pd.payment_method) details.method = pd.payment_method;

    // Extract 'From' using simple string split if available in notes and no regex allowed
    if (pd.notes && pd.notes.includes('From:')) {
      const parts = pd.notes.split('From:');
      if (parts.length > 1) {
        const afterFrom = parts[1];
        details.from = afterFrom.split(',')[0].split('-')[0].trim();
      }
    }

    // Use explicit fields for 'To' account info
    if (pd.to_account_number) details.to = pd.to_account_number;
    if (pd.to_account_name) details.toName = pd.to_account_name;
  }

  return details;
};

export const getReceiptHtml = (payment) => {
  const receiptNo = payment.receipt_id || (payment.transaction_id ? `REC-${payment.transaction_id.slice(-6)}` : 'REC-0000');
  const totalAmount = payment.paid_amount || payment.total_paid || payment.amount || 0;
  const allocations = payment.parsed_allocations || [];
  const hasAdvance = parseFloat(payment.advance_amount || 0) > 0;
  const channel = getPaymentChannelDetails(payment);

  return `
      <html>
        <head>
          <title>Payment Receipt - ${receiptNo}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; }
            body { 
              font-family: 'Inter', sans-serif; 
              margin: 0; 
              padding: 10px 0; 
              color: #1F2937; 
              background: white;
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important;
              line-height: 1.4;
              font-size: 12px;
            }
            .receipt-container { 
              width: 100%; 
              max-width: 760px; 
              margin: 0 auto; 
              background: white; 
              padding: 0 30px;
            }
            
            /* Header */
            .header-section { text-align: center; margin-bottom: 12px; }
            .company-name { font-size: 20px; font-weight: 800; color: #111827; margin-bottom: 1px; }
            .company-subtitle { font-size: 11px; color: #6B7280; font-weight: 500; margin-bottom: 10px; }
            
            .badge-container { margin-bottom: 12px; }
            .status-badge { 
              background-color: #ECFDF5; 
              color: #059669; 
              padding: 4px 14px; 
              border-radius: 50px; 
              font-weight: 700; 
              font-size: 10px; 
              letter-spacing: 0.06em;
              text-transform: uppercase;
              display: inline-block;
            }
            
            /* Meta Info Bar */
            .meta-info-bar { 
              background-color: white; 
              border-radius: 12px; 
              padding: 16px 20px; 
              margin-bottom: 12px;
              border: 1px solid #E5E7EB;
              box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            }
            .meta-item { text-align: left; }
            .meta-label { font-size: 9px; font-weight: 700; color: #6B7280; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2px; }
            .meta-value { font-size: 12px; font-weight: 700; color: #111827; }
            .mono { font-family: monospace; }
            
            /* Content Sections */
            .section-card { 
              background-color: white;
              border: 1px solid #E5E7EB; 
              border-radius: 12px; 
              padding: 16px 20px; 
              margin-bottom: 12px;
              box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            }
            .section-header { 
              font-size: 12px; 
              font-weight: 700; 
              color: #111827; 
              border-bottom: 1px solid #F3F4F6;
              padding-bottom: 6px;
              margin-bottom: 8px;
            }
            .info-group { margin-bottom: 7px; }
            .info-label { font-size: 10px; color: #6B7280; margin-bottom: 1px; }
            .info-value { font-size: 12px; color: #111827; font-weight: 600; }
            
            /* Payment Table */
            .payment-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
            .summary-area { background-color: #F9FAFB; border-radius: 8px; padding: 10px 12px; margin-top: 8px; }
            .total-label { font-size: 14px; font-weight: 800; color: #111827; }
            .total-value { font-size: 18px; font-weight: 800; color: #3D9D9B; }
            
            /* Notes */
            .notes-box { background-color: #EFF6FF; border-radius: 8px; padding: 10px 14px; color: #1E40AF; font-size: 11px; margin-bottom: 12px; }
            .notes-title { font-weight: 800; margin-bottom: 4px; text-transform: uppercase; font-size: 9px; letter-spacing: 0.06em; opacity: 0.8; }
            
            /* Footer */
            .footer { text-align: center; border-top: 1px solid #E5E7EB; padding-top: 12px; padding-bottom: 5px; color: #6B7280; font-size: 11px; }
            .footer p { margin: 2px 0; }
            .footer-bold { font-weight: 700; color: #374151; }
            
            @media print {
              @page { margin: 0; size: A4 portrait; }
              body { padding: 12mm 10mm; }
              .receipt-container { max-width: 100%; padding: 0 10px; }
              .section-card, .meta-info-bar, .notes-box, .summary-area, .footer, .total-row { 
                page-break-inside: avoid; 
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <!-- Header -->
            <div class="header-section">
              <div style="text-align: center; margin-bottom: 16px;">
                 <div style="width: 70px; height: 70px; background-color: #F0FDFA; border-radius: 100%; border: 1px solid #CCFBF1; display: flex; align-items: center; justify-content: center; margin: 0 auto; overflow: hidden;">
                    <img 
                      src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjMEQ5NDg4Ij48cGF0aCBkPSJNMTkgMkg5Yy0xLjEwMyAwLTIgLjg5Ny0yIDJ2NS41ODZsLTQuNzA3IDQuNzA3QTEgMSAwIDAgMCAzIDE2djVhMSAxIDAgMCAwIDEgMWgxNmExIDEgMCAwIDAgMS0xVjRjMC0xLjEwMy0uODk3LTItMi0yem0tOCAxOEg1di01LjU4NmwzLTMgMyAzVjIwem04IDBoLTZ2LTRhLjk5OS45OTkgMCAwIDAgLjcwNy0xLjcwN0w5IDkuNTg2VjRoMTB2MTZ6Ii8+PHBhdGggZD0iTTExIDZoMnYyaC0yem00IDBoMnYyaC0yem0wIDQuMDMxaDJWMTJoLTJ6TTE1IDE0aDJ2MmgtMnptLTggMWgydjJIN3oiLz48L3N2Zz4=" 
                      style="width: 40px; height: 40px; display: block; border: 0;" 
                      alt="Estate Link" 
                    />
                 </div>
              </div>
              <div class="company-name">Estate Link</div>
              <div class="company-subtitle">Property Management Services</div>
              
              <div class="badge-container">
                <div class="status-badge" style="background-color: #ECFDF5; border: 1px solid #D1FAE5; font-size: 9px; padding: 6px 16px;">
                  <span style="color: #10B981; font-weight: bold; margin-right: 4px; font-size: 11px;">✓</span> PAYMENT RECEIVED
                </div>
              </div>
            </div>
            
            <!-- Meta Bar & Payment Channel -->
            <div class="meta-info-bar">
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="top" width="33%" align="left" class="meta-item">
                    <div class="meta-label">Receipt Number</div>
                    <div class="meta-value">${receiptNo}</div>
                  </td>
                  <td valign="top" width="33%" align="left" class="meta-item">
                    <div class="meta-label">Transaction ID</div>
                    <div class="meta-value">${payment.transaction_id || 'N/A'}</div>
                  </td>
                  <td valign="top" width="33%" align="right" class="meta-item">
                    <div class="meta-label">Payment Date</div>
                    <div class="meta-value">${formatDate(payment.payment_date)}</div>
                  </td>
                </tr>
              </table>
              
              <div style="border-top: 1px solid #E5E7EB; margin: 20px 0;"></div>
              
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="top" width="33%" align="left" class="meta-item">
                    <div class="meta-label">Method</div>
                    <div class="meta-value">${channel.method}</div>
                  </td>
                  ${channel.from ? `
                  <td valign="top" width="33%" align="left" class="meta-item">
                    <div class="meta-label">From Account</div>
                    <div class="meta-value mono">${channel.from}</div>
                  </td>` : '<td valign="top" width="33%"></td>'}
                  
                  ${channel.to ? `  
                  <td valign="top" width="33%" align="right" class="meta-item">
                    <div class="meta-label">To Account</div>
                    <div class="meta-value mono">${channel.to}</div>
                    ${channel.toName ? `<div style="font-size: 11px; color: #6B7280; margin-top: 2px;">${channel.toName}</div>` : ''}
                  </td>` : '<td valign="top" width="33%"></td>'}
                </tr>
              </table>
            </div>
            
            <!-- Resident Info -->
            <div class="section-card">
              <div class="section-header">
                Resident Information
              </div>
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="top" width="50%" align="left" style="padding-bottom: 15px;">
                    <div class="info-label">Tower</div>
                    <div class="info-value">${payment.tower_name || 'N/A'}</div>
                  </td>
                  <td valign="top" width="50%" align="left" style="padding-bottom: 15px;">
                    <div class="info-label">Unit Number</div>
                    <div class="info-value">${payment.unit_display || payment.unit_number || 'N/A'}</div>
                  </td>
                </tr>
                <tr>
                  <td valign="top" width="50%" align="left" style="padding-bottom: 15px;">
                    <div class="info-label">Resident Name</div>
                    <div class="info-value">${payment.primary_name || payment.secondary_name || payment.resident_name || 'N/A'}</div>
                  </td>
                  <td valign="top" width="50%" align="left" style="padding-bottom: 15px;">
                    <div class="info-label">Email</div>
                    <div class="info-value">${payment.email || payment.primary_email || payment.resident_email || payment.owner_email || 'N/A'}</div>
                  </td>
                </tr>
                <tr>
                  <td valign="top" width="50%" align="left">
                    <div class="info-label">Phone</div>
                    <div class="info-value">${payment.phone || payment.owner_phone || payment.resident_number || 'N/A'}</div>
                  </td>
                  <td valign="top" width="50%" align="left"></td>
                </tr>
              </table>
            </div>

             <!-- Payment Details -->
            <div class="section-card">
              <div class="section-header">
                Payment Allocation
              </div>
              
              <table class="payment-table">
                <thead>
                  <tr style="background-color: #F8FAFC; text-align: left;">
                    <th style="padding: 8px 10px; font-size: 9px; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 800; border-bottom: 1px solid #E2E8F0;">Bill Month</th>
                    <th style="padding: 8px 8px; font-size: 9px; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 800; text-align: right; border-bottom: 1px solid #E2E8F0;">Bill Amount</th>
                    <th style="padding: 8px 8px; font-size: 9px; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 800; text-align: right; border-bottom: 1px solid #E2E8F0;">Gross Penalty</th>
                    <th style="padding: 8px 8px; font-size: 9px; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 800; text-align: right; border-bottom: 1px solid #E2E8F0;">Waived</th>
                    <th style="padding: 8px 8px; font-size: 9px; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 800; text-align: right; border-bottom: 1px solid #E2E8F0;">Paid</th>
                    <th style="padding: 8px 10px; font-size: 9px; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 800; text-align: center; border-bottom: 1px solid #E2E8F0;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${allocations.length > 0 ? allocations.map(alloc => `
                  <tr style="border-bottom: 1px solid #F3F4F6;">
                    <td style="padding: 8px 0; font-weight: 700; font-size: 12px;">${alloc.month_name}</td>
                    <td style="padding: 8px 6px; text-align: right; font-size: 12px;">৳${alloc.bill_amount || alloc.amount || 0}</td>
                    <td style="padding: 8px 6px; text-align: right; font-size: 12px; color: #EF4444;">${parseFloat(alloc.gross_penalty_amount || alloc.grossPenalty || 0) > 0 ? `৳${alloc.gross_penalty_amount || alloc.grossPenalty}` : '-'}</td>
                    <td style="padding: 8px 6px; text-align: right; font-size: 12px; color: #10B981;">${parseFloat(alloc.waived) > 0 ? `৳${alloc.waived}` : '-'}</td>
                    <td style="padding: 8px 6px; text-align: right; font-weight: 800; font-size: 12px; color: #3D9D9B;">৳${alloc.paid_amount || alloc.amount_paid || alloc.total_paid || 0}</td>
                    <td style="padding: 8px 0; text-align: center;">
                       <span style="display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; background-color: ${alloc.status === 'paid' || alloc.status === 'Paid' ? '#D1FAE5' : '#FEF3C7'}; color: ${alloc.status === 'paid' || alloc.status === 'Paid' ? '#047857' : '#B45309'}; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                          ${alloc.status}
                       </span>
                    </td>
                  </tr>
                  `).join('') : `
                  <tr style="border-bottom: 1px solid #F3F4F6;">
                    <td style="padding: 10px 0; font-weight: 700; font-size: 14px;">
                      ${payment.service_period_month && payment.service_period_year
      ? `${getMonthName(payment.service_period_month)} ${payment.service_period_year}`
      : 'N/A'}
                    </td>
                    <td style="padding: 10px 8px; text-align: right; font-size: 14px;">৳${totalAmount}</td>
                    <td style="padding: 10px 8px; text-align: right; font-size: 14px;">-</td>
                    <td style="padding: 10px 8px; text-align: right; font-size: 14px;">-</td>
                    <td style="padding: 10px 8px; text-align: right; font-weight: 800; font-size: 14px; color: #3D9D9B;">৳${totalAmount}</td>
                    <td style="padding: 10px 0; text-align: center; font-size: 14px; color: #64748B;">-</td>
                  </tr>
                  `}
                </tbody>
              </table>

              <!-- Summary Area -->
              <div class="summary-area">
                <table width="100%" border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="left" style="padding: 5px 0;">
                      <div class="info-label" style="font-weight: 700;">Subtotal (Bills Payment)</div>
                    </td>
                    <td align="right" style="padding: 5px 0;">
                      <div class="info-value" style="font-weight: 800;">৳${(parseFloat(totalAmount) - parseFloat(payment.advance_amount || 0)).toLocaleString()}</div>
                    </td>
                  </tr>
                </table>

                ${hasAdvance ? `
                <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-top: 5px;">
                  <tr>
                    <td align="left">
                      <div class="info-label" style="font-weight: 700; color: #7C3AED;">Advance Payment (Future Bills)</div>
                    </td>
                    <td align="right">
                      <div class="info-value" style="font-weight: 800; color: #7C3AED;">৳${parseFloat(payment.advance_amount).toLocaleString()}</div>
                    </td>
                  </tr>
                </table>
                ` : ''}

                <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-top: 15px;">
                  <tr><td colspan="2" style="border-top: 2px dashed #E5E7EB; padding-top: 15px;"></td></tr>
                  <tr>
                    <td align="left">
                      <div class="total-label">Total Amount Paid</div>
                    </td>
                    <td align="right">
                      <div class="total-value">৳${parseFloat(totalAmount).toLocaleString()}</div>
                    </td>
                  </tr>
                </table>
              </div>
            </div>
            
            <!-- Notes -->
            <div class="notes-box">
              <div class="notes-title">Notes</div>
              <div>${payment.notes || `Service fee payment for ${payment.tower_name || 'Unknown Tower'} - ${payment.unit_display || payment.unit_number || 'Unknown Unit'}.`}</div>
            </div>
            
            <!--Footer -->
            <div class="footer">
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" style="padding: 0 10px;">
                    <span>Recorded By: <span class="footer-bold">${payment.created_by_name || 'System'}</span></span>
                  </td>
                  <td align="right" style="padding: 0 10px;">
                    <span>Recorded At: <span class="footer-bold">${formatDateTime(new Date())}</span></span>
                  </td>
                </tr>
              </table>
            </div>
            
          </div>
        </body>
      </html>
  `;
};
