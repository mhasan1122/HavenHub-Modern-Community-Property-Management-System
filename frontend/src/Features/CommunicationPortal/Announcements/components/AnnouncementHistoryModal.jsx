import React, { useMemo } from 'react';
import { FaTimes } from 'react-icons/fa';
import AnnouncementPreview from './AnnouncementPreview';

// Helper functions moved outside component for stability
const formatName = (f) => f.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const formatValue = (v) => {
  if (v === null || v === undefined) return 'None';
  if (typeof v === 'object' && v.str) return v.str;
  if (typeof v === 'object' && v.full_name) return v.full_name;
  return String(v);
};

// Helper for date formatting
const formatDate = (dateInput) => {
  const date = new Date(dateInput);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const period = hours >= 12 ? 'pm' : 'am';
  return `${day}-${month}-${year} at ${hour12}:${minutes}${period}`;
};

const AnnouncementHistoryModal = ({ isOpen, onClose, announcement, currentUser }) => {
  // Memoize history calculation - must be called before any early returns
  const history = useMemo(() => {
    if (!announcement) return [];

    const result = [];

    // 1. Get edit history from announcement.editHistory (mapped from backend 'history' in API)
    if (announcement.editHistory && Array.isArray(announcement.editHistory)) {
      announcement.editHistory.forEach((edit, index) => {
        result.push({
          id: `edit-h-${edit.timestamp}-${index}`,
          type: 'Edit',
          action: 'Edited by',
          user: edit.editedBy || 'Unknown User',
          timestamp: edit.timestamp,
          date: formatDate(edit.timestamp),
          changes: edit.changes || {}
        });
      });
    }

    // 2. Get history from announcement.history (backend direct format) if editHistory is empty
    if (result.length === 0 && announcement.history && Array.isArray(announcement.history)) {
      announcement.history.forEach((edit, index) => {
        result.push({
          id: `edit-b-${edit.edited_at}-${index}`,
          type: 'Edit',
          action: 'Edited by',
          user: edit.edited_by_name || 'Unknown User',
          timestamp: edit.edited_at,
          date: formatDate(edit.edited_at),
          changes: edit.changes || {}
        });
      });
    }

    // 3. Creation entry
    if (announcement.createdAt) {
      result.push({
        id: `creation-${announcement.id}`,
        type: 'Creation',
        action: 'Created by',
        user: announcement.author || announcement.creatorName || 'Unknown User',
        timestamp: announcement.createdAt,
        date: formatDate(announcement.createdAt),
        color: '#3D9D9B'
      });
    }

    // Sort descending by timestamp
    return result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [announcement]);

  // Handle escape key - must be called before any early returns
  React.useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Early return after all hooks are called
  if (!isOpen || !announcement) return null;

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white relative flex flex-col lg:flex-row overflow-hidden w-full lg:w-[796px] h-full lg:h-[660px] max-w-full lg:max-w-[90vw] max-h-full lg:max-h-[90vh] rounded-lg lg:rounded-[27px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-2 sm:top-4 right-2 sm:right-4 w-7 h-7 sm:w-8 sm:h-8 bg-primary hover:bg-[#2A7A78] rounded-full flex items-center justify-center text-white z-10 transition-colors"
        >
          <FaTimes className="w-3 h-3 sm:w-4 sm:h-4" />
        </button>

        {/* Left Side - Preview */}
        <div className="w-full lg:w-1/2 p-4 sm:p-6 border-b-2 lg:border-b-0 lg:border-r-2 border-gray-200 overflow-y-auto max-h-[40vh] lg:max-h-none">
          <div className="h-full">
            <AnnouncementPreview
              data={{
                title: announcement.title,
                description: announcement.description,
                authorName: announcement.author,
                creatorName: announcement.creatorName,
                postAs: announcement.postAs || 'Creator',
                priority: announcement.priority,
                label: announcement.label,
                startDate: announcement.startDate,
                startTime: announcement.startTime,
                endDate: announcement.endDate,
                endTime: announcement.endTime,
                attachments: announcement.attachments ? announcement.attachments.map(att => ({
                  preview: att.file_url || att.url || att.preview || att,
                  name: att.file_name || att.name || 'Attachment',
                  url: att.file_url || att.url || att.preview || att,
                  type: att.file_type || att.type
                })) : [],
                labels: announcement.labels || [],
                towers: announcement.towers || [],
                units: announcement.units || [],
                selectedUnits: announcement.target_units_data?.map(unit => unit.id) || [],
                target_units_data: announcement.target_units_data || []
              }}
              currentUser={currentUser}
              isInModal={true}
            />
          </div>
        </div>

        {/* Right Side - History */}
        <div className="w-full lg:w-1/2 p-4 sm:p-6 overflow-y-auto flex-1">
          <div className="mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1">History</h2>
          </div>

          <div className="relative">
            {/* Continuous Timeline Line */}
            {history.length > 1 && (
              <div
                className="absolute left-[6px] top-4 w-0.5 bg-primary"
                style={{ height: `${(history.length - 1) * 96}px` }}
              ></div>
            )}

            <div className="space-y-4 sm:space-y-6">
              {history.length > 0 ? (
                history.map((entry) => (
                  <div key={entry.id} className="flex items-start space-x-3 sm:space-x-4 relative">
                    <div className="relative z-10">
                      <div className="w-3 h-3 bg-primary rounded-full mt-1"></div>
                    </div>

                    <div className="flex-1 pb-2 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-3 gap-1 sm:gap-0">
                        <div className="text-sm sm:text-base font-medium text-primary">
                          {entry.type}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500">
                          {entry.date}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:space-x-2">
                        <span className="text-xs sm:text-sm text-gray-700">{entry.action}</span>
                        <span className="text-xs sm:text-sm font-medium text-primary bg-gray-100 px-2 py-1 rounded radius-8 inline-block w-fit">
                          {entry.user}
                        </span>
                      </div>

                      {/* Render changes if available */}
                      {entry.changes && Object.keys(entry.changes).length > 0 && (
                        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Detailed Changes</div>
                          {Object.entries(entry.changes).map(([field, delta]) => (
                            <div key={field} className="text-xs bg-gray-50 p-2 rounded-lg border border-gray-100">
                              <div className="font-semibold text-gray-600 mb-1">{formatName(field)}</div>
                              <div className="space-y-1">
                                <div className="flex items-start text-red-500 opacity-80">
                                  <span className="w-8 sm:w-10 shrink-0 font-medium text-gray-400 text-[10px] sm:text-xs">Old:</span>
                                  <span className="line-through italic break-words">{formatValue(delta.old)}</span>
                                </div>
                                <div className="flex items-start text-green-600">
                                  <span className="w-8 sm:w-10 shrink-0 font-medium text-gray-400 text-[10px] sm:text-xs">New:</span>
                                  <span className="font-semibold break-words">{formatValue(delta.new)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-center py-4">No history available</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementHistoryModal;
