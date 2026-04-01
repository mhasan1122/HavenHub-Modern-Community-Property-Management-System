import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaEye, FaEdit, FaTrash, FaPlay, FaPause, FaPlus, FaPaperPlane, FaFilter, FaArrowLeft, FaRegBell } from 'react-icons/fa';
import ReminderFilterControls from './ReminderFilterControls';
import CreateReminderModal from './CreateReminderModal';
import EditReminderModal from './EditReminderModal';
import ViewReminderModal from './ViewReminderModal';
import SendWhenCell from './SendWhenCell';
import ConfirmationMessageBox from '../../../../Components/MessageBox/ConfirmationMessageBox';
import MessageBox from '../../../../Components/MessageBox/MessageBox';
import TableSkeleton from '../../../../Components/Loaders/TableSkeleton';
import useSkeletonLoading from '../../../../hooks/useSkeletonLoading';
import { SKELETON_MIN_DISPLAY_TIME } from '../../../../config/skeletonLoadingConfig';
import Button from '../../../../Components/FormComponent/ButtonComponent/Button';
import FilterButton from '../../../../Components/FormComponent/ButtonComponent/FilterButton';
import PageContainer from '../../../../Components/Ui/PageContainer';
import ContentBox from '../../../../Components/Ui/ContentBox';
import Heading from '../../../../Components/HeadingComponent/Heading';

// Import Redux actions
import {
  fetchReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  sendReminderManually
} from '../../../../redux/slices/api/serviceFeeManagement/serviceFeeManagementApi';

import {
  clearReminderStates,
  setSelectedReminder,
  clearSelectedReminder
} from '../../../../redux/slices/serviceFeeManagement/serviceFeeManagementSlice';
import EmptyState from '../../../../Components/Ui/EmptyState';

