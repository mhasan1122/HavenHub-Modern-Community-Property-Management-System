import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaMoneyCheckAlt } from 'react-icons/fa';
import { BiFilter } from 'react-icons/bi';
import { useNavigate } from 'react-router-dom';
import MessageBox from '../../../Components/MessageBox/MessageBox';
import ConfirmationMessageBox from '../../../Components/MessageBox/ConfirmationMessageBox';
import ModernLoadingAnimation from '../../../Components/Loaders/ModernLoadingAnimation';
import ScheduleConfigurationForm from './ScheduleConfigurationForm';
import axiosInstance from '../../../utils/axiosInstance';
import Button from '../../../Components/FormComponent/ButtonComponent/Button';
import FilterButton from '../../../Components/FormComponent/ButtonComponent/FilterButton';
import PageContainer from '../../../Components/Ui/PageContainer';
import ContentBox from '../../../Components/Ui/ContentBox';

const ScheduleConfiguration = () => {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, inactive
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [tempStatus, setTempStatus] = useState({ all: true, active: false, inactive: false });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success'); // success or error
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { schedule, message }
  const [isDeleting, setIsDeleting] = useState(false);

  // Load schedules on mount
  useEffect(() => {
    loadSchedules();
  }, [filterStatus]);

  const loadSchedules = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filterStatus === 'active') {
        params.status = 'active';
      } else if (filterStatus === 'inactive') {
        params.status = 'inactive';
      }

      const response = await axiosInstance.get('/api/service-fee-management/generation-schedules/', { params });
      if (response.data.success) {
        setSchedules(response.data.data || []);
      } else {
        setError(response.data.message || 'Failed to load schedules');
      }
    } catch (error) {
      console.error('Error loading schedules:', error);
      setError('Error loading schedules');
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter schedules
  const filteredSchedules = schedules.filter(schedule => {
    const matchesSearch = !searchTerm ||
      schedule.schedule_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.tower_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.service_fee_display?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  // Group schedules by base name and aggregate frequencies
  const frequencyLabel = (value) => {
    if (!value) return 'Monthly';
    const v = String(value).toLowerCase();
    if (v === 'daily') return 'Daily';
    if (v === 'weekly') return 'Weekly';
    return 'Monthly';
  };

  const getBaseName = (name) => {
    if (!name) return '';
    // Take the portion before the first " - "
    const parts = String(name).split(' - ');
    return parts[0] || name;
  };

  const groupedSchedules = React.useMemo(() => {
    const groups = {};
    filteredSchedules.forEach(item => {
      const base = getBaseName(item.schedule_name);
      if (!groups[base]) {
        groups[base] = {
          base_name: base,
          // Keep first item's identity for actions
          id: item.id,
          // preserve representative fields
          tower_name: item.tower_name,
          service_fee_display: item.service_fee_display,
          generation_day: item.generation_day,
          generation_time_display: item.generation_hour !== null && item.generation_minute !== null
            ? `${String(item.generation_hour).padStart(2, '0')}:${String(item.generation_minute).padStart(2, '0')}`
            : 'N/A',
          next_execution_display: item.next_execution_display,
          status: item.status,
          rawItems: [item],
          frequencies: new Set()
        };
      } else {
        groups[base].rawItems.push(item);
      }
      // collect frequency
      groups[base].frequencies.add(frequencyLabel(item.recurring_frequency));
      // Prefer earliest next execution if available
      if (item.next_execution_display && (!groups[base].next_execution_display || String(item.next_execution_display) < String(groups[base].next_execution_display))) {
        groups[base].next_execution_display = item.next_execution_display;
      }
    });
    return Object.values(groups);
  }, [filteredSchedules]);

  const handleCreate = () => {
    setSelectedSchedule(null);
    setShowCreateForm(true);
  };

  const handleEdit = (groupOrSchedule) => {
    // If called with a grouped row, preselect all existing frequencies across raw items
    if (groupOrSchedule && groupOrSchedule.rawItems && groupOrSchedule.frequencies) {
      const base = groupOrSchedule.rawItems[0];
      const labelToValue = { 'Monthly': 'monthly', 'Weekly': 'weekly', 'Daily': 'daily' };
      const aggregated = Array.from(groupOrSchedule.frequencies || [])
        .map(label => labelToValue[label])
        .filter(Boolean);
      setSelectedSchedule({ ...base, recurring_frequencies_all: aggregated });
      setShowEditForm(true);
      return;
    }
    setSelectedSchedule(groupOrSchedule);
    setShowEditForm(true);
  };

  const handleDelete = (schedule) => {
    setDeleteConfirm({
      schedule,
      message: `Are you sure you want to delete the schedule "${schedule.schedule_name}"?`
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    setIsDeleting(true);
    try {
      const response = await axiosInstance.delete(
        `/api/service-fee-management/generation-schedules/${deleteConfirm.schedule.id}/`
      );

      if (response.data.success) {
        setMessage('Schedule deleted successfully');
        setMessageType('success');
        loadSchedules();
      } else {
        setMessage(response.data.message || 'Failed to delete schedule');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      const errorMessage = error.response?.data?.message || 'Error deleting schedule';
      setMessage(errorMessage);
      setMessageType('error');
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
    setIsDeleting(false);
  };

  const handleSuccess = () => {
    setShowCreateForm(false);
    setShowEditForm(false);
    setSelectedSchedule(null);
    setMessage('Schedule saved successfully');
    setMessageType('success');
    loadSchedules();
  };

  if (loading && schedules.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ModernLoadingAnimation />
      </div>
    );
  }

  return (
    <PageContainer>
      <ContentBox>
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-semibold text-gray-900">Service Fee Schedule Configuration</h1>
            <div className="flex items-center gap-3">
              <Button
                icon={FaMoneyCheckAlt}
                onClick={() => navigate('/payment-methods')}
                className="bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm"
              >
                Payment Methods
              </Button>
              <Button
                icon={FaPlus}
                onClick={handleCreate}
                className="bg-primary text-center hover:bg-primary-dark text-white shadow-md shadow-primary/20"
              >
                Create Schedule
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center justify-end mb-4">
            {isFilterExpanded && (
              <div className="flex items-center gap-4 mr-4">
                <input
                  type="text"
                  placeholder="Search by schedule name, tower, or service fee..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-[420px] max-w-[50vw] px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary hover:border-primary"
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary hover:border-primary text-gray-700"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            )}
            <FilterButton active={isFilterExpanded} onClick={() => setIsFilterExpanded(!isFilterExpanded)}>
              Filter
            </FilterButton>
          </div>
        </div>

        {/* Table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-primaryLight">
                <tr>
                  <th className="px-6 py-3 text-left text-base font-semibold text-black">#</th>
                  <th className="px-6 py-3 text-left text-base font-semibold text-black">Schedule Name</th>
                  <th className="px-6 py-3 text-left text-base font-semibold text-black">Tower</th>
                  <th className="px-6 py-3 text-left text-base font-semibold text-black">Service Fee</th>
                  <th className="px-6 py-3 text-left text-base font-semibold text-black">Frequency</th>
                  <th className="px-6 py-3 text-left text-base font-semibold text-black">Generation Day</th>
                  <th className="px-6 py-3 text-left text-base font-semibold text-black">Generation Time</th>
                  <th className="px-6 py-3 text-left text-base font-semibold text-black">Next Execution</th>
                  <th className="px-6 py-3 text-left text-base font-semibold text-black">Status</th>
                  <th className="px-6 py-3 text-center text-base font-semibold text-black">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {groupedSchedules.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-6 py-12 text-center text-gray-500">
                      {loading ? 'Loading schedules...' : 'No schedules found'}
                    </td>
                  </tr>
                ) : (
                  groupedSchedules.map((group, index) => (
                    <tr key={group.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{index + 1}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {group.base_name || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {group.tower_name || 'All Towers'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {group.service_fee_display || 'All Service Fees'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-[220px] whitespace-normal break-words">
                          {(() => {
                            const order = ['Monthly', 'Weekly', 'Daily'];
                            const freqs = Array.from(group.frequencies || []);
                            freqs.sort((a, b) => order.indexOf(a) - order.indexOf(b));
                            return freqs.join(', ');
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">Day {group.generation_day || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{group.generation_time_display}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{group.next_execution_display || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${group.status === 'active'
                              ? 'bg-primary text-white'
                              : 'bg-white text-primary border border-primary'
                            }`}
                        >
                          {group.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(group)}
                            className="p-2 text-primary hover:text-primary hover:bg-primaryLight rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                            title="Edit"
                          >
                            <FaEdit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(group.rawItems[0])}
                            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
                            title="Delete"
                          >
                            <FaTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </ContentBox>

      {/* Modals */}
      {showCreateForm && (
        <ScheduleConfigurationForm
          isOpen={showCreateForm}
          onClose={() => {
            setShowCreateForm(false);
            setSelectedSchedule(null);
          }}
          onSuccess={handleSuccess}
        />
      )}

      {showEditForm && selectedSchedule && (
        <ScheduleConfigurationForm
          isOpen={showEditForm}
          schedule={selectedSchedule}
          onClose={() => {
            setShowEditForm(false);
            setSelectedSchedule(null);
          }}
          onSuccess={handleSuccess}
        />
      )}

      {/* Message Box */}
      {message && (
        <MessageBox
          message={messageType === 'success' ? message : null}
          error={messageType === 'error' ? message : null}
          clearMessage={() => setMessage('')}
          onOk={() => setMessage('')}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmationMessageBox
        message={deleteConfirm?.message || null}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={isDeleting}
      />
    </PageContainer>
  );
};

export default ScheduleConfiguration;

