import { RxCross1 } from 'react-icons/rx';
import { BiDownload, BiBuildingHouse } from 'react-icons/bi';
import { HiOutlinePrinter } from 'react-icons/hi';
import { FaCheckCircle, FaUser, FaFileInvoiceDollar, FaEnvelope, FaPhone } from 'react-icons/fa';
import PropTypes from 'prop-types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import html2pdf from 'html2pdf.js';
import { getReceiptHtml } from '../../../utils/paymentReceiptTemplate';

const ViewReceiptModal = ({ isOpen, onClose, payment = null }) => {


  console.log('ViewReceiptModal payment:', {
    primary_name: payment?.primary_name,
    secondary_name: payment?.secondary_name,
    resident_name: payment?.resident_name,
    full_payment: payment
  });
  const getStatusBadgeClasses = (status) => {
    if (!status) return 'bg-gray-100 text-gray-800';

    const statusLower = status.toLowerCase();
    if (statusLower === 'paid') {
      return 'bg-emerald-100 text-emerald-800';
    } else if (statusLower === 'overdue') {
      return 'bg-red-100 text-red-800';
    } else if (statusLower === 'partial') {
      return 'bg-yellow-100 text-yellow-800';
    } else if (statusLower === 'due') {
      return 'bg-blue-100 text-blue-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  if (!isOpen || !payment) return null;

  const getMonthName = (monthNumber) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthNumber - 1] || 'Unknown';
  };

  // Format date to DD-MMM-YYYY format
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

  // Function to extract payment method from notes
  // Function to extract payment method from notes
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
      // if (pd.to_account_name) details.toName = pd.to_account_name;
    }

    return details;
  };

  // Format date and time to DD/MM/YYYY, HH:MM:SS AM/PM
  const formatDateTime = (date) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const formattedHours = String(hours).padStart(2, '0');

    return `${day}/${month}/${year}, ${formattedHours}:${minutes}:${seconds} ${ampm}`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('BDT', '৳');
  };

  const handleDownload = async () => {
    if (!payment) return;

    try {
      // Create a hidden iframe for ultimate isolation (prevents any page shaking)
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '800px';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';
      iframe.style.left = '-9999px';
      document.body.appendChild(iframe);

      const html = getReceiptHtml(payment);

      const fileName = `Receipt_${payment.receipt_id || payment.transaction_id || 'Unknown'}.pdf`;

      const opt = {
        margin: [5, 5],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      // Use the HTML string directly for better style preservation
      await html2pdf().from(html).set(opt).save();

      // Remove the iframe after download completes
      document.body.removeChild(iframe);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  const getPrintStatusClass = (status) => {
    if (!status) return 'status-default';

    const statusLower = status.toLowerCase();
    if (statusLower === 'paid') {
      return 'status-paid';
    } else if (statusLower === 'overdue') {
      return 'status-overdue';
    } else if (statusLower === 'partial') {
      return 'status-partial';
    } else if (statusLower === 'due') {
      return 'status-due';
    }
    return 'status-default';
  };

  const handlePrint = () => {
    if (!payment) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up blocked! Please allow pop-ups to print the receipt.');
      return;
    }

    const html = getReceiptHtml(payment);

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" />

      {/* Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl relative">
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute -top-2 -right-2 p-2 rounded-full bg-primary text-white shadow-md hover:bg-primaryHover transition z-20"
            >
              <RxCross1 />
            </button>

            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Payment Receipt</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors text-sm"
                  >
                    <BiDownload size={16} />
                    Download
                  </button>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors text-sm"
                  >
                    <HiOutlinePrinter size={16} />
                    Print
                  </button>
                </div>
              </div>
            </div>

            {/* Receipt Content */}
            <div className="p-8 bg-white" id="receipt-content">
              {/* Header */}
              <div className="text-center mb-10">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-teal-50 rounded-full flex items-center justify-center w-16 h-16 mx-auto">
                    <img
                      src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjMEQ5NDg4Ij48cGF0aCBkPSJNMTkgMkg5Yy0xLjEwMyAwLTIgLjg5Ny0yIDJ2NS41ODZsLTQuNzA3IDQuNzA3QTEgMSAwIDAgMCAzIDE2djVhMSAxIDAgMCAwIDEgMWgxNmExIDEgMCAwIDAgMS0xVjRjMC0xLjEwMy0uODk3LTItMi0yem0tOCAxOEg1di01LjU4NmwzLTMgMyAzVjIwem04IDBoLTZ2LTRhLjk5OS45OTkgMCAwIDAgLjcwNy0xLjcwN0w5IDkuNTg2VjRoMTB2MTZ6Ii8+PHBhdGggZD0iTTExIDZoMnYyaC0yem00IDBoMnYyaC0yem0wIDQuMDMxaDJWMTJoLTJ6TTE1IDE0aDJ2MmgtMnptLTggMWgydjJIN3oiLz48L3N2Zz4="
                      alt="Building"
                      className="w-10 h-10"
                    />
                  </div>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-1">Estate Link</h1>
                <p className="text-gray-500 font-medium mb-6">Property Management Services</p>

                <div className="flex justify-center">
                  <div className="flex items-center gap-2 px-6 py-2 bg-emerald-50 text-emerald-700 rounded-full font-bold text-sm tracking-wide uppercase shadow-sm border border-emerald-100">
                    <FaCheckCircle className="text-emerald-500" /> PAYMENT RECEIVED
                  </div>
                </div>
              </div>

              {/* Meta Info Bar */}
              {/* Meta Info & Payment Channel Combined Card */}
              <div className="bg-gray-50 rounded-xl p-6 mb-8 border border-gray-100">
                {(() => {
                  const channel = getPaymentChannelDetails(payment);
                  return (
                    <div className="flex flex-col lg:grid lg:grid-cols-3 gap-y-6 gap-x-4">
                      {/* Row 1: Basic Receipt Info */}
                      <div className="text-left">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Receipt Number</p>
                        <p className="text-base font-bold text-gray-900">{payment.receipt_id}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Transaction ID</p>
                        <p className="text-base font-bold text-gray-900">{payment.transaction_id || 'N/A'}</p>
                      </div>
                      <div className="text-left lg:text-right">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Payment Date</p>
                        <p className="text-base font-bold text-gray-900">{formatDate(payment.payment_date)}</p>
                      </div>

                      {/* Row 2: Payment Channel Details (if available) */}
                      {/* Separator Line */}
                      <div className="col-span-3 border-t border-gray-200"></div>

                      <div className="text-left">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Method</p>
                        <p className="text-base font-bold text-gray-900">{channel.method}</p>
                      </div>


                      <div className="text-left">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">From Account</p>
                        <p className="text-base font-bold text-gray-900 font-mono">{channel.from || 'N/A'}</p>
                      </div>



                      <div className="text-left lg:text-right">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">To Account</p>
                        <div className="flex flex-col items-start lg:items-end">
                          <span className="text-base font-bold text-gray-900 font-mono">{channel.to || 'N/A'}</span>
                          {channel.toName && <span className="text-xs text-gray-500 font-medium">{channel.toName || 'N/A'}</span>}
                        </div>
                      </div>

                    </div>
                  );
                })()}
              </div>

              {/* Resident Info */}
              <div className="border border-gray-200 rounded-2xl p-6 mb-6">
                <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
                  <FaUser className="text-gray-400" />
                  <h3 className="font-bold text-gray-800">Resident Information</h3>
                </div>
                <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Tower</p>
                    <p className="font-semibold text-gray-900">{payment.tower_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Unit Number</p>
                    <p className="font-semibold text-gray-900">{payment.unit_display || payment.unit_number || 'N/A'}</p>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <p className="text-xs text-gray-500 mb-1">Resident Name</p>
                    <p className="font-semibold text-gray-900">{payment.primary_name || payment.secondary_name || payment.resident_name || 'N/A'}</p>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <p className="text-xs text-gray-500 mb-1">Email</p>
                    <p className="font-semibold text-gray-900 break-all">{payment.email || payment.primary_email || payment.resident_email || payment.owner_email || 'N/A'}</p>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <p className="text-xs text-gray-500 mb-1">Phone</p>
                    <p className="font-semibold text-gray-900">{payment.phone || payment.owner_phone || payment.resident_number || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="border border-gray-200 rounded-2xl p-1 lg:p-6 mb-8">
                <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
                  <FaFileInvoiceDollar className="text-gray-400" />
                  <h3 className="font-bold text-gray-800">Payment Allocation</h3>
                </div>

                <div className="space-y-4">
                  {/* Show all allocations if available (from grouped payments) */}
                  {payment.parsed_allocations && payment.parsed_allocations.length > 0 ? (
                    <div className="bg-[#f8fafc] rounded-2xl p-6 border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-6 text-slate-400">
                        <FaFileInvoiceDollar size={18} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Detailed Allocation Breakdown</span>
                      </div>

                      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white mb-6 custom-scrollbar">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                              <th className="text-left py-4 px-4 font-bold uppercase tracking-wider whitespace-nowrap">Bill Month</th>
                              <th className="text-right py-4 px-2 font-bold uppercase tracking-wider whitespace-nowrap">Bill Amount</th>
                              <th className="text-right py-4 px-2 font-bold uppercase tracking-wider whitespace-nowrap">Gross Penalty</th>
                              <th className="text-right py-4 px-2 font-bold uppercase tracking-wider whitespace-nowrap">Waived</th>
                              <th className="text-right py-4 px-2 font-bold uppercase tracking-wider whitespace-nowrap">Amount Paid</th>
                              <th className="text-center py-4 px-4 font-bold uppercase tracking-wider whitespace-nowrap">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {payment.parsed_allocations.map((alloc, idx) => (
                              <tr key={idx} className="group transition-colors">
                                <td className="py-4 px-4 font-bold text-slate-800 text-sm whitespace-nowrap">{alloc.month_name}</td>
                                <td className="text-right py-4 px-2 text-slate-600 font-medium whitespace-nowrap">{formatCurrency(alloc.bill_amount || alloc.amount || 0)}</td>
                                <td className="text-right py-4 px-2 text-red-500/80 font-medium whitespace-nowrap">{parseFloat(alloc.gross_penalty_amount || alloc.grossPenalty || 0) > 0 ? formatCurrency(alloc.gross_penalty_amount || alloc.grossPenalty) : '-'}</td>
                                <td className="text-right py-4 px-2 text-emerald-500/80 font-medium whitespace-nowrap">{parseFloat(alloc.waived) > 0 ? formatCurrency(alloc.waived) : '-'}</td>
                                <td className="text-right py-4 px-2 font-bold text-teal-600 text-sm whitespace-nowrap">{formatCurrency(alloc.paid_amount)}</td>
                                <td className="text-center py-4 px-4">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter ${alloc.status === 'paid' || alloc.status === 'Paid'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                                    }`}>
                                    {alloc.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Summary Area */}
                      <div className="bg-white border border-slate-100 rounded-xl p-6 space-y-4 shadow-sm">
                        <div className="flex justify-between items-center text-sm font-bold text-slate-500">
                          <span>Subtotal (Bills Payment)</span>
                          <span className="text-slate-900 font-black">{formatCurrency(parseFloat(payment.paid_amount || 0) - parseFloat(payment.advance_amount || 0))}</span>
                        </div>

                        {parseFloat(payment.advance_amount || 0) > 0 && (
                          <div className="flex justify-between items-center text-sm font-bold text-slate-500">
                            <span>Advance Payment (Future Bills)</span>
                            <span className="text-purple-600 font-black">{formatCurrency(payment.advance_amount)}</span>
                          </div>
                        )}

                        <div className="pt-4 border-t-2 border-dashed border-slate-100 flex justify-between items-center">
                          <span className="lg:text-lg font-black text-slate-800 tracking-tight">Total Amount Paid</span>
                          <span className="text-lg lg:text-3xl font-black text-teal-600 tracking-tighter">
                            {formatCurrency(payment.paid_amount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Fallback: Single bill month (legacy format) */}
                      <div className="flex justify-between items-center py-2 border-b border-gray-50">
                        <span className="text-gray-600 font-medium">Bill Month</span>
                        <span className="font-semibold text-gray-900">
                          {payment.service_period_month && payment.service_period_year
                            ? `${getMonthName(payment.service_period_month)} ${payment.service_period_year}`
                            : 'N/A'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-4 mt-2">
                        <span className="text-lg font-extrabold text-gray-900">Total Amount Paid</span>
                        <span className="text-2xl font-extrabold text-teal-600">{formatCurrency(payment.paid_amount || payment.amount || 0)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="bg-blue-50 text-blue-900 rounded-xl p-6 mb-8 border border-blue-100">
                <h4 className="text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Notes</h4>
                <p className="text-sm leading-relaxed">
                  {payment.notes || `Service fee payment for ${payment.tower_name || 'Unknown Tower'} - ${payment.unit_display || payment.unit_number || 'Unknown Unit'}.`}
                </p>
              </div>

              {/* Footer */}
              <div className="text-center pt-8 border-t border-gray-100">
                <div className="flex justify-between text-xs text-gray-500 mb-4 px-4">
                  <span>Recorded By: <span className="font-semibold text-gray-700">{payment.created_by_name || 'System'}</span></span>
                  <span>Recorded At: <span className="font-semibold text-gray-700">{formatDateTime(new Date())}</span></span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}

          </div>
        </div>
      </div>
    </>
  );
};
ViewReceiptModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  payment: PropTypes.object
};

export default ViewReceiptModal;