const RemindersTable = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  // Check if navigated from Overview page via tabs
  const showBackButton = location.state?.fromOverview === true;

  // Permission checks removed - functionality is now accessible to all users

  // Redux state
  const {
    reminders,
    remindersLoading,
    selectedReminder,
    reminderOperationLoading,
    reminderOperationSuccess,
    reminderOperationError,
    reminderOperationMessage
  } = useSelector(state => state.serviceFeeManagement);

  // Local component state
  const [modals, setModals] = useState({
    create: false,
    edit: false,
    view: false
  });
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [reminderToDelete, setReminderToDelete] = useState(null);
  const [currentConfirmAction, setCurrentConfirmAction] = useState(null);
  const [messageBox, setMessageBox] = useState({
    open: false,
    title: '',
    message: '',
    type: 'success' // 'success' or 'error'
  });

  // Filter states - Updated to support arrays
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [selectedReminderType, setSelectedReminderType] = useState([]);
  const [selectedSendWhen, setSelectedSendWhen] = useState([]);
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [selectedAudience, setSelectedAudience] = useState([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Helper function to check if filter has values
  const hasFilterValues = (filterArray) => {
    return Array.isArray(filterArray) ? filterArray.length > 0 : false;
  };

  // Fetch reminders on component mount and when filters change
  useEffect(() => {
    const filters = {};

    if (searchQuery) filters.search = searchQuery;
    if (hasFilterValues(selectedStatus)) filters.status = selectedStatus;
    if (hasFilterValues(selectedReminderType)) filters.reminder_type = selectedReminderType;
    if (hasFilterValues(selectedAudience)) filters.audience = selectedAudience;
    if (hasFilterValues(selectedChannels)) filters.channel = selectedChannels;

    dispatch(fetchReminders(filters));
  }, [dispatch, searchQuery, selectedStatus, selectedReminderType, selectedAudience, selectedChannels]);

  // Handle operation success/error messages
  useEffect(() => {
    if (reminderOperationSuccess) {
      setMessageBox({
        open: true,
        title: 'Success',
        message: reminderOperationMessage || 'Operation completed successfully',
        type: 'success'
      });
      dispatch(clearReminderStates());
    } else if (reminderOperationError) {
      setMessageBox({
        open: true,
        title: 'Error',
        message: typeof reminderOperationError === 'string' ? reminderOperationError : 'Unable to complete the action. Please try again.',
        type: 'error'
      });
    }
  }, [reminderOperationSuccess, reminderOperationError, reminderOperationMessage, dispatch]);

  // Helper function to format 24-hour time to 12-hour format
  const formatTimeTo12Hour = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Helper function to get all times from reminder master send_times
  const getSendTimes = (reminder) => {
    if (!reminder) return 'Not set';

    if (reminder.send_times && Array.isArray(reminder.send_times) && reminder.send_times.length > 0) {
      return reminder.send_times.map(t => formatTimeTo12Hour(t)).join(', ');
    }

    return 'Not set';
  };

  // Helper function to get active channels
  const getActiveChannels = (reminder) => {
    if (!reminder) {
      return 'None';
    }

    // Priority 1: Use channels_active from API response (already formatted)
    if (reminder.channels_active && Array.isArray(reminder.channels_active)) {
      return reminder.channels_active.join(', ') || 'None';
    }

    const activeChannels = [];

    // Priority 2: Handle nested channels object (frontend format)
    if (reminder.channels) {
      if (reminder.channels.appNotification) activeChannels.push('App');
      if (reminder.channels.sms) activeChannels.push('SMS');
      if (reminder.channels.email) activeChannels.push('Email');
    }
    // Priority 3: Handle flat structure (API response format)
    else {
      if (reminder.app_notification || reminder.appNotification) activeChannels.push('App');
      if (reminder.sms) activeChannels.push('SMS');
      if (reminder.email) activeChannels.push('Email');
    }

    return activeChannels.join(', ') || 'None';
  };

  // Helper function to format date in DD-MMM-YYYY format
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';

    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return 'N/A';
    }
  };

  // Helper function to format send when display
  const formatSendWhen = (reminder) => {
    if (!reminder) {
      return 'Not set';
    }

    // Use new sendWhenType and sendWhenDay fields from backend (now arrays)
    const sendWhenTypes = reminder.sendWhenType || reminder.send_when_type;
    const sendWhenDays = reminder.sendWhenDay || reminder.send_when_day;

    // Handle arrays (new format)
    if (Array.isArray(sendWhenTypes) && Array.isArray(sendWhenDays) && sendWhenTypes.length > 0 && sendWhenDays.length > 0) {
      const options = sendWhenTypes.map((type, index) => {
        const day = parseInt(sendWhenDays[index]);

        if (type === 'on_due') {
          return 'On due date';
        } else if (type === 'before_due') {
          return `${day} day${day > 1 ? 's' : ''} before due`;
        } else if (type === 'after_due') {
          return `${day} day${day > 1 ? 's' : ''} after due`;
        } else if (type === 'specific') {
          return `Specific Day: ${day}`;
        }
        return '';
      });

      return options.filter(Boolean).join(', ');
    }
    // Handle single values (backward compatibility)
    else if (sendWhenTypes && sendWhenDays !== undefined && sendWhenDays !== null) {
      const day = parseInt(sendWhenDays);

      if (sendWhenTypes === 'on_due') {
        return 'On due date';
      } else if (sendWhenTypes === 'before_due') {
        return `${day} day${day > 1 ? 's' : ''} before due`;
      } else if (sendWhenTypes === 'after_due') {
        return `${day} day${day > 1 ? 's' : ''} after due`;
      } else if (sendWhenTypes === 'specific') {
        return `Specific Day: ${day}`;
      }
    }

    return 'Not set';
  };

  // Filter handling functions
  const handleFilterChange = (filterName, value) => {
    switch (filterName) {
      case 'searchQuery':
        setSearchQuery(value);
        break;
      case 'selectedStatus':
        setSelectedStatus(value);
        break;
      case 'selectedReminderType':
        setSelectedReminderType(value);
        break;
      case 'selectedSendWhen':
        setSelectedSendWhen(value);
        break;
      case 'selectedChannels':
        setSelectedChannels(value);
        break;
      case 'selectedAudience':
        setSelectedAudience(value);
        break;
      default:
        break;
    }
  };

  // Filter function
  const getFilteredReminders = () => {
    if (!reminders || !Array.isArray(reminders)) {
      return [];
    }

    return reminders.filter(reminder => {
      // Safety check - ensure reminder exists
      if (!reminder) {
        return false;
      }

      // Search query filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();

        // Get formatted send when text for searching
        const sendWhenText = formatSendWhen(reminder).toLowerCase();

        const matchesSearch =
          (reminder.reminderType || reminder.reminder_type || '').toLowerCase().includes(searchLower) ||
          sendWhenText.includes(searchLower) ||
          (reminder.audience || '').toLowerCase().includes(searchLower) ||
          (reminder.messagePreview || reminder.message_preview || '').toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      // Status filter - handle arrays
      if (hasFilterValues(selectedStatus)) {
        if (!selectedStatus.includes(reminder.status)) {
          return false;
        }
      }

      // Reminder type filter - handle arrays
      if (hasFilterValues(selectedReminderType)) {
        const reminderType = reminder.reminderType || reminder.reminder_type;
        if (!selectedReminderType.includes(reminderType)) {
          return false;
        }
      }

      // Send when filter - handle arrays
      if (hasFilterValues(selectedSendWhen)) {
        let matchesSendWhen = false;

        // Check if any of the selected send when options match
        for (const selectedOption of selectedSendWhen) {
          // Handle array format (new flexible format)
          if (Array.isArray(reminder.sendWhen)) {
            if (reminder.sendWhen.includes(selectedOption)) {
              matchesSendWhen = true;
              break;
            }
          }
          // Handle string format (backward compatibility)
          else if (typeof reminder.sendWhen === 'string') {
            if (reminder.sendWhen === selectedOption) {
              matchesSendWhen = true;
              break;
            }
          }
          // Handle custom timing
          else if (reminder.customSendWhen && reminder.customSendWhen.enabled && selectedOption === 'Custom timing') {
            matchesSendWhen = true;
            break;
          }
          // Handle specific day
          else if (reminder.specificDay && reminder.specificDay.enabled && selectedOption === 'Specific day') {
            matchesSendWhen = true;
            break;
          }
        }

        if (!matchesSendWhen) {
          return false;
        }
      }

      // Channels filter - handle arrays
      if (hasFilterValues(selectedChannels)) {
        const activeChannels = getActiveChannels(reminder);
        let matchesChannel = false;

        for (const selectedChannel of selectedChannels) {
          if (activeChannels.includes(selectedChannel)) {
            matchesChannel = true;
            break;
          }
        }

        if (!matchesChannel) {
          return false;
        }
      }

      // Audience filter - handle arrays
      if (hasFilterValues(selectedAudience)) {
        if (!selectedAudience.includes(reminder.audience)) {
          return false;
        }
      }

      return true;
    });
  };

  const filteredReminders = getFilteredReminders();

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatus, selectedReminderType, selectedSendWhen, selectedChannels, selectedAudience, reminders]);

  // Pagination calculations
  const totalPages = Math.ceil((filteredReminders?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedReminders = filteredReminders?.slice(startIndex, endIndex) || [];

  const openModal = (type, reminder = null) => {
    if (reminder) {
      dispatch(setSelectedReminder(reminder));
    }
    setModals(prev => ({ ...prev, [type]: true }));
  };

  const closeModal = (type) => {
    setModals(prev => ({ ...prev, [type]: false }));
    dispatch(clearSelectedReminder());
  };

  const getStatusBadge = (status) => {
    const baseClasses = "px-3 py-1 text-xs font-semibold uppercase tracking-wide rounded-full";
    if (status === 'Active') {
      return `${baseClasses} bg-emerald-100 text-emerald-800`;
    } else if (status === 'Paused') {
      return `${baseClasses} bg-yellow-100 text-yellow-800`;
    }
    return `${baseClasses} bg-gray-100 text-gray-800`;
  };

  const handleView = (reminder) => {
    openModal('view', reminder);
  };

  const handleEdit = (reminder) => {
    openModal('edit', reminder);
  };

  const handleDelete = (reminder) => {
    setReminderToDelete(reminder);
    setCurrentConfirmAction('delete');
    setConfirmationMessage(`Are you sure you want to delete the "${reminder.reminderType}" reminder?`);
    setShowConfirmation(true);
  };

  const handleDeleteConfirmed = async () => {
    if (reminderToDelete) {
      try {
        await dispatch(deleteReminder(reminderToDelete.id)).unwrap();

        // Success will be handled by the useEffect that watches for reminderOperationSuccess
        // Close confirmation and reset all states
        setShowConfirmation(false);
        setReminderToDelete(null);
        setCurrentConfirmAction(null);
        setConfirmationMessage('');
      } catch (error) {
        // Error will be handled by the useEffect that watches for reminderOperationError
        console.error('Failed to delete reminder:', error);
      }
    }
  };

  const handleCreateNew = () => {
    openModal('create');
  };

  const handleSaveReminder = async (reminderData) => {
    try {
      if (reminderData.sendImmediately) {
        // For send now, create the reminder and then send it immediately
        const createdReminder = await dispatch(createReminder(reminderData)).unwrap();
        // Send the reminder immediately after creation
        await dispatch(sendReminderManually(createdReminder.id)).unwrap();
      } else {
        // Regular save
        await dispatch(createReminder(reminderData)).unwrap();
      }
      // Success will be handled by the useEffect that watches for reminderOperationSuccess
      // Only close modal on successful completion
      setModals({ ...modals, create: false });
    } catch (error) {
      // Error will be handled by the useEffect that watches for reminderOperationError
      console.error('Failed to create reminder:', error);
      // Don't close modal on error - let the modal handle it
      throw error; // Re-throw so the modal can handle the error
    }
  };

  const handleUpdateReminder = async (updatedReminder) => {
    try {
      if (updatedReminder.sendImmediately) {
        // For send now from edit modal, update and then send immediately
        await dispatch(updateReminder({
          reminderId: updatedReminder.id,
          reminderData: updatedReminder
        })).unwrap();
        // Send the reminder immediately after update
        await dispatch(sendReminderManually(updatedReminder.id)).unwrap();
      } else {
        // Regular update
        await dispatch(updateReminder({
          reminderId: updatedReminder.id,
          reminderData: updatedReminder
        })).unwrap();
      }
      // Success will be handled by the useEffect that watches for reminderOperationSuccess
      // Only close modal on successful completion
      setModals({ ...modals, edit: false });
      dispatch(clearSelectedReminder());
    } catch (error) {
      // Error will be handled by the useEffect that watches for reminderOperationError
      console.error('Failed to update reminder:', error);
      // Don't close modal or clear selection on error
      throw error; // Re-throw so the modal can handle the error
    }
  };

  const handleToggleStatus = async (reminder) => {
    console.log('Toggling status for reminder:', reminder.id, reminder);
    const updatedStatus = reminder.status === 'Active' ? 'Paused' : 'Active';
    try {
      await dispatch(updateReminder({
        reminderId: reminder.id,
        reminderData: { ...reminder, status: updatedStatus }
      })).unwrap();
      // Success will be handled by the useEffect that watches for reminderOperationSuccess
    } catch (error) {
      // Error will be handled by the useEffect that watches for reminderOperationError
      console.error('Failed to toggle reminder status:', error);
    }
  };

  const handleSendNow = (reminder) => {
    setReminderToDelete(reminder); // Reuse this state for send now action
    setCurrentConfirmAction('sendNow');
    setConfirmationMessage(`Are you sure you want to send the "${reminder.reminderType}" reminder now?`);
    setShowConfirmation(true);
  };

  const handleSendNowConfirmed = async () => {
    if (reminderToDelete) {
      try {
        await dispatch(sendReminderManually(reminderToDelete.id)).unwrap();

        // Success will be handled by the useEffect that watches for reminderOperationSuccess
        // Close confirmation and reset all states
        setShowConfirmation(false);
        setReminderToDelete(null);
        setCurrentConfirmAction(null);
        setConfirmationMessage('');
      } catch (error) {
        // Error will be handled by the useEffect that watches for reminderOperationError
        console.error('Failed to send reminder:', error);
      }
    }
  };

  // Use skeleton loading hook to ensure minimum display time and data validation
  const showSkeleton = useSkeletonLoading(
    remindersLoading,
    reminders,
    SKELETON_MIN_DISPLAY_TIME
  );

  return (
    <PageContainer>
      <ContentBox>
        {/* Header */}
        <div className="mb-3 md:sticky top-0 z-20 bg-white pb-4 md:backdrop-blur">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              {showBackButton && (
                <button
                  onClick={() => navigate('/service-fee-overview')}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
                  title="Back to Overview"
                >
                  <FaArrowLeft size={20} />
                </button>
              )}
              <Heading title="Send Reminder" size="2xl" color="black" />
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto">
              <FilterButton active={isFilterExpanded} onClick={() => setIsFilterExpanded(!isFilterExpanded)}>
                Filter
              </FilterButton>
              <Button
                icon={FaPlus}
                onClick={handleCreateNew}
                className="bg-primary text-center hover:bg-primary-dark text-white flex-1 sm:flex-initial justify-center"
              >
                <span className="hidden sm:inline">Create New Reminder</span>
                <span className="sm:hidden">Create</span>
              </Button>
            </div>
          </div>

          {/* Filter Section */}
          {isFilterExpanded && (
            <div className="pb-4 border-b border-gray-200 mt-4">
              <ReminderFilterControls
                searchQuery={searchQuery}
                selectedStatus={selectedStatus}
                selectedReminderType={selectedReminderType}
                selectedSendWhen={selectedSendWhen}
                selectedChannels={selectedChannels}
                selectedAudience={selectedAudience}
                onChange={handleFilterChange}
              />
            </div>
          )}
        </div>

        {/* Scrollable Content Container */}
        <div className="max-h-[calc(100vh-250px)] overflow-y-auto">
          {/* Table */}
          {remindersLoading ? (
            <div className="flex justify-center items-center py-12">
              <TableSkeleton rows={10} columns={8} />
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto overflow-y-auto max-h-[400px] lg:max-h-[500px] xl:max-h-[600px]">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-[#EBF5F5] sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-base font-semibold text-black">
                        #
                      </th>
                      <th className="px-6 py-3 text-left text-base font-semibold text-black w-48">
                        Send When
                      </th>
                      <th className="px-6 py-3 text-left text-base font-semibold text-black w-48">
                        Send Times
                      </th>
                      <th className="px-6 py-3 text-left text-base font-semibold text-black">
                        Channels
                      </th>
                      <th className="px-6 py-3 text-left text-base font-semibold text-black">
                        Audience
                      </th>
                      <th className="px-6 py-3 text-left text-base font-semibold text-black">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-base font-semibold text-black">
                        Last Sent
                      </th>
                      <th className="px-6 py-3 text-left text-base font-semibold text-black">
                        Total Sent
                      </th>
                      <th className="px-6 py-3 text-center text-base font-semibold text-black">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedReminders && paginatedReminders.length > 0 ? (
                      paginatedReminders.map((reminder, index) => (
                        <tr key={reminder.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900 break-words">{index + 1}</div>
                          </td>
                          <td className="px-6 py-4 max-w-48">
                            <SendWhenCell reminder={reminder} />
                          </td>
                          <td className="px-6 py-4 max-w-48">
                            <div className="text-sm text-gray-900">{getSendTimes(reminder)}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 break-words">{getActiveChannels(reminder)}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 break-words">{reminder.audience}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={getStatusBadge(reminder.status)}>
                              {reminder.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{formatDate(reminder.lastSent || reminder.last_sent)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{reminder.totalSent || reminder.total_sent || 0}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                            <div className="flex justify-center space-x-2">
                              <button
                                onClick={() => handleView(reminder)}
                                className="p-2 text-gray-600 hover:text-gray-800 transition-colors rounded-full hover:bg-gray-100"
                                title="View Details"
                                disabled={reminderOperationLoading}
                              >
                                <FaEye className="w-[18px] h-[18px] text-primary" />
                              </button>

                              <button
                                onClick={() => handleEdit(reminder)}
                                className="p-2 text-blue-600 hover:text-blue-600 transition-colors rounded-full hover:bg-gray-100"
                                title="Edit Reminder"
                                disabled={reminderOperationLoading}
                              >
                                <FaEdit className="w-[18px] h-[18px] " />
                              </button>

                              <button
                                onClick={() => handleToggleStatus(reminder)}
                                className={`p-2 transition-colors rounded-full hover:bg-gray-100 ${reminder.status === 'Active'
                                  ? 'text-yellow-600 hover:text-yellow-700'
                                  : 'text-green-600 hover:text-green-700'
                                  }`}
                                title={reminder.status === 'Active' ? 'Pause' : 'Activate'}
                                disabled={reminderOperationLoading}
                              >
                                {reminder.status === 'Active' ? (
                                  <FaPause className="w-[18px] h-[18px]" />
                                ) : (
                                  <FaPlay className="w-[18px] h-[18px]" />
                                )}
                              </button>

                              {/* <button
                          onClick={() => handleSendNow(reminder)}
                          className="p-2 text-primary hover:text-primaryHover transition-colors rounded-full hover:bg-gray-100"
                          title="Send Now"
                          disabled={reminderOperationLoading}
                        >
                          <FaPaperPlane className="w-[18px] h-[18px]" />
                        </button> */}

                              <button
                                onClick={() => handleDelete(reminder)}
                                className="p-2 text-red-500 hover:text-red-700 transition-colors rounded-full hover:bg-gray-100"
                                title="Delete"
                                disabled={reminderOperationLoading}
                              >
                                <FaTrash className="w-[18px] h-[18px]" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="8" className="px-6 py-12 text-center">
                          <div className="text-gray-500">
                            <div className="text-lg font-medium mb-2">No Reminder Data Available</div>
                            <div className="text-sm">There are currently no reminders to display for the selected filters.</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-4 p-4">
                {paginatedReminders && paginatedReminders.length > 0 ? (
                  paginatedReminders.map((reminder, index) => (
                    <div
                      key={reminder.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                            <span className={getStatusBadge(reminder.status)}>
                              {reminder.status}
                            </span>
                          </div>
                          <h3 className="text-base font-semibold text-gray-900 mb-2">
                            {reminder.reminderType || reminder.reminder_type || 'N/A'}
                          </h3>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Send When</p>
                          <div className="text-sm text-gray-900">
                            <SendWhenCell reminder={reminder} />
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Send Times</p>
                          <p className="text-sm text-gray-900">{getSendTimes(reminder)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Channels</p>
                          <p className="text-sm text-gray-900">{getActiveChannels(reminder)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Audience</p>
                          <p className="text-sm text-gray-900">{reminder.audience || 'N/A'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Last Sent</p>
                            <p className="text-sm text-gray-900">{formatDate(reminder.lastSent || reminder.last_sent)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Total Sent</p>
                            <p className="text-sm font-medium text-gray-900">{reminder.totalSent || reminder.total_sent || 0}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleView(reminder)}
                            className="p-2 text-gray-600 hover:text-gray-800 transition-colors rounded-full hover:bg-gray-100"
                            title="View Details"
                            disabled={reminderOperationLoading}
                          >
                            <FaEye className="w-4 h-4 text-primary" />
                          </button>
                          <button
                            onClick={() => handleEdit(reminder)}
                            className="p-2 text-blue-600 hover:text-blue-600 transition-colors rounded-full hover:bg-gray-100"
                            title="Edit Reminder"
                            disabled={reminderOperationLoading}
                          >
                            <FaEdit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(reminder)}
                            className={`p-2 transition-colors rounded-full hover:bg-gray-100 ${reminder.status === 'Active'
                              ? 'text-yellow-600 hover:text-yellow-700'
                              : 'text-green-600 hover:text-green-700'
                              }`}
                            title={reminder.status === 'Active' ? 'Pause' : 'Activate'}
                            disabled={reminderOperationLoading}
                          >
                            {reminder.status === 'Active' ? (
                              <FaPause className="w-4 h-4" />
                            ) : (
                              <FaPlay className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleSendNow(reminder)}
                            className="p-2 text-teal-600 hover:text-teal-700 transition-colors rounded-full hover:bg-gray-100"
                            title="Send Now"
                            disabled={reminderOperationLoading}
                          >
                            <FaPaperPlane className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(reminder)}
                            className="p-2 text-red-600 hover:text-red-700 transition-colors rounded-full hover:bg-gray-100"
                            title="Delete"
                            disabled={reminderOperationLoading}
                          >
                            <FaTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12">
                    <EmptyState
                      icon={FaRegBell}
                      title="No Reminders Found"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pagination */}
          {filteredReminders && filteredReminders.length > itemsPerPage && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-4 pt-4 border-t border-gray-200 gap-4">
              <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredReminders.length)} of {filteredReminders.length} reminders
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentPage(prev => Math.max(1, prev - 1));
                  }}
                  disabled={currentPage === 1}
                  className={`px-3 sm:px-4 py-2 sm:py-1 rounded border text-xs sm:text-sm ${currentPage === 1
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={page}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setCurrentPage(page);
                          }}
                          className={`px-3 sm:px-4 py-2 sm:py-1 rounded border text-xs sm:text-sm ${currentPage === page
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-gray-700 hover:bg-gray-50"
                            }`}
                        >
                          {page}
                        </button>
                      );
                    } else if (
                      page === currentPage - 2 ||
                      page === currentPage + 2
                    ) {
                      return <span key={page} className="px-2">...</span>;
                    }
                    return null;
                  })}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentPage(prev => Math.min(totalPages, prev + 1));
                  }}
                  disabled={currentPage === totalPages}
                  className={`px-3 sm:px-4 py-2 sm:py-1 rounded border text-xs sm:text-sm ${currentPage === totalPages
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </ContentBox>

      {/* Modals */}
      <CreateReminderModal
        isOpen={modals.create}
        onClose={() => closeModal('create')}
        onSave={handleSaveReminder}
      />

      <EditReminderModal
        isOpen={modals.edit}
        onClose={() => closeModal('edit')}
        onSave={handleUpdateReminder}
        reminderData={selectedReminder}
      />

      <ViewReminderModal
        isOpen={modals.view}
        onClose={() => closeModal('view')}
        reminderData={selectedReminder}
      />

      {/* Confirmation Modal */}
      {showConfirmation && (
        <ConfirmationMessageBox
          message={confirmationMessage}
          onConfirm={() => {
            if (currentConfirmAction === 'sendNow') {
              handleSendNowConfirmed();
            } else if (currentConfirmAction === 'delete') {
              handleDeleteConfirmed();
            }
          }}
          onCancel={() => {
            setShowConfirmation(false);
            setReminderToDelete(null);
            setCurrentConfirmAction(null);
            setConfirmationMessage('');
          }}
        />
      )}

      {/* Message Box */}
      <MessageBox
        message={messageBox.open ? messageBox.message : null}
        error={messageBox.type === 'error' && messageBox.open ? messageBox.message : null}
        onOk={() => setMessageBox({ open: false, title: '', message: '', type: 'success' })}
        onClose={() => setMessageBox({ open: false, title: '', message: '', type: 'success' })}
        clearMessage={() => setMessageBox({ open: false, title: '', message: '', type: 'success' })}
      />
    </PageContainer>
  );
};

export default RemindersTable;