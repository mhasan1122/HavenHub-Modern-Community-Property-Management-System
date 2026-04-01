import PropTypes from 'prop-types';
import { IoClose } from 'react-icons/io5';
import { BiDownload } from 'react-icons/bi';
import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { fetchPaymentHistory } from '../../../../redux/slices/api/serviceFeeManagement/serviceFeeManagementApi';

const PaymentHistoryModal = ({ isOpen, onClose, payment }) => {
  const dispatch = useDispatch();
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && payment) {
      console.log('📂 Payment History Modal opened for:', {
        unit_id: payment.unit_id,
        service_fee_id: payment.service_fee_id,
        unit_display: payment.unit_display,
        tower_name: payment.tower_name
      });

      // Fetch payment history when modal opens
      const loadPaymentHistory = async () => {
        setIsLoading(true);
        try {
          console.log('🔄 Fetching payment history...');
          const result = await dispatch(fetchPaymentHistory({
            unit_id: payment.unit_id,
            service_fee_id: payment.service_fee_id,
            service_period_month: payment.service_period_month,
            service_period_year: payment.service_period_year
          })).unwrap();

          console.log('✅ Payment history loaded:', result);
          setPaymentHistory(result || []);
        } catch (error) {
          console.error('❌ Error loading payment history:', error);
          setPaymentHistory([]);
        } finally {
          setIsLoading(false);
        }
      };

      loadPaymentHistory();
    }
  }, [isOpen, payment, dispatch]);

  // Handle PDF download
  const handleDownloadPDF = () => {
    console.log('📄 Download PDF clicked');
    window.print();
  };

  if (!isOpen || !payment) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 print:p-0 print:bg-white print:static print:block">
      <style type="text/css" media="print">
        {`
          @page { size: auto; margin: 20mm; }
          body { visibility: hidden; }
          .payment-history-modal-content {
            visibility: visible;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            z-index: 9999;
            background: white;
            margin: 0 !important;
            padding: 0 !important;
          }
          .payment-history-modal-content * {
            visibility: visible;
          }
        `}
      </style>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col relative overflow-visible payment-history-modal-content print:shadow-none print:max-w-none print:w-full print:h-auto print:max-h-none print:rounded-none print:m-0">

        {/* Close Button - Positioned outside */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 md:-right-4 md:-top-4 bg-[#3D9D9B] text-white p-1.5 rounded-full shadow-lg hover:bg-[#2a7a78] transition-colors z-50 print:hidden"
          title="Close"
        >
          <IoClose size={20} />
        </button>

        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-[#3D9D9B]">History</h2>
          <div className="flex items-center space-x-3 print:hidden">
            <button
              onClick={handleDownloadPDF}
              className="p-2 hover:bg-teal-50 rounded-full transition-colors"
              title="Download PDF"
            >
              <BiDownload size={20} className="text-[#3D9D9B]" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Basic Details */}
          <div className="px-6 py-5 border-b border-gray-200">
            <h3 className="text-base font-semibold text-[#3D9D9B] mb-4">Basic Detail</h3>
            <div className="grid grid-cols-3 gap-x-8 gap-y-3 text-sm">
              <div>
                <div className="text-gray-600 mb-1">Name:</div>
                <div className="font-medium text-gray-900">{payment.primary_name || 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-600 mb-1">Role:</div>
                <div className="font-medium text-gray-900">Residents</div>
              </div>
              <div>
                <div className="text-gray-600 mb-1">Contact Number:</div>
                <div className="font-medium text-gray-900">{payment.primary_number || 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-600 mb-1">E-Mail:</div>
                <div className="font-medium text-gray-900">{payment.primary_email || 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-600 mb-1">Tower:</div>
                <div className="font-medium text-gray-900">{payment.tower_name || 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-600 mb-1">Unit:</div>
                <div className="font-medium text-gray-900">{payment.unit_display || 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Payment Status */}
          <div className="px-6 py-5">
            <h3 className="text-base font-semibold text-[#3D9D9B] mb-4">Payment Status</h3>

            {isLoading ? (
              <div className="text-center py-8">
                <div className="text-gray-500">Loading payment history...</div>
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500">No payment history found</div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Common Header Section - Displayed Once */}
                {(() => {
                  const firstItem = paymentHistory[0];
                  const monthNames = ["January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"];
                  const monthDisplay = firstItem.service_period_month
                    ? monthNames[firstItem.service_period_month - 1]
                    : 'N/A';
                  const baseAmount = parseFloat(firstItem.service_fee_amount || firstItem.original_amount || 0);
                  const penaltyAmount = parseFloat(firstItem.penalty_amount || 0); // Net penalty
                  const grossPenalty = parseFloat(firstItem.gross_penalty_amount || firstItem.grossPenalty || firstItem.penalty_amount || 0);
                  const waivedAmount = parseFloat(firstItem.waived_amount || 0);
                  const totalPaidEver = parseFloat(firstItem.paid_amount || 0);

                  // Total Bill = Base + (Gross Penalty) - Waived
                  const totalBill = baseAmount + grossPenalty - waivedAmount;
                  const currentStatus = firstItem.service_status || 'due';

                  const getStatusColor = (status) => {
                    switch (status.toLowerCase()) {
                      case 'paid': return 'text-emerald-600';
                      case 'partial': return 'text-amber-500';
                      case 'overdue': return 'text-red-500';
                      default: return 'text-gray-900';
                    }
                  };

                  return (
                    <div className="mb-6 bg-slate-50 rounded-xl p-5 border border-slate-100">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                        <div>
                          <div className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Base Fee</div>
                          <div className="font-bold text-gray-900">৳{baseAmount.toFixed(0)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Gross Penalty</div>
                          <div className="font-bold text-red-500">৳{grossPenalty.toFixed(0)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Waived</div>
                          <div className="font-bold text-emerald-600">৳{waivedAmount.toFixed(0)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Net Paid</div>
                          <div className={`font-black uppercase tracking-tight ${getStatusColor(currentStatus)}`}>
                            {currentStatus}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Payment Transactions List */}
                {paymentHistory.map((historyItem, index) => {
                  // Format payment date
                  let paymentDateTime = 'N/A';
                  if (historyItem.payment_date) {
                    const date = new Date(historyItem.payment_date);
                    paymentDateTime = date.toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    });
                  }

                  return (
                    <div key={historyItem.id} className="space-y-4">
                      {/* Payment Details - Always show */}
                      <div className="pl-0">
                        <h4 className="font-semibold text-gray-900 mb-3 text-sm">
                          {index === 0 ? '1st' : index === 1 ? '2nd' : index === 2 ? '3rd' : `${index + 1}th`} payment Detail
                        </h4>

                        <div className="grid grid-cols-3 gap-x-8 gap-y-3 text-sm">
                          <div>
                            <div className="text-gray-600 mb-1">Payment Method:</div>
                            <div className="font-medium text-gray-900">{historyItem.payment_method || 'N/A'}</div>
                          </div>
                          <div>
                            <div className="text-gray-600 mb-1">Payment Amount (BDT):</div>
                            <div className="font-medium text-gray-900">{historyItem.total_paid || historyItem.amount || '0'}</div>
                          </div>
                          <div>
                            <div className="text-gray-600 mb-1">Payment Date & Time:</div>
                            <div className="font-medium text-gray-900">{paymentDateTime}</div>
                          </div>
                        </div>

                        {/* Cash Payment Details */}
                        {historyItem.payment_method === 'Cash' && (
                          <div className="mt-3 text-sm">
                            <div className="text-gray-600 mb-1">Payment Received By:</div>
                            <div className="font-medium text-gray-900">{historyItem.received_by || 'N/A'}</div>
                          </div>
                        )}

                        {/* bKash Payment Details */}
                        {historyItem.payment_method === 'bKash' && (
                          <div className="mt-3 space-y-3 text-sm">
                            <div>
                              <div className="text-gray-600 mb-1">Transaction Id:</div>
                              <div className="font-medium text-gray-900">{historyItem.transaction_id || 'N/A'}</div>
                            </div>
                          </div>
                        )}

                        {/* Bank Payment Details */}
                        {historyItem.payment_method === 'Bank' && (
                          <div className="mt-3 space-y-3 text-sm">
                            <div>
                              <div className="text-gray-600 mb-1">Transaction Id:</div>
                              <div className="font-medium text-gray-900">{historyItem.transaction_id || 'N/A'}</div>
                            </div>
                            <div>
                              <div className="text-gray-600 mb-1">Reference Number:</div>
                              <div className="font-medium text-gray-900">{historyItem.reference_number || 'N/A'}</div>
                            </div>
                          </div>
                        )}

                        {/* Notes if available */}
                        {/* {historyItem.notes && (
                          <div className="mt-3 text-sm">
                            <div className="text-gray-600 mb-1">Notes:</div>
                            <div className="font-medium text-gray-900">{historyItem.notes}</div>
                          </div>
                        )} */}
                      </div>

                      {/* Divider between payment entries (except last one) */}
                      {index < paymentHistory.length - 1 && (
                        <div className="border-b border-gray-200 pt-2"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

PaymentHistoryModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  payment: PropTypes.object,
};

export default PaymentHistoryModal;
