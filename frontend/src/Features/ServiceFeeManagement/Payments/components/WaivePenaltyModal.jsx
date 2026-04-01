import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { RxCross1 } from 'react-icons/rx';
import { FaExclamationTriangle, FaCheck } from 'react-icons/fa';
import calculateDaysOverdue from '../../utils/feeUtils';


const WaivePenaltyModal = ({ isOpen, onClose, onApply, paymentData, monthData, initialWaiver = null, initialWaiverIndex = null }) => {
  const [waiverType, setWaiverType] = useState(''); // 'full' or 'partial'
  const [partialType, setPartialType] = useState('percentage'); // 'percentage' or 'fixed'
  const [waiverPercentage, setWaiverPercentage] = useState(50);
  const [waiverAmount, setWaiverAmount] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  // Calculate values based on payment data
  let grossPenalty = parseFloat(monthData?.gross_penalty_amount || monthData?.penalty_amount || monthData?.penalty_fee || paymentData?.penalty_amount || paymentData?.penalty_fee || 0);

  // Calculate sum of OTHER existing waivers (excluding the one being edited)
  const otherWaiversSum = (monthData?.waiver_data || []).reduce((sum, w, idx) => {
    // Exclude the current waiver being edited using the reliable index
    if (initialWaiverIndex !== null && idx === initialWaiverIndex) return sum;

    // Fallback comparison if index is somehow missing but we have initialWaiver
    if (initialWaiverIndex === null && initialWaiver) {
      const isCurrent = (w.id && w.id === initialWaiver.id) ||
        (w.applied_at && w.applied_at === initialWaiver.applied_at) ||
        (w.appliedAt && w.appliedAt === initialWaiver.appliedAt);
      if (isCurrent) return sum;
    }

    // Handle both waived_amount (new format) and waivedAmount (old format)
    return sum + parseFloat(w.waived_amount || w.waivedAmount || 0);
  }, 0);

  // Available penalty is gross minus other waivers
  // This is the absolute limit for the current record
  const availablePenalty = Math.max(0, grossPenalty - otherWaiversSum);

  // ... (lines 36-84 unchanged)
  const originalAmount = parseFloat(monthData?.original_amount || paymentData?.original_amount || 0);
  const paidAmount = parseFloat(monthData?.paid_amount || paymentData?.paid_amount || 0);
  const dueAmount = parseFloat(monthData?.due_amount || paymentData?.due_amount || (originalAmount - paidAmount));

  const getBillingPeriod = () => {
    if (monthData?.service_period_month && monthData?.service_period_year) {
      const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
      const monthName = monthNames[monthData.service_period_month - 1];
      return `${monthName} ${monthData.service_period_year}`;
    }
    return '';
  };

  const billingPeriod = getBillingPeriod();

  const daysOverdueCount = monthData?.due_date
    ? calculateDaysOverdue(monthData.due_date)
    : (monthData?.days_overdue || paymentData?.days_overdue || 0);


  const daysOverdue = daysOverdueCount;


  const calculateWaivedAmount = () => {
    let amount = 0;
    if (waiverType === 'full') {
      amount = availablePenalty;
    } else {
      if (partialType === 'percentage') {
        amount = Math.round((grossPenalty * waiverPercentage) / 100);
      } else {
        amount = parseInt(waiverAmount) || 0;
      }
    }
    return Math.min(amount, availablePenalty);
  };

  const waivedAmount = calculateWaivedAmount();
  const remainingPenalty = Math.max(0, availablePenalty - waivedAmount);
  const newTotalDue = dueAmount + remainingPenalty;

  // Update waiver amount when percentage changes
  useEffect(() => {
    if (waiverType === 'partial' && partialType === 'percentage') {
      const calculated = Math.round((grossPenalty * waiverPercentage) / 100);
      // Cap at available to prevent user confusion
      const capped = Math.min(calculated, availablePenalty);
      setWaiverAmount(capped.toString());
    }
  }, [waiverPercentage, grossPenalty, waiverType, partialType, availablePenalty]);

  // Reset form when modal opens/closes or month changes
  useEffect(() => {
    if (isOpen) {
      const dataToLoad = initialWaiver || (Array.isArray(monthData?.waiver_data) && monthData.waiver_data.length > 0
        ? monthData.waiver_data[0]
        : null);

      if (dataToLoad) {
        setWaiverType(dataToLoad.waiverType || 'partial');
        setPartialType(dataToLoad.partialType || 'fixed');
        setWaiverPercentage(dataToLoad.waiverPercentage || dataToLoad.percentage || 50);
        // Handle both waived_amount (new) and waivedAmount (old) field names
        setWaiverAmount(dataToLoad.waivedAmount || dataToLoad.waived_amount ? Math.round(parseFloat(dataToLoad.waivedAmount || dataToLoad.waived_amount)) : '');
        setReason(dataToLoad.reason || '');
        setNotes(dataToLoad.notes || '');
      } else {
        setWaiverType('');
        setPartialType('percentage');
        setWaiverPercentage(50);
        setWaiverAmount('');
        setReason('');
        setNotes('');
      }
    }
  }, [isOpen, monthData, initialWaiver]);

  const handlePresetClick = (percentage) => {
    setWaiverPercentage(percentage);
  };

  const handlePercentageChange = (e) => {
    const value = parseInt(e.target.value) || 0;
    if (value >= 0 && value <= 100) {
      setWaiverPercentage(value);
    }
  };

  const handleAmountChange = (e) => {
    const value = parseInt(e.target.value) || 0;
    if (value >= 0 && value <= availablePenalty) {
      setWaiverAmount(value);
    }
  };

  const handleApply = () => {
    if (!reason.trim()) {
      alert('Please select a reason for the waiver');
      return;
    }

    const finalPercentage = waiverType === 'full'
      ? 100
      : (partialType === 'percentage' ? waiverPercentage : 0);

    const waiverData = {
      waiverType,
      partialType,
      waiverPercentage: finalPercentage,
      percentage: finalPercentage,
      waivedAmount,
      remainingPenalty,
      reason,
      notes,
      monthData,
      paymentData,
      id: initialWaiver?.id
    };

    onApply(waiverData);
  };

  if (!isOpen) return null;

  const waiverReasons = [
    'First-Time Offense',
    'Financial Hardship',
    'Payment History',
    'Administrative Error',
    'Goodwill Gesture',
    'Other'
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen p-4">
          <div
            className="bg-white rounded-[27px] shadow-xl w-full max-w-2xl relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition z-20"
            >
              <RxCross1 className="w-5 h-5" />
            </button>

            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <FaExclamationTriangle className="w-6 h-6 text-yellow-600" />
                <h2 className="text-2xl font-bold text-gray-900">Waive Penalty Fee</h2>
              </div>
              <p className="text-sm text-gray-600 ml-9">
                Configure penalty fee waiver for {billingPeriod}.
              </p>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Billing Period:</span>
                  <span className="text-sm font-semibold text-gray-900">{billingPeriod}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Original Amount:</span>
                  <span className="text-sm font-semibold text-gray-900">৳{originalAmount.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Days Overdue:</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {daysOverdue} days
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-sm font-medium text-gray-600">Total Month Penalty:</span>
                  <span className="text-sm font-semibold text-gray-900">৳{grossPenalty.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                {otherWaiversSum > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Other Waivers Applied:</span>
                    <span className="text-sm font-semibold text-red-600">-৳{otherWaiversSum.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1">
                  <span className="text-sm font-bold text-teal-700">Available to Waive:</span>
                  <span className="text-sm font-bold text-teal-700">৳{availablePenalty.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
              </div>

              {availablePenalty <= 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3 text-red-700">
                  <FaExclamationTriangle className="mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-bold">Penalty Limit Reached</p>
                    <p className="text-sm">The penalty has confirmed to be fully waived or paid. You cannot apply further waivers.</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Waiver Type</h3>

                <label className="flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50"
                  style={{
                    borderColor: waiverType === 'full' ? '#3C9D9B' : '#e5e7eb',
                    backgroundColor: waiverType === 'full' ? '#EBF5F5' : 'white'
                  }}
                >
                  <input
                    type="radio"
                    name="waiverType"
                    value="full"
                    checked={waiverType === 'full'}
                    onChange={(e) => setWaiverType(e.target.value)}
                    className="mt-1 w-5 h-5 text-primary focus:ring-primary"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-semibold text-gray-900">Full Waiver</span>
                      {waiverType === 'full' && (
                        <FaCheck className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Completely remove all penalty fees (৳{availablePenalty.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 relative"
                  style={{
                    borderColor: waiverType === 'partial' ? '#3C9D9B' : '#e5e7eb',
                    backgroundColor: waiverType === 'partial' ? '#EBF5F5' : 'white'
                  }}
                >
                  <input
                    type="radio"
                    name="waiverType"
                    value="partial"
                    checked={waiverType === 'partial'}
                    onChange={(e) => setWaiverType(e.target.value)}
                    className="mt-1 w-5 h-5 text-primary focus:ring-primary"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-semibold text-gray-900">Partial Waiver</span>
                      {waiverType === 'partial' && (
                        <FaCheck className="w-5 h-5 text-primary absolute top-4 right-4" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Waive a specific amount or percentage of the penalty
                    </p>
                  </div>
                </label>

                {waiverType === 'partial' && (
                  <div className="ml-9 mt-4 space-y-4 p-4 bg-white border border-gray-200 rounded-lg">
                    <div className="flex gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => setPartialType('percentage')}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${partialType === 'percentage'
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                      >
                        % Percentage
                      </button>
                      <button
                        type="button"
                        onClick={() => setPartialType('fixed')}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${partialType === 'fixed'
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                      >
                        $ Fixed Amount
                      </button>
                    </div>

                    {partialType === 'percentage' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Waiver Percentage
                          </label>
                          <div className="flex gap-2">
                            {[25, 50, 75, 100].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => handlePresetClick(preset)}
                                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${waiverPercentage === preset
                                  ? 'bg-primary text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                              >
                                {preset}%
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-gray-200">
                          <p className="text-sm text-gray-600">
                            = <span className="font-semibold text-gray-900">৳{waivedAmount.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} waived</span>
                          </p>
                        </div>
                      </div>
                    )}

                    {partialType === 'fixed' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Waiver Amount (৳)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={availablePenalty}
                            value={waiverAmount}
                            onChange={handleAmountChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Maximum: ৳{availablePenalty.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-semibold text-blue-900 mb-3">Waiver Impact</h4>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Penalty to be waived:</span>
                  <span className="text-sm font-semibold text-red-600">-৳{waivedAmount.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Remaining penalty:</span>
                  <span className="text-sm font-semibold text-gray-900">৳{remainingPenalty.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                  <span className="text-sm font-semibold text-gray-900">New total due:</span>
                  <span className="text-base font-bold text-gray-900">৳{newTotalDue.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Waiver <span className="text-red-500">*</span>
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  required
                >
                  <option value="">Select a reason...</option>
                  {waiverReasons.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Add any additional context or details about this waiver..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FaExclamationTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1 text-sm text-yellow-800">
                    <p className="font-semibold">Important Information</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>This action will be logged for audit purposes</li>
                      <li>Waived amount cannot be reinstated</li>
                      <li>Resident will be notified of the waiver</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!reason.trim() || availablePenalty <= 0}
                className="px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primaryHover transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaCheck className="w-4 h-4" />
                Apply Waiver
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

WaivePenaltyModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onApply: PropTypes.func.isRequired,
  paymentData: PropTypes.object,
  monthData: PropTypes.object,
  initialWaiver: PropTypes.object,
  initialWaiverIndex: PropTypes.number
};

export default WaivePenaltyModal;
