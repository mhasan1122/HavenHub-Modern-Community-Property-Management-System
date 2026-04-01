import { useState } from 'react';
import PropTypes from 'prop-types';
import { IoClose } from 'react-icons/io5';
import { BsCalendar } from 'react-icons/bs';

const ReceivePaymentModal = ({ isOpen, onClose, payment }) => {
  const [cashAmount, setCashAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  if (!isOpen || !payment) return null;

  // Get current month and year for header
  const getCurrentMonthYear = () => {
    const today = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    return `${monthNames[today.getMonth()]} ${today.getFullYear()}`;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (cashAmount) {
      // TODO: Implement payment processing logic
      alert(`Payment of ${cashAmount} BDT received for ${payment.tower_name} - Unit ${payment.unit_display} on ${paymentDate}`);
      setCashAmount('');
      setPaymentDate(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
      });
      onClose();
    }
  };

  const handleCancel = () => {
    setCashAmount('');
    setPaymentDate(() => {
      const today = new Date();
      const year = today.getFullYear();
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      const day = today.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Service Fee List</h2>
            <p className="text-sm text-gray-600">{getCurrentMonthYear()}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <IoClose size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Payment Info */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Name:</span>
              <div className="font-medium">Mst. Sumaiya Akter</div>
            </div>
            <div>
              <span className="text-gray-600">Contact Number:</span>
              <div className="font-medium">01780963872</div>
            </div>
            <div>
              <span className="text-gray-600">Unit:</span>
              <div className="font-medium">{payment.unit}</div>
            </div>
            <div>
              <span className="text-gray-600">Tower:</span>
              <div className="font-medium">{payment.tower}</div>
            </div>
            <div>
              <span className="text-gray-600">Fee Amount (BDT):</span>
              <div className="font-medium">{payment.fee_amount || payment.original_amount || payment.service_fee_amount || payment.amount}</div>
            </div>
            <div>
              <span className="text-gray-600">Due Date:</span>
              <div className="font-medium">{payment.dueDate}</div>
            </div>
          </div>

          {/* Payment Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Payment Date */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Payment Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  inputMode="none"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3D9D9B] focus:border-[#3D9D9B] pr-10"
                />
                <BsCalendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Receive Cash Payment Amount
              </label>
              <input
                type="number"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                placeholder="enter cash payment amount..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3D9D9B] focus:border-[#3D9D9B]"
                required
              />
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primaryHover transition-colors"
              >
                Confirm
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

ReceivePaymentModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  payment: PropTypes.object,
};

export default ReceivePaymentModal;
