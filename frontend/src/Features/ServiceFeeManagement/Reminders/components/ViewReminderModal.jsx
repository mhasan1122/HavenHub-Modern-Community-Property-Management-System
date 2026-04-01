import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import { RxCross1 } from 'react-icons/rx';
import { FaBell, FaSms, FaEnvelope, FaClock, FaUsers, FaBuilding } from 'react-icons/fa';

const ViewReminderModal = ({ isOpen, onClose, reminderData }) => {
  const [showAllSendWhen, setShowAllSendWhen] = useState(false);
  const [showAllTimes, setShowAllTimes] = useState(false);
  const [showAllTowers, setShowAllTowers] = useState(false);
  const [showAllTargets, setShowAllTargets] = useState(false);
  const [unitDetails, setUnitDetails] = useState({});
  const [residentDetails, setResidentDetails] = useState({});

  // Function to format 24-hour time to 12-hour format with AM/PM
  const formatTimeTo12Hour = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Fetch unit and resident details by IDs
  useEffect(() => {
    const fetchTargetDetails = async () => {
      try {
        const specificTargets = reminderData.specific_target_data || [];
        const unitIds = specificTargets.filter(t => t.target_type === 'unit').map(t => t.target_id);
        const residentIds = specificTargets.filter(t => t.target_type === 'resident').map(t => t.target_id);

        // Fetch unit details if there are unit IDs
        if (unitIds.length > 0) {
          try {
            const unitResponse = await fetch(`/api/service-fee-management/api/units/?search=${unitIds.join(',')}`);
            if (unitResponse.ok) {
              const unitData = await unitResponse.json();
              const unitMap = {};
              if (Array.isArray(unitData)) {
                unitData.forEach(unit => {
                  unitMap[unit.id] = unit;
                });
              } else if (unitData.results) {
                unitData.results.forEach(unit => {
                  unitMap[unit.id] = unit;
                });
              }
              setUnitDetails(unitMap);
            }
          } catch (err) {
            console.error('Error fetching unit details:', err);
          }
        }

        // Fetch resident details if there are resident IDs
        if (residentIds.length > 0) {
          try {
            const resResponse = await fetch(`/api/residents/?search=${residentIds.join(',')}`);
            if (resResponse.ok) {
              const resData = await resResponse.json();
              const resMap = {};
              if (Array.isArray(resData)) {
                resData.forEach(res => {
                  resMap[res.id] = res;
                });
              } else if (resData.results) {
                resData.results.forEach(res => {
                  resMap[res.id] = res;
                });
              }
              setResidentDetails(resMap);
            }
          } catch (err) {
            console.error('Error fetching resident details:', err);
          }
        }
      } catch (err) {
        console.error('Error fetching target details:', err);
      }
    };

    if (isOpen && reminderData) {
      fetchTargetDetails();
    }
  }, [isOpen, reminderData]);

  if (!isOpen || !reminderData) return null;

  const getChannelIcon = (channel) => {
    switch (channel) {
      case 'App':
      case 'appNotification':
        return <FaBell className="text-primary" />;
      case 'SMS':
      case 'sms':
        return <FaSms className="text-primary" />;
      case 'Email':
      case 'email':
        return <FaEnvelope className="text-primary" />;
      default:
        return null;
    }
  };

  const getChannelLabel = (channel) => {
    switch (channel) {
      case 'App':
      case 'appNotification':
        return 'App Notification';
      case 'SMS':
      case 'sms':
        return 'SMS';
      case 'Email':
      case 'email':
        return 'Email';
      default:
        return channel;
    }
  };

  // Get active channels from the data
  const getActiveChannelsArray = () => {
    // Priority 1: Use channels_active from API response
    if (reminderData.channels_active && Array.isArray(reminderData.channels_active)) {
      return reminderData.channels_active;
    }

    // Priority 2: Check channelsActive
    if (reminderData.channelsActive && Array.isArray(reminderData.channelsActive)) {
      return reminderData.channelsActive;
    }

    // Priority 3: Build from nested channels object
    if (reminderData.channels && typeof reminderData.channels === 'object') {
      const channels = [];
      if (reminderData.channels.appNotification) channels.push('App');
      if (reminderData.channels.sms) channels.push('SMS');
      if (reminderData.channels.email) channels.push('Email');
      return channels;
    }

    // Priority 4: Build from flat structure
    const channels = [];
    if (reminderData.app_notification || reminderData.appNotification) channels.push('App');
    if (reminderData.sms) channels.push('SMS');
    if (reminderData.email) channels.push('Email');
    return channels;
  };

  const activeChannels = getActiveChannelsArray();

  // Format Send When information - use new send_when_data if available
  const formatSendWhen = () => {
    // PRIORITY 1: Use new normalized send_when_data from API; times now on reminder.send_times
    if (reminderData.send_when_data && Array.isArray(reminderData.send_when_data)) {
      // const masterTimes = reminderData.send_times && Array.isArray(reminderData.send_times) && reminderData.send_times.length > 0
        // ? ` at ${reminderData.send_times.map(t => formatTimeTo12Hour(t)).join(', ')}`
        // : '';
      return reminderData.send_when_data.map((timing) => {
        return `${timing.timing_label}`;
      });
    }

    // PRIORITY 2: Fall back to old JSON structure
    const sendWhenTypes = reminderData.sendWhenType || reminderData.send_when_type || [];
    const sendWhenDays = reminderData.sendWhenDay || reminderData.send_when_day || [];

    if (!Array.isArray(sendWhenTypes) || !Array.isArray(sendWhenDays)) {
      return [];
    }

    return sendWhenTypes.map((type, index) => {
      const day = sendWhenDays[index];
      let label = '';

      if (type === 'on_due') {
        label = 'On due date';
      } else if (type === 'before_due') {
        label = `${day} day${day > 1 ? 's' : ''} before due`;
      } else if (type === 'after_due') {
        label = `${day} day${day > 1 ? 's' : ''} after due`;
      } else if (type === 'specific') {
        label = `Specific Day ${day}`;
      }

      return label;
    });
  };

  const sendWhenOptions = formatSendWhen();
  const sendTimes = reminderData.send_times || [];

  // PRIORITY 1: Use new normalized payment_status_data from API
  const paymentStatus = reminderData.payment_status_data && reminderData.payment_status_data.length > 0
    ? reminderData.payment_status_data.map(ps => ps.status)
    : (reminderData.paymentStatus || reminderData.payment_status || []);

  // PRIORITY 1: Use new normalized tower_data from API
  const towerData = reminderData.tower_data || [];
  const towerNames = towerData.length > 0
    ? towerData.map(t => ({ id: t.tower__id, name: t.tower__tower_name }))
    : (reminderData.towerNames || reminderData.tower_names || []);
  const towerIds = towerData.length > 0 ? towerData.map(t => t.tower__id) : (reminderData.towerIds || reminderData.tower_id || []);

  // Get unit details and resident details from API (or old format)
  const legacyUnitDetails = reminderData.unitDetails || reminderData.unit_details || [];
  const legacyResidentDetails = reminderData.residentDetails || reminderData.resident_details || [];

  // PRIORITY 1: Use new normalized specific_target_data from API
  const specificTargets = reminderData.specific_target_data || [];

  // Extract units and residents from specific_target_data
  const unitsFromAPI = specificTargets.filter(t => t.target_type === 'unit').map(t => ({ id: t.target_id }));
  const residentsFromAPI = specificTargets.filter(t => t.target_type === 'resident').map(t => ({ id: t.target_id }));

  // Get specific targets based on audience type
  const audience = reminderData.audience || '';

  // Determine what to show based on toggle states
  const displayedSendWhen = showAllSendWhen ? sendWhenOptions : sendWhenOptions.slice(0, 3);
  const displayedTimes = showAllTimes ? sendTimes : sendTimes.slice(0, 3);
  const displayedTowers = showAllTowers ? towerNames : towerNames.slice(0, 5);

  // For units/residents, use the details from API
  let displayedTargets = [];
  let targetLabel = '';
  let totalTargets = 0;

  // Try to use API data first, then fall back to old format
  if (audience === 'Specific Units') {
    const targetUnits = unitsFromAPI.length > 0 ? unitsFromAPI : legacyUnitDetails;
    if (targetUnits.length > 0) {
      displayedTargets = showAllTargets ? targetUnits : targetUnits.slice(0, 5);
      targetLabel = 'Unit(s)';
      totalTargets = targetUnits.length;
    }
  } else if (audience === 'Specific Resident') {
    const targetResidents = residentsFromAPI.length > 0 ? residentsFromAPI : legacyResidentDetails;
    if (targetResidents.length > 0) {
      displayedTargets = showAllTargets ? targetResidents : targetResidents.slice(0, 5);
      targetLabel = 'Resident(s)';
      totalTargets = targetResidents.length;
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col relative">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute -top-2 -right-2 p-2 rounded-full bg-primary text-white shadow-md hover:bg-primaryHover transition z-20"
          >
            <RxCross1 />
          </button>

          {/* Modal Header */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Reminder Details</h2>
          </div>

          {/* Modal Body - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - Details */}
              <div className="space-y-6">
                {/* Send When */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <FaClock className="text-primary mt-1" />
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Send When</h3>
                      {sendWhenOptions.length > 0 ? (
                        <div className="space-y-1">
                          {displayedSendWhen.map((option, index) => (
                            <div key={index} className="text-sm text-gray-900">
                              • {option}
                            </div>
                          ))}
                          {sendWhenOptions.length > 3 && (
                            <button
                              onClick={() => setShowAllSendWhen(!showAllSendWhen)}
                              className="text-primary text-sm font-medium hover:underline mt-1"
                            >
                              {showAllSendWhen ? 'Show Less' : `Show More (${sendWhenOptions.length - 3} more)`}
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-500 italic text-sm">Not specified</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Send Times */}
                {sendTimes.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <FaClock className="text-primary mt-1" />
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Set Times</h3>
                        <div className="flex flex-wrap gap-2">
                          {displayedTimes.map((time, index) => (
                            <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary text-white">
                              {formatTimeTo12Hour(time)}
                            </span>
                          ))}
                        </div>
                        {sendTimes.length > 3 && (
                          <button
                            onClick={() => setShowAllTimes(!showAllTimes)}
                            className="text-primary text-sm font-medium hover:underline mt-2"
                          >
                            {showAllTimes ? 'Show Less' : `Show More (${sendTimes.length - 3} more)`}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Selected Towers */}
                {towerIds.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <FaBuilding className="text-primary mt-1" />
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Selected Towers</h3>
                        <p className="text-sm font-semibold text-gray-900 mb-2">{towerIds.length} Tower(s) Selected</p>
                        {towerNames.length > 0 && (
                          <div className="space-y-1">
                            {displayedTowers.map((tower, index) => (
                              <div key={index} className="text-sm text-gray-700">
                                • {tower.name || `Tower ID: ${tower.id}`}
                              </div>
                            ))}
                            {towerNames.length > 5 && (
                              <button
                                onClick={() => setShowAllTowers(!showAllTowers)}
                                className="text-primary text-sm font-medium hover:underline mt-1"
                              >
                                {showAllTowers ? 'Show Less' : `Show More (${towerNames.length - 5} more)`}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Channels */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Active Channels</h3>
                  {activeChannels.length > 0 ? (
                    <div className="space-y-2">
                      {activeChannels.map((channel, index) => (
                        <div key={index} className="flex items-center space-x-3 bg-white rounded-md p-2">
                          {getChannelIcon(channel)}
                          <span className="text-gray-900 font-medium text-sm">
                            {getChannelLabel(channel)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic text-sm">No channels selected</p>
                  )}
                </div>

                {/* Audience */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <FaUsers className="text-primary mt-1" />
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-700 mb-1">Target Audience</h3>
                      <p className="text-lg font-semibold text-gray-900 mb-2">
                        {audience || 'N/A'}
                      </p>

                      {/* Show specific targets for Units/Residents */}
                      {totalTargets > 0 && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-600 mb-1">{totalTargets} {targetLabel} Selected</p>
                          <div className="space-y-1">
                            {displayedTargets.map((target, index) => (
                              <div key={index} className="text-sm text-gray-700">
                                • {target.name || `ID: ${target.id}`}
                                {target.tower && <span className="text-gray-500 ml-1">({target.tower})</span>}
                                {target.email && <span className="text-gray-500 ml-1">- {target.email}</span>}
                              </div>
                            ))}
                            {totalTargets > 5 && (
                              <button
                                onClick={() => setShowAllTargets(!showAllTargets)}
                                className="text-primary text-sm font-medium hover:underline mt-1"
                              >
                                {showAllTargets ? 'Show Less' : `Show More (${totalTargets - 5} more)`}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Payment Status */}
                {paymentStatus.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Payment Status</h3>
                    <div className="flex flex-wrap gap-2">
                      {paymentStatus.map((status, index) => (
                        <span
                          key={index}
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${status === 'Paid' ? 'bg-green-100 text-green-800' :
                            status === 'Due' ? 'bg-yellow-100 text-yellow-800' :
                              status === 'Overdue' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                            }`}
                        >
                          {status}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Status</h3>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${reminderData.status === 'Active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                    }`}>
                    {reminderData.status || 'Draft'}
                  </span>
                </div>

                {/* Created Date */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700">Created Date</h3>
                  <p className="text-lg font-semibold text-gray-900">
                    {reminderData.createdDate || reminderData.created_at ?
                      new Date(reminderData.createdDate || reminderData.created_at).toLocaleDateString() :
                      new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Right Column - Message Preview */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Message Preview</h3>
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 h-full min-h-[400px]">
                  <div className="bg-white rounded-md p-4 shadow-sm">
                    <div className="border-l-4 border-primary pl-4">
                      <h4 className="font-semibold text-gray-900 mb-2">Estate Link Reminder</h4>
                      <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {reminderData.messagePreview || reminderData.message_preview || 'No message preview available'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer - Fixed at bottom */}
          <div className="p-6 border-t border-gray-200 bg-white">
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primaryHover transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

ViewReminderModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  reminderData: PropTypes.object
};

export default ViewReminderModal;