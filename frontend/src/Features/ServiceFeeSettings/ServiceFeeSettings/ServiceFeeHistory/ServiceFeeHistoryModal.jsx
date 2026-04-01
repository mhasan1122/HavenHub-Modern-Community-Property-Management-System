import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaHistory, FaTimes } from 'react-icons/fa';
import { clearHistory } from '../../../../redux/slices/serviceFee/serviceFeeSlice';
import { fetchServiceFeeHistory } from '../../../../redux/slices/api/serviceFeeApi';

const ServiceFeeHistoryModal = ({ visible, onClose, serviceFeeId, serviceFeeData }) => {
  const dispatch = useDispatch();
  const { serviceFeeHistory, historyLoading, historyError } = useSelector((state) => state.serviceFees);

  // Format date to match web version (DD-MM-YYYY at HH:MM:SS am/pm)
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const seconds = date.getSeconds().toString().padStart(2, '0');
      const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const period = hours >= 12 ? 'pm' : 'am';
      return `${day}-${month}-${year} at ${hour12}:${minutes}:${seconds}${period}`;
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Fix currency display for BDT - replace $ with ৳ for existing history entries
  const fixCurrencyDisplay = (value, fieldName) => {
    if (!value || value === 'N/A') return value;
    
    // Check if this is a fee amount field and the service fee uses BDT currency
    const isFeeAmount = fieldName && fieldName.toLowerCase().includes('fee amount');
    const isBDTCurrency = serviceFeeData?.currency === 'BDT' || !serviceFeeData?.currency; // Default to BDT if not specified
    
    if (isFeeAmount && isBDTCurrency && typeof value === 'string' && value.includes('$')) {
      // Replace dollar sign with Taka symbol for BDT currency
      return value.replace('$', '৳');
    }
    
    return value;
  };

  // Get action type display text
  const getActionType = (action) => {
    switch (action.toLowerCase()) {
      case 'created':
        return 'Creation';
      case 'updated':
        return 'Edit';
      case 'cancelled':
        return 'Cancel';
      default:
        return action;
    }
  };

  // Get action label text
  const getActionLabel = (action) => {
    switch (action.toLowerCase()) {
      case 'created':
        return 'Created by';
      case 'updated':
        return 'Edited by';
      case 'cancelled':
        return 'Cancelled by';
      default:
        return '';
    }
  };

  // Calculate dynamic height for timeline dots based on content
  const calculateDotHeight = (entry, index, historyArray) => {
    if (index >= historyArray.length - 1) return 0; // No line for last entry

    // Base height for header, date, user info, and spacing
    let height = 100; // Header, date, user info, and margins
    
    // Add height for field changes section if present and not a 'created' or 'cancelled' action
    if (entry.changes && entry.changes.length > 0 && entry.action !== 'created' && entry.action !== 'cancelled') {
      height += 60; // Changes container base height with padding
      height += entry.changes.length * 36; // Height per change item with proper spacing
    }
    
    // Add spacing between entries (space-y-6 = 24px + pb-4 = 16px)
    height += 10; // Space between current and next entry
    
    // Ensure minimum height for visual connection
    return Math.max(height, 120);
  };

  // Fetch service fee history using Redux
  const fetchHistory = () => {
    if (!serviceFeeId) return;
    dispatch(fetchServiceFeeHistory(serviceFeeId));
  };

  // Fetch history when modal opens
  useEffect(() => {
    if (visible && serviceFeeId) {
      fetchHistory();
    } else if (!visible) {
      // Clear history when modal closes
      dispatch(clearHistory());
    }
  }, [visible, serviceFeeId, dispatch]);

  // Debug log to see what data is being received
  useEffect(() => {
    console.log('Service fee history data:', serviceFeeHistory);
    console.log('Service fee data passed to modal:', serviceFeeData);
    console.log('Service fee is_active:', serviceFeeData?.is_active);
    console.log('Service fee ID:', serviceFeeId);
    if (serviceFeeHistory.length > 0) {
      console.log('First history entry:', serviceFeeHistory[0]);
      console.log('First history entry changes:', serviceFeeHistory[0].changes);
      console.log('All history actions:', serviceFeeHistory.map(entry => entry.action));
    }
  }, [serviceFeeHistory, serviceFeeData, serviceFeeId]);


  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white relative flex w-[796px] h-[660px] max-w-[90vw] max-h-[90vh] rounded-[27px] opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
  onClick={onClose}
  className="absolute top-0 right-0 translate-x-2 -translate-y-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white z-10 transition-colors"
>
  <FaTimes className="w-4 h-4" />
</button>


        {/* Right Side - History */}
        <div className="w-full p-6 overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              History
            </h2>
          </div>

          {/* History Timeline */}
          <div className="relative">
            {/* Main timeline line is removed as we're using individual line segments for each entry */}

            <div className="space-y-6">
              {historyLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-gray-500 mt-2">Loading history...</p>
                </div>
              ) : historyError ? (
                <div className="text-center py-8">
                  <div className="text-red-600 mb-2">Error loading history</div>
                  <p className="text-gray-500">{historyError}</p>
                </div>
              ) : (() => {
                // Always show at least a Create entry, even if no history data
                const defaultCreateEntry = {
                  id: 'default-create',
                  action: 'created',
                  date: serviceFeeData?.created_at ? formatDate(serviceFeeData.created_at) : formatDate(new Date().toISOString()),
                  user: serviceFeeData?.creator_name || serviceFeeData?.creator_display || 'System',
                  userId: serviceFeeData?.creator?.id || null,
                  changes: [],
                  isRejected: false
                };

                // Start with the fetched history or empty array
                let entries = [...serviceFeeHistory];
                
                // Sort entries by date in reverse chronological order (newest first) for proper timeline display
                entries.sort((a, b) => {
                  // Parse dates more robustly
                  const parseDate = (dateStr) => {
                    if (!dateStr) return new Date(0);
                    
                    // Handle different date formats
                    // Format: "DD-MM-YYYY at HH:MM:SSam/pm"
                    if (typeof dateStr === 'string' && dateStr.includes(' at ')) {
                      const [datePart, timePart] = dateStr.split(' at ');
                      const [day, month, year] = datePart.split('-');
                      const timeStr = timePart.replace(/(\d{1,2}):(\d{2}):(\d{2})(am|pm)/, '$1:$2:$3 $4');
                      return new Date(`${month}/${day}/${year} ${timeStr}`);
                    }
                    
                    // Handle ISO format or other standard formats
                    return new Date(dateStr);
                  };
                  
                  const dateA = parseDate(a.date || a.timestamp);
                  const dateB = parseDate(b.date || b.timestamp);
                  
                  console.log(`Sorting: ${a.action} (${a.date}) vs ${b.action} (${b.date})`);
                  console.log(`Parsed dates: ${dateA.toISOString()} vs ${dateB.toISOString()}`);
                  
                  return dateB - dateA; // Changed to reverse chronological order (newest first)
                });
                
                // Check if we already have a 'created' entry in the history
                const hasCreatedEntry = entries.some(entry => entry.action === 'created');
                
                // If no 'created' entry exists, add it at the beginning
                if (!hasCreatedEntry) {
                  entries.unshift(defaultCreateEntry);
                }
                
                // If service fee is inactive and no cancelled entry in history, add a cancelled entry at the end
                console.log('=== CANCEL DETECTION DEBUG ===');
                console.log('Service fee data:', serviceFeeData);
                console.log('is_active value:', serviceFeeData?.is_active, 'type:', typeof serviceFeeData?.is_active);
                console.log('Current entries:', entries.map(e => ({ action: e.action, date: e.date })));
                console.log('Has cancelled entry:', entries.some(entry => entry.action === 'cancelled'));
                
                // Check if service fee is inactive (cancelled) - more comprehensive check
                const isServiceFeeInactive = serviceFeeData && (
                  serviceFeeData.is_active === false || 
                  serviceFeeData.is_active === 'false' ||
                  serviceFeeData.is_active === 0 ||
                  serviceFeeData.is_active === '0' ||
                  serviceFeeData.is_active === null ||
                  serviceFeeData.is_active === undefined
                );
                
                console.log('Is service fee inactive?', isServiceFeeInactive);
                
                // Also check if we're viewing from cancelled list (additional indicator)
                const isFromCancelledList = window.location.search.includes('from=cancelled');
                console.log('Is from cancelled list?', isFromCancelledList);
                
                if (isServiceFeeInactive || isFromCancelledList) {
                  const hasCancelledEntry = entries.some(entry => entry.action === 'cancelled');
                  console.log('Should add cancelled entry. Has cancelled entry:', hasCancelledEntry);
                  
                  if (!hasCancelledEntry) {
                    console.log('Adding default cancelled entry');
                    const cancelledEntry = {
                      id: 'default-cancelled',
                      action: 'cancelled',
                      date: serviceFeeData?.updated_at ? formatDate(serviceFeeData.updated_at) : formatDate(new Date().toISOString()),
                      user: serviceFeeData?.updated_by?.full_name || serviceFeeData?.creator_name || 'System',
                      userId: serviceFeeData?.updated_by?.id || null,
                      changes: [], // No changes to display for cancelled entries
                      isRejected: true
                    };
                    entries.push(cancelledEntry);
                    console.log('Added cancelled entry:', cancelledEntry);
                  }
                } else {
                  console.log('Service fee is active, not adding cancelled entry');
                }
                console.log('=== END CANCEL DETECTION DEBUG ===');
                console.log('Final entries to render:', entries.map(e => ({ action: e.action, date: e.date, id: e.id })));

                return entries.map((entry, index) => {
                  // Set isRejected to true for cancelled actions (cancelled service fees)
                  const isRejected = entry.action === 'cancelled';
                  console.log(`Entry action: "${entry.action}", isRejected: ${isRejected}`);
                  const entryWithRejected = { ...entry, isRejected };
                  const historyArray = entries; // Use the updated entries array
                  
                  // Determine if the line should be secondary (connecting from or to a cancel action)
                  const isLineSecondary = (index < historyArray.length - 1 && 
                    historyArray[index + 1]?.action === 'cancelled') || 
                    entry.action === 'cancelled';
                  
                  return (
                    <div
                      key={entry.id}
                      className="flex items-start space-x-5 relative"
                    >
                      {/* Timeline Dot with conditional styling for cancelled entries only */}
                      <div className="relative">
                        <div
                          className={`w-3 h-3 rounded-full mt-3 relative z-20 ${
                            entry.action === 'cancelled' ? "bg-secondary" : "bg-primary"
                          }`}
                        ></div>
                        {/* Connecting line to next dot */}
                        {index < historyArray.length - 1 && (() => {
                          const lineHeight = calculateDotHeight(entry, index, historyArray);
                          return (
                            <div
                              className={`absolute w-0.5 ${
                                isLineSecondary ? "bg-secondary" : "bg-primary"
                              } z-10`}
                              style={{
                                height: `${lineHeight}px`,
                                left: '5px', // Center the line with the dot (6px dot width / 2 - 0.5px line width / 2)
                                top: '18px' // Start below the dot (mt-1 + dot height + small gap)
                              }}
                            ></div>
                          );
                        })()}
                      </div>

                      {/* History Entry */}
                      <div className="flex-1 pb-4">
                        {/* Header with Type and Date */}
                        <div className="flex items-center justify-between mb-3">
                          <div
                            className={`text-base font-medium ${
                              entryWithRejected.isRejected ? "text-secondary" : "text-primary"
                            }`}
                          >
                            {getActionType(entry.action)}
                          </div>
                        <div className="text-sm text-gray-500">
                          {entry.date || formatDate(entry.timestamp)}
                        </div>
                        </div>

                        {/* User info */}
                        <div className="flex items-center space-x-2 mb-3">
                          <span className="text-sm text-gray-700">
                            {getActionLabel(entry.action)}
                          </span>
                        <span className="text-sm font-medium text-primary bg-gray-100 px-2 py-1 rounded radius-8">
                          {entry.user || 'System'}
                        </span>
                          
                        </div>

                        {/* Field Changes - Hide for 'created' and 'cancelled' actions */}
                        {entry.changes && entry.changes.length > 0 && entry.action !== 'created' && entry.action !== 'cancelled' && (
                          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                            <div className="text-sm font-medium text-gray-700 mb-2">
                              Changes Made:
                            </div>
                            {entry.changes.map((change, changeIndex) => {
                              const fieldName = change.field_display || change.field;
                              const oldValue = change.old_value || change.oldValue || 'N/A';
                              const newValue = change.new_value || change.newValue || 'N/A';
                              
                              return (
                                <div key={changeIndex} className="flex items-center space-x-2 text-sm">
                                  <span className="font-medium text-gray-600 min-w-0 flex-shrink-0">
                                    {fieldName}:
                                  </span>
                                  <div className="flex items-center space-x-1 flex-1 min-w-0">
                                    <span className="text-red-600 bg-red-50 px-2 py-1 rounded text-xs">
                                      {fixCurrencyDisplay(oldValue, fieldName)}
                                    </span>
                                    <span className="text-gray-400">→</span>
                                    <span className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs">
                                      {fixCurrencyDisplay(newValue, fieldName)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceFeeHistoryModal;
