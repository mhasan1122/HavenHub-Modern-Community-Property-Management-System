import { useState, useEffect } from 'react';
import { RxCross1 } from 'react-icons/rx';
import { FaPlus } from 'react-icons/fa';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { fetchFilterOptions } from '../../../redux/slices/api/serviceFeeManagement/serviceFeeManagementApi';

const GenerateServiceFeeModal = ({ isOpen, onClose, onGenerate, loading = false }) => {
  const dispatch = useDispatch();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  // Get available service fees from Redux
  const { filterOptions } = useSelector(state => state.serviceFeeManagement);
  const [serviceFees, setServiceFees] = useState([]);
  
  const [formData, setFormData] = useState({
    service_fee_id: '', // Empty means "All Service Fees"
    year: currentYear,
    month: currentMonth
  });

  // Fetch service fees when modal opens
  useEffect(() => {
    if (isOpen) {
      dispatch(fetchFilterOptions());
    }
  }, [isOpen, dispatch]);

  // Extract service fees from filter options
  useEffect(() => {
    // Get service fees from the API response
    // Assuming the API returns service fees in some format
    // You may need to adjust this based on your actual API structure
    if (filterOptions) {
      // For now, we'll create a placeholder
      // You'll need to add an API endpoint to fetch service fees
      setServiceFees([
        { id: 1, name: 'Monthly Service Fee' },
        { id: 2, name: 'Utility Fee' },
        { id: 3, name: 'Parking Fee' },
        { id: 4, name: 'Security Fee' }
      ]);
    }
  }, [filterOptions]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'service_fee_id' ? (value === '' ? '' : parseInt(value)) : (parseInt(value) || value)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Don't send service_fee_id if it's empty (means all service fees)
    const dataToSend = {
      year: formData.year,
      month: formData.month
    };
    
    if (formData.service_fee_id !== '') {
      dataToSend.service_fee_id = formData.service_fee_id;
    }
    
    onGenerate(dataToSend);
  };

  if (!isOpen) return null;

  // Generate year options (current year and next 2 years)
  const yearOptions = [currentYear, currentYear + 1, currentYear + 2];

  // Month options
  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md relative">
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute -top-2 -right-2 p-2 rounded-full bg-primary text-white shadow-md hover:bg-primaryHover transition z-20"
              disabled={loading}
            >
              <RxCross1 />
            </button>

            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Generate Service Fee</h2>
              <p className="text-xs text-gray-500 mt-1">
                Generate service fees for all active service fees and occupied units
              </p>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleSubmit} className="p-4">
              <div className="space-y-4">
                {/* Year Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Year <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="year"
                    value={formData.year}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    {yearOptions.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                {/* Month Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Month <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="month"
                    value={formData.month}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    {months.map(month => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Info Message */}
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-xs text-blue-700">
                    <strong>Note:</strong> This will generate service fee records for all active service fees 
                    and occupied units for the selected month. Duplicate entries will be automatically skipped.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 text-sm bg-primary text-white rounded-md hover:bg-primaryHover transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaPlus className="w-4 h-4" />
                  {loading ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

GenerateServiceFeeModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onGenerate: PropTypes.func.isRequired,
  loading: PropTypes.bool
};

export default GenerateServiceFeeModal;
