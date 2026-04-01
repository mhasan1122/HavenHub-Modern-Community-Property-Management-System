import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaPrint, FaDownload, FaArrowLeft } from 'react-icons/fa';
import ModernLoadingAnimation from '../../../../../Components/Loaders/ModernLoadingAnimation';
import PageContainer from '../../../../../Components/Ui/PageContainer';
import ContentBox from '../../../../../Components/Ui/ContentBox';
import Button from '../../../../../Components/FormComponent/ButtonComponent/Button';
import useServiceInvoice from '../hooks/useServiceInvoice';

/**
 * Service Invoice Component with Hook Integration
 * Displays service invoice with payment details
 * Route: /service-invoice/:unitId/:serviceFeeId/:month/:year
 */
const ServiceInvoiceWithHook = () => {
  const { unitId, serviceFeeId, month, year } = useParams();
  const navigate = useNavigate();
  
  // Use the custom hook to fetch invoice data
  const { invoiceData, loading, error } = useServiceInvoice(
    parseInt(unitId),
    parseInt(serviceFeeId),
    parseInt(month),
    parseInt(year)
  );

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    // TODO: Implement PDF generation using jsPDF or similar
    alert('PDF download feature will be implemented soon');
  };

  const formatCurrency = (value) => {
    const num = parseFloat(value) || 0;
    return `৳ ${num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getMonthName = (monthNum) => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames[parseInt(monthNum) - 1] || 'Unknown';
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ModernLoadingAnimation />
      </div>
    );
  }

  // Error state
  if (error || !invoiceData) {
    return (
      <PageContainer>
        <ContentBox>
          <div className="text-center py-12">
            <p className="text-red-600 text-lg font-semibold mb-4">
              {error || 'No invoice data available'}
            </p>
            <Button
              onClick={() => navigate(-1)}
              variant="primary"
            >
              Go Back
            </Button>
          </div>
        </ContentBox>
      </PageContainer>
    );
  }

  const monthName = getMonthName(invoiceData.service_period_month);
  const invoiceYear = invoiceData.service_period_year;
  const paymentDate = invoiceData.payment_date ? new Date(invoiceData.payment_date) : null;
  const issueDate = paymentDate 
    ? `${String(paymentDate.getDate()).padStart(2, '0')}.${String(paymentDate.getMonth() + 1).padStart(2, '0')}.${String(paymentDate.getFullYear()).slice(-2)}`
    : 'N/A';

  const dueAmount = (parseFloat(invoiceData.amount) || 0) - (parseFloat(invoiceData.total_paid) || 0);

  return (
    <PageContainer>
      <ContentBox>
        {/* Header Controls */}
        <div className="flex justify-between items-center mb-6 print:hidden">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
          >
            <FaArrowLeft size={18} />
            <span>Back</span>
          </button>
          <div className="flex gap-2">
            <Button
              icon={FaPrint}
              variant="download"
              onClick={handlePrint}
              tooltip="Print Invoice"
              tooltipId="print-invoice"
            />
            <Button
              icon={FaDownload}
              variant="download"
              onClick={handleDownloadPDF}
              tooltip="Download PDF"
              tooltipId="download-pdf"
            />
          </div>
        </div>

        {/* Invoice Container - Print Optimized */}
        <div className="max-w-4xl mx-auto bg-white border-2 border-gray-300 p-8 print:border-0 print:p-0 print:max-w-none">
          
          {/* Header */}
          <div className="text-center border-b-2 border-gray-400 pb-6 mb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">SERVICE INVOICE</h1>
            <p className="text-gray-600 font-semibold">For the month of {monthName} {invoiceYear}</p>
          </div>

          {/* Reference & Unit Info Grid */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Reference Information */}
            <div className="border border-gray-400">
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="border-r border-b border-gray-400 p-2 bg-gray-100 font-semibold w-1/3">Ref:</td>
                    <td className="border-b border-gray-400 p-2">{invoiceData.transaction_id || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="border-r border-b border-gray-400 p-2 bg-gray-100 font-semibold">Period:</td>
                    <td className="border-b border-gray-400 p-2">{monthName}-{String(invoiceYear).slice(-2)}</td>
                  </tr>
                  <tr>
                    <td className="border-r border-b border-gray-400 p-2 bg-gray-100 font-semibold">Issue Date:</td>
                    <td className="border-b border-gray-400 p-2">{issueDate}</td>
                  </tr>
                  <tr>
                    <td className="border-r border-gray-400 p-2 bg-gray-100 font-semibold">Status:</td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        invoiceData.service_status === 'paid' 
                          ? 'bg-green-100 text-green-800' 
                          : invoiceData.service_status === 'partial'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {invoiceData.service_status?.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Unit Information */}
            <div className="border border-gray-400">
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="border-r border-b border-gray-400 p-2 bg-gray-100 font-semibold w-1/3">Unit No:</td>
                    <td className="border-b border-gray-400 p-2">{invoiceData.unit_name || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="border-r border-b border-gray-400 p-2 bg-gray-100 font-semibold">Tower:</td>
                    <td className="border-b border-gray-400 p-2">{invoiceData.tower_name || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="border-r border-b border-gray-400 p-2 bg-gray-100 font-semibold">Unit ID:</td>
                    <td className="border-b border-gray-400 p-2">{invoiceData.unit_id || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="border-r border-gray-400 p-2 bg-gray-100 font-semibold">Fee ID:</td>
                    <td className="p-2">{invoiceData.service_fee_id || 'N/A'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Owner/Tenant Details */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Owner Details */}
            <div className="border border-gray-400">
              <div className="bg-gray-200 border-b border-gray-400 p-2 font-bold text-sm">
                Details of Owner
              </div>
              <div className="p-3 text-sm space-y-2">
                <div className="flex justify-between border-b border-gray-300 pb-1">
                  <span className="font-semibold">Name:</span>
                  <span>{invoiceData.resident_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between border-b border-gray-300 pb-1">
                  <span className="font-semibold">Mobile:</span>
                  <span>{invoiceData.resident_number || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Email:</span>
                  <span className="text-right text-xs">{invoiceData.resident_email || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Tenant Details */}
            <div className="border border-gray-400">
              <div className="bg-gray-200 border-b border-gray-400 p-2 font-bold text-sm">
                Details of Tenant
              </div>
              <div className="p-3 text-sm space-y-2">
                <div className="flex justify-between border-b border-gray-300 pb-1">
                  <span className="font-semibold">Name:</span>
                  <span>N/A</span>
                </div>
                <div className="flex justify-between border-b border-gray-300 pb-1">
                  <span className="font-semibold">Mobile:</span>
                  <span>N/A</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Email:</span>
                  <span>N/A</span>
                </div>
              </div>
            </div>
          </div>

          {/* Billing Details Table */}
          <div className="mb-8 border border-gray-400">
            <table className="w-full text-sm">
              <thead className="bg-gray-200">
                <tr>
                  <th className="border-r border-b border-gray-400 p-2 text-left font-bold">SL</th>
                  <th className="border-r border-b border-gray-400 p-2 text-left font-bold">Type of Bill</th>
                  <th className="border-b border-gray-400 p-2 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border-r border-b border-gray-400 p-2">1</td>
                  <td className="border-r border-b border-gray-400 p-2">Service Fee Charge</td>
                  <td className="border-b border-gray-400 p-2 text-right font-semibold">
                    {formatCurrency(invoiceData.amount)}
                  </td>
                </tr>
                {invoiceData.total_paid > 0 && (
                  <tr className="bg-green-50">
                    <td className="border-r border-b border-gray-400 p-2">2</td>
                    <td className="border-r border-b border-gray-400 p-2">Amount Paid</td>
                    <td className="border-b border-gray-400 p-2 text-right font-semibold text-green-700">
                      -{formatCurrency(invoiceData.total_paid)}
                    </td>
                  </tr>
                )}
                <tr className="bg-gray-100 font-bold">
                  <td colSpan="2" className="border-r border-gray-400 p-2 text-right">
                    Grand Total (DUE):
                  </td>
                  <td className="border-gray-400 p-2 text-right">
                    {formatCurrency(dueAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payment Instructions */}
          <div className="mb-6 p-3 border border-gray-400 bg-gray-50 text-xs">
            <h4 className="font-bold mb-2">Mode of Payment:</h4>
            <ol className="space-y-1 list-decimal list-inside text-gray-700">
              <li>Contact management for account details</li>
              <li>Payment must be made before the due date</li>
              <li>Late payment charges may apply for overdue amounts</li>
              <li>Keep payment receipt for your records</li>
            </ol>
          </div>

          {/* Payment History (if paid) */}
          {invoiceData.total_paid > 0 && (
            <div className="mb-6 p-3 border border-blue-400 bg-blue-50 text-xs">
              <h4 className="font-bold mb-2 text-blue-900">Payment Record:</h4>
              <div className="space-y-1 text-blue-800">
                <div className="flex justify-between">
                  <span>Amount Paid:</span>
                  <span className="font-semibold">{formatCurrency(invoiceData.total_paid)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Date:</span>
                  <span className="font-semibold">{formatDate(invoiceData.payment_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Method:</span>
                  <span className="font-semibold">{invoiceData.payment_method || 'N/A'}</span>
                </div>
                {invoiceData.reference_number && (
                  <div className="flex justify-between">
                    <span>Reference:</span>
                    <span className="font-semibold">{invoiceData.reference_number}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Signature Section */}
          <div className="grid grid-cols-2 gap-8 mt-12 pt-8 border-t-2 border-gray-400 text-xs">
            <div className="text-center">
              <div className="h-10 border-b border-gray-400 mb-1"></div>
              <p className="font-bold">Prepared By</p>
              <p className="text-gray-600">{invoiceData.recorder_name || 'System'}</p>
            </div>
            <div className="text-center">
              <div className="h-10 border-b border-gray-400 mb-1"></div>
              <p className="font-bold">Authorized Signature</p>
              <p className="text-gray-600">Manager</p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-8 pt-4 border-t border-gray-300 text-xs text-gray-600">
            <p className="font-semibold">Estate Link Service Invoice System</p>
            <p>Generated on {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </ContentBox>
    </PageContainer>
  );
};

export default ServiceInvoiceWithHook;
