import re

with open(r'h:\wamp64\www\estate-link\frontend\src\utils\paymentReceiptTemplate.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Find the start of the style tag
start_style = text.find('.badge-container')
end_html = text.find('</html>') + 7

new_html = r"""            .badge-container { margin-bottom: 12px; }
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
              background-color: #F9FAFB; 
              border-radius: 8px; 
              padding: 10px 16px; 
              margin-bottom: 10px;
              border: 1px solid #E5E7EB;
            }
            .meta-item { text-align: left; }
            .meta-label { font-size: 9px; font-weight: 700; color: #6B7280; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2px; }
            .meta-value { font-size: 12px; font-weight: 700; color: #111827; }
            .mono { font-family: monospace; }
            
            /* Content Sections */
            .section-card { 
              border: 1px solid #E5E7EB; 
              border-radius: 10px; 
              padding: 10px 14px; 
              margin-bottom: 10px;
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
              @page { margin: 12mm 10mm; size: A4 portrait; }
              body { padding: 0; }
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
                 <img src="https://img.icons8.com/ios-filled/96/3D9D9B/company.png" width="64" height="64" alt="Estate Link" style="display:inline-block; margin: 0 auto; width: 64px; height: 64px; border: 0; outline: none;" />
              </div>
              <div class="company-name">Estate Link</div>
              <div class="company-subtitle">Property Management Services</div>
              
              <div class="badge-container">
                <div class="status-badge">
                  <span style="display:inline-block; margin-right:4px;">✓</span> PAYMENT RECEIVED
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
                  <td valign="top" width="50%" align="left">
                    <div class="info-group">
                      <div class="info-label">Tower</div>
                      <div class="info-value">${payment.tower_name || 'N/A'}</div>
                    </div>
                    <div class="info-group">
                      <div class="info-label">Resident Name</div>
                      <div class="info-value">${payment.primary_name || payment.secondary_name || payment.resident_name || 'N/A'}</div>
                    </div>
                     <div class="info-group">
                      <div class="info-label">Phone</div>
                      <div class="info-value">${payment.phone || payment.owner_phone || payment.resident_number || 'N/A'}</div>
                    </div>
                  </td>
                  <td valign="top" width="50%" align="left">
                    <div class="info-group">
                       <div class="info-label">Unit Number</div>
                      <div class="info-value">${payment.unit_display || payment.unit_number || 'N/A'}</div>
                    </div>
                     <div class="info-group">
                      <div class="info-label">Email</div>
                      <div class="info-value">${payment.email || payment.owner_email || payment.resident_email || 'N/A'}</div>
                    </div>
                  </td>
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
                    <td style="padding: 8px 6px; text-align: right; font-size: 12px;">৳${alloc.amount}</td>
                    <td style="padding: 8px 6px; text-align: right; font-size: 12px; color: #EF4444;">${parseFloat(alloc.gross_penalty_amount || alloc.grossPenalty || 0) > 0 ? `৳${alloc.gross_penalty_amount || alloc.grossPenalty}` : '-'}</td>
                    <td style="padding: 8px 6px; text-align: right; font-size: 12px; color: #10B981;">${parseFloat(alloc.waived) > 0 ? `৳${alloc.waived}` : '-'}</td>
                    <td style="padding: 8px 6px; text-align: right; font-weight: 800; font-size: 12px; color: #3D9D9B;">৳${alloc.amount}</td>
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
      </html>"""

text = text[:start_style] + new_html + text[end_html:]

with open(r'h:\wamp64\www\estate-link\frontend\src\utils\paymentReceiptTemplate.js', 'w', encoding='utf-8') as f:
    f.write(text)
