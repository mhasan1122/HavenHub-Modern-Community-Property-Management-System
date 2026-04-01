import PropTypes from 'prop-types';
import { RxCross1 } from 'react-icons/rx';
import { FaExclamationTriangle } from 'react-icons/fa';

const DeleteReminderModal = ({ isOpen, onClose, onConfirm, reminderData }) => {
  if (!isOpen || !reminderData) return null;

  const handleConfirm = () => {
    onConfirm(reminderData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md relative">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute -top-2 -right-2 p-2 rounded-full bg-primary text-white shadow-md hover:bg-primaryHover transition z-20"
          >
            <RxCross1 />
          </button>

          {/* Modal Header */}
          <div className="p-6 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <FaExclamationTriangle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete Reminder</h2>
            <p className="text-sm text-gray-500">
              Are you sure you want to delete this reminder? This action cannot be undone.
            </p>
          </div>

          {/* Reminder Details */}
          <div className="px-6 pb-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">
                {reminderData.reminderType || 'Reminder'}
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-medium">Send When:</span> {reminderData.sendWhen || 'N/A'}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Audience:</span> {reminderData.audience || 'N/A'}
              </p>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 pb-6 flex justify-end space-x-4">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

DeleteReminderModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  reminderData: PropTypes.object
};

export default DeleteReminderModal;