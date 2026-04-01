import { FaTimes, FaHistory, FaClock } from 'react-icons/fa';

/**
 * NoticeHistoryModal Component
 * Shows the edit history of a notice
 */
const NoticeHistoryModal = ({ notice, onClose }) => {
  const formatDateTime = (dateTime) => {
    if (!dateTime) return '';
    
    const date = new Date(dateTime);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatChanges = (changes) => {
    if (!changes || typeof changes !== 'object') return [];
    
    const changesList = [];
    
    Object.entries(changes).forEach(([field, change]) => {
      if (change && typeof change === 'object' && 'old' in change && 'new' in change) {
        changesList.push({
          field: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          oldValue: change.old,
          newValue: change.new
        });
      }
    });
    
    return changesList;
  };

  const renderChangeValue = (value) => {
    if (value === null || value === undefined) return 'None';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <FaHistory className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                Notice History
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 truncate">
                {notice.internalTitle || `Notice #${notice.id}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0 ml-2"
          >
            <FaTimes className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Creation Info */}
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
              <span className="font-medium text-sm sm:text-base text-green-800">Notice Created</span>
            </div>
            <div className="text-xs sm:text-sm text-green-700">
              <div className="flex items-center gap-2">
                <FaClock className="w-3 h-3 flex-shrink-0" />
                <span>{formatDateTime(notice.createdAt || notice.created_at)}</span>
              </div>
              <div className="mt-1">
                Created by: <span className="font-medium">{notice.creatorName || notice.creator_name}</span>
              </div>
            </div>
          </div>

          {/* Edit History */}
          {notice.editHistory && notice.editHistory.length > 0 ? (
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4">Edit History</h3>
              
              {notice.editHistory.map((historyEntry, index) => {
                const changes = formatChanges(historyEntry.changes);
                
                return (
                  <div key={index} className="p-3 sm:p-4 border border-gray-200 rounded-lg">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-2 mb-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0 mt-1 sm:mt-0"></div>
                      <span className="font-medium text-sm sm:text-base text-gray-900">
                        Edited by {historyEntry.editedBy}
                      </span>
                      <span className="text-xs sm:text-sm text-gray-500">
                        {formatDateTime(historyEntry.timestamp)}
                      </span>
                    </div>
                    
                    {changes.length > 0 ? (
                      <div className="space-y-2 sm:space-y-3">
                        {changes.map((change, changeIndex) => (
                          <div key={changeIndex} className="text-xs sm:text-sm">
                            <div className="font-medium text-gray-700 mb-1">
                              {change.field}:
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 sm:ml-4">
                              <div>
                                <span className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">From:</span>
                                <div className="p-2 bg-red-50 border border-red-200 rounded text-red-800 break-words">
                                  {renderChangeValue(change.oldValue)}
                                </div>
                              </div>
                              <div>
                                <span className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">To:</span>
                                <div className="p-2 bg-green-50 border border-green-200 rounded text-green-800 break-words">
                                  {renderChangeValue(change.newValue)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs sm:text-sm text-gray-500 italic">
                        No specific changes recorded
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8">
              <FaHistory className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No Edit History</h3>
              <p className="text-sm text-gray-500">
                This notice has not been edited since it was created.
              </p>
            </div>
          )}

          {/* Current Status */}
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="font-medium text-sm sm:text-base text-gray-900 mb-2 sm:mb-3">Current Status</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
              <div>
                <span className="text-gray-600">Status:</span>
                <span className="ml-2 font-medium capitalize">{notice.status}</span>
              </div>
              <div>
                <span className="text-gray-600">Priority:</span>
                <span className="ml-2 font-medium capitalize">{notice.priority}</span>
              </div>
              <div>
                <span className="text-gray-600">Views:</span>
                <span className="ml-2 font-medium">{notice.views || 0}</span>
              </div>
              <div>
                <span className="text-gray-600">Pinned:</span>
                <span className="ml-2 font-medium">{notice.isPinned ? 'Yes' : 'No'}</span>
              </div>
              <div>
                <span className="text-gray-600">Images:</span>
                <span className="ml-2 font-medium">{notice.attachments?.length || 0}</span>
              </div>
              <div>
                <span className="text-gray-600">Last Updated:</span>
                <span className="ml-2 font-medium">{formatDateTime(notice.updatedAt || notice.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 sm:px-6 py-2 sm:py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm sm:text-base"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoticeHistoryModal;
