import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaPrint, FaDownload, FaArrowLeft } from 'react-icons/fa';
import ModernLoadingAnimation from '../../../../../Components/Loaders/ModernLoadingAnimation';
import PageContainer from '../../../../../Components/Ui/PageContainer';
import ContentBox from '../../../../../Components/Ui/ContentBox';
import Button from '../../../../../Components/FormComponent/ButtonComponent/Button';
import axiosInstance from '../../../../../utils/axiosInstance';
import html2pdf from 'html2pdf.js';


const ServiceInvoice = () => {
  const { unitId, serviceFeeId, month, year } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invoiceData, setInvoiceData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInvoiceData = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get(
          `/api/service-fee-management/payment-history/`,
          {
            params: {
              unit_id: unitId,
              service_fee_id: serviceFeeId,
              service_period_month: month,
              service_period_year: year
            }
          }
        );

        if (response.data.success && response.data.data.length > 0) {
          setInvoiceData(response.data.data[0]);
          setError(null);
        } else {
          setError('No invoice data found');
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch invoice data');
        console.error('Invoice fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (unitId && serviceFeeId && month && year) {
      fetchInvoiceData();
    }
  }, [unitId, serviceFeeId, month, year]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!invoiceData) return;

    const element = document.getElementById('invoice-content');
    const fileName = `Invoice_${invoiceData.unit_name || 'Unit'}_${getMonthName(invoiceData.service_period_month)}_${invoiceData.service_period_year}.pdf`;

    const opt = {
      margin: [10, 10],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      await html2pdf().from(element).set(opt).save();
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF. Please try printing instead.');
    }
  };


  const formatCurrency = (value) => {
    const num = parseFloat(value) || 0;
    return `৳ ${num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ModernLoadingAnimation />
      </div>
    );
  }

  if (error || !invoiceData) {
    return (
      <PageContainer>
        <ContentBox>
          <div className="text-center py-12">
            <p className="text-red-600 text-lg font-semibold mb-4">{error || 'No invoice data available'}</p>
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
  const issueDate = paymentDate ? `${String(paymentDate.getDate()).padStart(2, '0')}.${String(paymentDate.getMonth() + 1).padStart(2, '0')}.${String(paymentDate.getFullYear()).slice(-2)}` : 'N/A';

  return (
    <PageContainer>
      <ContentBox>
        {/* Header with Print/Download Buttons */}
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
            />
            <Button
              icon={FaDownload}
              variant="download"
              onClick={handleDownloadPDF}
              tooltip="Download PDF"
            />
          </div>
        </div>

        {/* Invoice Container */}
        <div id="invoice-content" className="max-w-4xl mx-auto bg-white border-2 border-gray-300 p-8 print:border-0 print:p-0">


          {/* Header Section */}
          <div className="text-center border-b-2 border-gray-400 pb-6 mb-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                LOGO
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">SERVICE INVOICE</h1>
            <p className="text-gray-600">For the month of {monthName}-{String(invoiceYear).slice(-2)}</p>
          </div>

          {/* Invoice Reference Information */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            {/* Left Column - Reference Info */}
            <div className="border border-gray-400">
              <div className="grid grid-cols-2 gap-0">
                <div className="border-r border-b border-gray-400 p-3 bg-gray-50 font-semibold text-sm">
                  Ref:
                </div>
                <div className="border-b border-gray-400 p-3 text-sm">
                  {invoiceData.transaction_id || 'N/A'}
                </div>
                <div className="border-r border-b border-gray-400 p-3 bg-gray-50 font-semibold text-sm">
                  Service Period:
                </div>
                <div className="border-b border-gray-400 p-3 text-sm">
                  {monthName}-{String(invoiceYear).slice(-2)}
                </div>
                <div className="border-r border-b border-gray-400 p-3 bg-gray-50 font-semibold text-sm">
                  Issue Date:
                </div>
                <div className="border-b border-gray-400 p-3 text-sm">
                  {issueDate}
                </div>
                <div className="border-r border-gray-400 p-3 bg-gray-50 font-semibold text-sm">
                  Payment Status:
                </div>
                <div className="p-3 text-sm">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${invoiceData.service_status === 'paid' ? 'bg-green-100 text-green-800' :
                    invoiceData.service_status === 'partial' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                    {invoiceData.service_status?.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column - Unit Info */}
            <div className="border border-gray-400">
              <div className="grid grid-cols-2 gap-0">
                <div className="border-r border-b border-gray-400 p-3 bg-gray-50 font-semibold text-sm">
                  Unit No:
                </div>
                <div className="border-b border-gray-400 p-3 text-sm">
                  {invoiceData.unit_name || 'N/A'}
                </div>
                <div className="border-r border-b border-gray-400 p-3 bg-gray-50 font-semibold text-sm">
                  Tower:
                </div>
                <div className="border-b border-gray-400 p-3 text-sm">
                  {invoiceData.tower_name || 'N/A'}
                </div>
                <div className="border-r border-gray-400 p-3 bg-gray-50 font-semibold text-sm">
                  Unit ID:
                </div>
                <div className="p-3 text-sm">
                  {invoiceData.unit_id || 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Owner/Tenant Information */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            {/* Owner Section */}
            <div className="border border-gray-400">
              <div className="bg-gray-200 p-3 font-bold text-sm border-b border-gray-400">
                Details of Owner
              </div>
              <div className="p-4 text-sm space-y-2">
                <div className="flex justify-between border-b border-gray-300 pb-2">
                  <span className="font-semibold">Name:</span>
                  <span>{invoiceData.resident_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between border-b border-gray-300 pb-2">
                  <span className="font-semibold">Mobile:</span>
                  <span>{invoiceData.resident_number || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Email:</span>
                  <span className="text-right break-words">{invoiceData.resident_email || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Tenant Section */}
            <div className="border border-gray-400">
              <div className="bg-gray-200 p-3 font-bold text-sm border-b border-gray-400">
                Details of Tenant
              </div>
              <div className="p-4 text-sm space-y-2">
                <div className="flex justify-between border-b border-gray-300 pb-2">
                  <span className="font-semibold">Name:</span>
                  <span>N/A</span>
                </div>
                <div className="flex justify-between border-b border-gray-300 pb-2">
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
          <div className="mb-8">
            <table className="w-full border-collapse border border-gray-400">
              <thead className="bg-gray-200">
                <tr>
                  <th className="border border-gray-400 p-3 text-left text-sm font-bold">SL</th>
                  <th className="border border-gray-400 p-3 text-left text-sm font-bold">Type of Bill</th>
                  <th className="border border-gray-400 p-3 text-right text-sm font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-400 p-3 text-sm">1</td>
                  <td className="border border-gray-400 p-3 text-sm">Service Fee Charge</td>
                  <td className="border border-gray-400 p-3 text-right text-sm font-semibold">
                    {formatCurrency(invoiceData.amount)}
                  </td>
                </tr>
                {invoiceData.total_paid > 0 && (
                  <tr className="bg-green-50">
                    <td className="border border-gray-400 p-3 text-sm">2</td>
                    <td className="border border-gray-400 p-3 text-sm">Amount Paid</td>
                    <td className="border border-gray-400 p-3 text-right text-sm font-semibold text-green-700">
                      -{formatCurrency(invoiceData.total_paid)}
                    </td>
                  </tr>
                )}
                <tr className="bg-gray-100 font-bold">
                  <td colSpan="2" className="border border-gray-400 p-3 text-sm text-right">
                    Grand Total (DUE):
                  </td>
                  <td className="border border-gray-400 p-3 text-right text-sm">
                    {formatCurrency(invoiceData.amount - invoiceData.total_paid)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payment Notes Section */}
          <div className="mb-8 p-4 border border-gray-400 bg-gray-50">
            <h3 className="font-bold text-sm mb-3">Payment Instructions:</h3>
            <ol className="text-xs space-y-1 list-decimal list-inside text-gray-700">
              <li>Payment should be made before the last date of the month</li>
              <li>Please contact management for payment details</li>
              <li>In case of payment delay, late charges may be applied</li>
              <li>Ensure you keep the receipt for your records</li>
            </ol>
          </div>

          {/* Payment History */}
          {invoiceData.total_paid > 0 && (
            <div className="mb-8 p-4 border border-gray-400 bg-blue-50">
              <h3 className="font-bold text-sm mb-3">Payment History:</h3>
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span>Amount Paid:</span>
                  <span className="font-semibold">{formatCurrency(invoiceData.total_paid)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Date:</span>
                  <span className="font-semibold">{formatDate(invoiceData.payment_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Method:</span>
                  <span className="font-semibold">{invoiceData.payment_method || 'N/A'}</span>
                </div>
                {invoiceData.transaction_id && (
                  <div className="flex justify-between">
                    <span>Transaction ID:</span>
                    <span className="font-semibold">{invoiceData.transaction_id}</span>
                  </div>
                )}
                {invoiceData.notes && (
                  <div className="flex justify-between">
                    <span>Notes:</span>
                    <span className="font-semibold text-right">{invoiceData.notes}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Signature Section */}
          <div className="grid grid-cols-2 gap-8 mt-12 pt-8 border-t border-gray-400">
            <div className="text-center">
              <div className="h-12 border-b border-gray-400 mb-2"></div>
              <p className="text-xs font-semibold">Prepared By</p>
              <p className="text-xs text-gray-600">{invoiceData.recorder_name || 'System'}</p>
            </div>
            <div className="text-center">
              <div className="h-12 border-b border-gray-400 mb-2"></div>
              <p className="text-xs font-semibold">Authorized Signature</p>
              <p className="text-xs text-gray-600">Manager/Administrator</p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-8 pt-4 border-t border-gray-300 text-xs text-gray-600">
            <p>Generated by Estate Link System</p>
            <p>This is an official service invoice</p>
          </div>
        </div>
      </ContentBox>
    </PageContainer>
  );
};

export default ServiceInvoice;
