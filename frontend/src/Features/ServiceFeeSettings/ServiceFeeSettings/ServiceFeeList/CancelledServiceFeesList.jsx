import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { FaArrowLeft, FaTrash } from "react-icons/fa";
import { MdCancel } from "react-icons/md";
import { BiFilter } from "react-icons/bi";
import { FaCaretDown } from "react-icons/fa6";
import { useServiceFees } from "../../../../hooks/useServiceFees";
import FilterSelectModal from "../../../../Components/FilterSelect/FilterSelectModal";
import TableSkeleton from "../../../../Components/Loaders/TableSkeleton";
import useSkeletonLoading from "../../../../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../../../../config/skeletonLoadingConfig";
import CreateServiceFeeForm from "../ServiceFeeCreateForm/CreateServiceFeeForm";
import ConfirmationMessageBox from "../../../../Components/MessageBox/ConfirmationMessageBox";
import { PERMISSIONS } from "../../../../constants/permissions";
import styles from './ServiceFeeSettingsList.module.css';
import Button from "../../../../Components/FormComponent/ButtonComponent/Button";
import FilterButton from "../../../../Components/FormComponent/ButtonComponent/FilterButton";
import PageContainer from "../../../../Components/Ui/PageContainer";
import ContentBox from "../../../../Components/Ui/ContentBox";
import EmptyState from "../../../../Components/Ui/EmptyState";

const CancelledServiceFeesList = () => {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const permissionIds = user?.permission_ids?.map(String) || [];
  const [searchTerm, setSearchTerm] = useState("");

  // Permission checks - Strictly depend on permission IDs
  const canPermanentlyDelete = permissionIds.includes(String(PERMISSIONS.PERMANENTLY_DELETE_SERVICE_FEE_SETTINGS));
  const canAddServiceFee = permissionIds.includes(String(PERMISSIONS.ADD_SERVICE_FEE_SETTINGS));
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [selectedTowers, setSelectedTowers] = useState([]);
  const [sortBy, setSortBy] = useState("updated_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [feeToDelete, setFeeToDelete] = useState(null);
  const [deleteSuccessful, setDeleteSuccessful] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const {
    serviceFees,
    loading,
    error,
    deleteSuccess,
    deleteError,
    message,
    towers,
    loadServiceFees,
    loadTowers,
    removeServiceFee,
    permanentlyRemoveServiceFee,
    clearSuccessMessages
  } = useServiceFees();

  // Load service fees and towers on component mount
  useEffect(() => {
    loadServiceFees({ is_active: 'false', ordering: '-updated_at' });
    loadTowers();
  }, [loadServiceFees, loadTowers]);

  // Clear success messages after some time
  useEffect(() => {
    if (deleteSuccess && message) {
      const timer = setTimeout(() => {
        clearSuccessMessages();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [deleteSuccess, message, clearSuccessMessages]);


  // Filter cancelled service fees based on search and tower
  const filteredServiceFees = serviceFees.filter(fee => {
    const matchesSearch = !searchTerm ||
      fee.creator_display?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fee.tower_names?.some(name => name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      fee.unit_names?.some(name => name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesTower = selectedTowers.length === 0 ||
      fee.tower_names?.some(name => selectedTowers.includes(name));

    return matchesSearch && matchesTower;
  });

  // Sort filtered service fees by updated_at (most recently cancelled first)
  const sortedFilteredServiceFees = [...filteredServiceFees].sort((a, b) => {
    const aDate = new Date(a.updated_at || 0);
    const bDate = new Date(b.updated_at || 0);
    return bDate - aDate; // Most recent first
  });

  // Sort filtered service fees (use the pre-sorted array as base, then apply user sorting)
  const sortedServiceFees = [...sortedFilteredServiceFees].sort((a, b) => {
    let aValue, bValue;

    if (sortBy === "tower_name") {
      aValue = a.tower_names?.[0] || "";
      bValue = b.tower_names?.[0] || "";
    } else if (sortBy === "fee_amount") {
      aValue = parseFloat(a.fee_amount) || 0;
      bValue = parseFloat(b.fee_amount) || 0;
    } else if (sortBy === "updated_at") {
      aValue = new Date(a.updated_at || 0);
      bValue = new Date(b.updated_at || 0);
    } else {
      aValue = a[sortBy] || "";
      bValue = b[sortBy] || "";
    }

    if (sortOrder === "asc") {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedTowers, sortBy, sortOrder]);

  // Pagination calculations
  const totalPages = Math.ceil((sortedServiceFees?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedServiceFees = sortedServiceFees?.slice(startIndex, endIndex) || [];

  const handleBack = () => {
    navigate('/service-fee-settings');
  };

  const handleDelete = (id, feeName) => {
    setFeeToDelete({ id, feeName });
    setShowConfirmation(true);
  };

  const handleConfirmDelete = async () => {
    if (feeToDelete) {
      try {
        // Use permanent delete API
        const result = await permanentlyRemoveServiceFee(feeToDelete.id);

        // Check if deletion was successful
        if (result.type.endsWith('/fulfilled')) {
          // Show success message in the same modal
          setDeleteSuccessful(true);

          // Refresh the list after deletion
          loadServiceFees({ is_active: 'false', ordering: '-updated_at' });
        } else {
          // Handle error case
          console.error('Failed to permanently delete service fee:', result.payload);
          setShowConfirmation(false);
          setFeeToDelete(null);
        }
      } catch (error) {
        console.error('Error permanently deleting service fee:', error);
        setShowConfirmation(false);
        setFeeToDelete(null);
      }
    }
  };

  const handleCancelDelete = () => {
    setShowConfirmation(false);
    setFeeToDelete(null);
    setDeleteSuccessful(false);
  };

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    loadServiceFees({ is_active: 'false', ordering: '-updated_at' }); // Refresh only cancelled service fees
  };

  // Click outside handler for sort dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortDropdownOpen) {
        setSortDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [sortDropdownOpen]);

  // Custom SortBy Dropdown Component
  const SortByDropdown = () => {
    const sortOptions = [
      { id: "tower_name-asc", label: "Tower Name (A-Z)" },
      { id: "tower_name-desc", label: "Tower Name (Z-A)" },
      { id: "fee_amount-asc", label: "Fee Amount (Low-High)" },
      { id: "fee_amount-desc", label: "Fee Amount (High-Low)" },
      { id: "updated_at-desc", label: "Recently Cancelled" },
      { id: "updated_at-asc", label: "Oldest Cancelled" }
    ];

    const currentValue = `${sortBy}-${sortOrder}`;
    const currentOption = sortOptions.find(option => option.id === currentValue);

    const handleSortChange = (optionId) => {
      const [newSortBy, newSortOrder] = optionId.split("-");
      setSortBy(newSortBy);
      setSortOrder(newSortOrder);
      setSortDropdownOpen(false);
    };

    return (
      <div className="relative" style={{ width: "100%" }}>
        {/* Input box */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            setSortDropdownOpen(!sortDropdownOpen);
          }}
          className="w-full px-4 py-2.5 bg-white border border-primary rounded-lg flex items-center justify-between text-left focus:outline-none transition-all duration-200 cursor-pointer"
        >
          <span className={currentOption ? "text-primary font-medium text-sm" : "text-gray-500 text-sm"}>
            {currentOption ? currentOption.label : "Select sorting option"}
          </span>
          <FaCaretDown className={`text-primary transition-transform duration-200 ${sortDropdownOpen ? 'rotate-180' : ''}`} />
        </div>

        {/* Dropdown */}
        {sortDropdownOpen && (
          <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto mt-1">
            {sortOptions.map((option) => (
              <div
                key={option.id}
                onClick={() => handleSortChange(option.id)}
                className={`px-4 py-3 cursor-pointer transition-colors duration-150 text-sm ${currentValue === option.id ? 'bg-primary text-white' : 'text-gray-700'
                  }`}
              >
                {option.label}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Use skeleton loading hook to ensure minimum display time and data validation
  const showSkeleton = useSkeletonLoading(
    loading,
    serviceFees,
    SKELETON_MIN_DISPLAY_TIME
  );

  if (showSkeleton) {
    return (
      <div className="flex justify-center items-center py-12">
        <TableSkeleton rows={10} columns={6} />
      </div>
    );
  }

  return (
    <PageContainer>
      <ContentBox>
        {/* Header */}
        <div className="md:sticky top-0 z-20 bg-white pb-4 md:backdrop-blur">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3 sm:gap-0">
            <div className="w-full sm:w-auto">
              <div className="flex items-center mb-2">
                <button
                  onClick={handleBack}
                  className="flex items-center text-gray-900 hover:text-primary transition-colors text-sm sm:text-base"
                >
                  <FaArrowLeft className="w-4 h-4 mr-2" />
                  <span className="whitespace-nowrap">Back to Service Fee Settings</span>
                </button>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Archive List</h1>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <FilterButton active={isFilterExpanded} onClick={() => setIsFilterExpanded(!isFilterExpanded)}>
                Filter
              </FilterButton>
              {canAddServiceFee && (
                <Button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-primary text-center hover:bg-primary-dark text-white w-full sm:w-auto justify-center"
                >
                  Create New Service Fee
                </Button>
              )}
            </div>
          </div>

          {/* Error Messages */}
          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error.message || error}
            </div>
          )}

          {deleteError && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {deleteError.message || deleteError}
            </div>
          )}

          {/* Expanded Filters */}
          {isFilterExpanded && (
            <div className="pb-4 mb-4 bg-white border-b border-gray-200">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 sm:gap-6">
                <div className="w-full sm:min-w-[200px]">
                  <FilterSelectModal
                    placeholder="Select Tower"
                    options={(towers || []).map(tower => ({
                      value: tower.tower_name,
                      label: tower.tower_name
                    }))}
                    value={selectedTowers}
                    onApply={setSelectedTowers}
                    className="w-full"
                  />
                </div>

                <div className="w-full sm:min-w-[200px]">
                  <input
                    type="text"
                    placeholder="Search by creator, tower, or unit..."
                    className="w-full h-[42px] pl-4 pr-4 border border-primary rounded-lg focus:outline-none focus:border-primary focus:shadow-ring-primary text-sm text-primary placeholder-primary"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="w-full sm:min-w-[200px]">
                  <SortByDropdown />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Cancelled Service Fees List */}
        <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <TableSkeleton rows={10} columns={6} />
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block h-[650px] flex flex-col overflow-x-auto">
                {/* Fixed Header */}
                <div className="flex-shrink-0">
                  <table className={`min-w-full ${styles.serviceFeesTable}`}>
                    <thead className="bg-[#EBF5F5] sticky top-0 z-10">
                      <tr>
                        <th className={`px-6 py-3 text-left text-base font-semibold text-black border-b border-borderLight ${styles.towerNameColumn}`}>
                          Tower Name
                        </th>
                        <th className={`px-6 py-3 text-left text-base font-semibold text-black border-b border-gray-200 ${styles.unitsColumn}`}>
                          Units
                        </th>
                        <th className={`px-6 py-3 text-left text-base font-semibold text-black border-b border-gray-200 ${styles.feeAmountColumn}`}>
                          Fee Amount (BDT)
                        </th>
                        <th className={`px-6 py-3 text-left text-base font-semibold text-black border-b border-gray-200 ${styles.feeAmountColumn}`}>
                          Service Fee Date
                        </th>
                        <th className={`px-6 py-3 text-left text-base font-semibold text-black border-b border-gray-200 ${styles.billingCycleColumn}`}>
                          Billing Cycle
                        </th>
                        <th className={`px-6 py-3 text-left text-base font-semibold text-black border-b border-gray-200 ${styles.dueDayColumn}`}>
                          Due Day of the Month
                        </th>
                        <th className={`px-6 py-3 text-left text-base font-semibold text-black border-b border-gray-200 ${styles.paymentMethodsColumn}`}>
                          Accepted Payment Methods
                        </th>
                      </tr>
                    </thead>
                  </table>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto">
                  <table className={`min-w-full ${styles.serviceFeesTable}`}>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {error ? (
                        <tr>
                          <td colSpan="7" className="px-6 py-8 text-center">
                            <div className="text-red-600 mb-2">Error loading cancelled service fees</div>
                            <div className="text-sm text-gray-500">{error.message || error}</div>
                          </td>
                        </tr>
                      ) : paginatedServiceFees.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-6 py-8 text-center">
                            <EmptyState
                              icon={MdCancel}
                              title="No Archived Service Fees Found"
                              description={searchTerm && "Try adjusting your search criteria"}
                            />
                          </td>
                        </tr>
                      ) : (
                        paginatedServiceFees.map((fee) => (
                          <tr key={fee.id}>
                            <td className={`px-6 py-4 ${styles.towerNameColumn} ${styles.towerNameCell}`}>
                              <div className={`text-sm font-medium text-gray-900 ${styles.towerNameText}`}>
                                {fee.tower_names?.length > 0 ? fee.tower_names.join(", ") : "N/A"}
                              </div>
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap ${styles.unitsColumn}`}>
                              <div className="text-sm text-gray-900">
                                {fee.unit_names?.length || 0}
                              </div>
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap ${styles.feeAmountColumn}`}>
                              <div className="text-sm font-medium text-gray-900">
                                {fee.currency === 'BDT' ? '৳' : '$'}{fee.fee_amount}
                              </div>
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap ${styles.feeAmountColumn}`}>
                              <div className="text-sm text-gray-900">
                                {fee.service_fee_date
                                  ? new Date(fee.service_fee_date).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric'
                                  }).replace(/\//g, '-')
                                  : 'N/A'}
                              </div>
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap ${styles.billingCycleColumn}`}>
                              <div className="text-sm text-gray-900">{fee.billing_cycle}</div>
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap ${styles.dueDayColumn}`}>
                              <div className="text-sm text-gray-900">
                                {fee.due_day}th of every month
                              </div>
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap ${styles.paymentMethodsColumn}`}>
                              <div className="text-sm text-gray-900">
                                {(() => {
                                  try {
                                    if (fee.payment_methods && Array.isArray(fee.payment_methods)) {
                                      const methods = fee.payment_methods.map(method => {
                                        if (typeof method === 'string') {
                                          return method;
                                        } else if (typeof method === 'object' && method !== null) {
                                          return method.provider || method.bank_name || method.name || 'Unknown';
                                        }
                                        return 'Unknown';
                                      });
                                      return methods.join(", ");
                                    } else if (fee.payment_methods && typeof fee.payment_methods === 'object') {
                                      const methods = [];
                                      if (fee.accepts_cash) methods.push('Cash');
                                      if (fee.accepts_mfs) methods.push('MFS');
                                      if (fee.accepts_bank) methods.push('Bank');
                                      return methods.length > 0 ? methods.join(", ") : "N/A";
                                    } else {
                                      const methods = [];
                                      if (fee.accepts_cash) methods.push('Cash');
                                      if (fee.accepts_mfs) methods.push('MFS');
                                      if (fee.accepts_bank) methods.push('Bank');
                                      return methods.length > 0 ? methods.join(", ") : "N/A";
                                    }
                                  } catch (error) {
                                    console.error('Error rendering payment methods:', error);
                                    const methods = [];
                                    if (fee.accepts_cash) methods.push('Cash');
                                    if (fee.accepts_mfs) methods.push('MFS');
                                    if (fee.accepts_bank) methods.push('Bank');
                                    return methods.length > 0 ? methods.join(", ") : "N/A";
                                  }
                                })()}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-3 p-4">
                {error ? (
                  <div className="bg-white rounded-lg p-6">
                    <div className="text-red-600 mb-2">Error loading cancelled service fees</div>
                    <div className="text-sm text-gray-500">{error.message || error}</div>
                  </div>
                ) : paginatedServiceFees.length === 0 ? (
                  <div className="bg-white rounded-lg p-6">
                    <EmptyState
                      icon={MdCancel}
                      title="No Archived Service Fees Found"
                      description={searchTerm && "Try adjusting your search criteria"}
                    />
                  </div>
                ) : (
                  paginatedServiceFees.map((fee) => {
                    const getPaymentMethods = () => {
                      try {
                        if (fee.payment_methods && Array.isArray(fee.payment_methods)) {
                          const methods = fee.payment_methods.map(method => {
                            if (typeof method === 'string') {
                              return method;
                            } else if (typeof method === 'object' && method !== null) {
                              return method.provider || method.bank_name || method.name || 'Unknown';
                            }
                            return 'Unknown';
                          });
                          return methods.join(", ");
                        } else if (fee.payment_methods && typeof fee.payment_methods === 'object') {
                          const methods = [];
                          if (fee.accepts_cash) methods.push('Cash');
                          if (fee.accepts_mfs) methods.push('MFS');
                          if (fee.accepts_bank) methods.push('Bank');
                          return methods.length > 0 ? methods.join(", ") : "N/A";
                        } else {
                          const methods = [];
                          if (fee.accepts_cash) methods.push('Cash');
                          if (fee.accepts_mfs) methods.push('MFS');
                          if (fee.accepts_bank) methods.push('Bank');
                          return methods.length > 0 ? methods.join(", ") : "N/A";
                        }
                      } catch (error) {
                        const methods = [];
                        if (fee.accepts_cash) methods.push('Cash');
                        if (fee.accepts_mfs) methods.push('MFS');
                        if (fee.accepts_bank) methods.push('Bank');
                        return methods.length > 0 ? methods.join(", ") : "N/A";
                      }
                    };

                    return (
                      <div
                        key={fee.id}
                        className="bg-white rounded-lg border-2 border-gray-200 p-4 transition-all duration-300 hover:border-primary/50 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between mb-3 pb-3 border-b border-gray-100">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-gray-900 truncate">
                              {fee.tower_names?.length > 0 ? fee.tower_names.join(", ") : "N/A"}
                            </h3>
                            <div className="mt-1 text-sm font-medium text-primary">
                              {fee.currency === 'BDT' ? '৳' : '$'}
                              {fee.fee_amount}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center text-sm">
                            <span className="text-gray-500 font-medium w-28 md:w-32 flex-shrink-0">Units:</span>
                            <span className="text-gray-900">{fee.unit_names?.length || 0}</span>
                          </div>

                          <div className="flex items-center text-sm">
                            <span className="text-gray-500 font-medium w-28 md:w-32 flex-shrink-0">Service Date:</span>
                            <span className="text-gray-900">
                              {fee.service_fee_date
                                ? new Date(fee.service_fee_date).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                }).replace(/\//g, '-')
                                : 'N/A'}
                            </span>
                          </div>

                          <div className="flex items-center text-sm">
                            <span className="text-gray-500 font-medium w-28 md:w-32 flex-shrink-0">Billing Cycle:</span>
                            <span className="text-gray-900">{fee.billing_cycle || 'N/A'}</span>
                          </div>

                          <div className="flex items-center text-sm">
                            <span className="text-gray-500 font-medium w-28 md:w-32 flex-shrink-0">Due Day:</span>
                            <span className="text-gray-900">{fee.due_day}th of every month</span>
                          </div>

                          <div className="flex items-start text-sm">
                            <span className="text-gray-500 font-medium w-28 md:w-32 flex-shrink-0">Payment Methods:</span>
                            <span className="text-gray-900 flex-1">{getPaymentMethods()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        {sortedServiceFees && sortedServiceFees.length > itemsPerPage && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 mt-4 pt-4 border-t border-gray-200 pb-2">
            <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
              Showing {startIndex + 1} to {Math.min(endIndex, sortedServiceFees.length)} of {sortedServiceFees.length} service fees
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentPage(prev => Math.max(1, prev - 1));
                }}
                disabled={currentPage === 1}
                className={`px-3 py-2 sm:py-1 rounded border text-sm min-h-[44px] sm:min-h-0 active:scale-95 ${currentPage === 1
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
                        className={`px-3 py-2 sm:py-1 rounded border text-sm min-h-[44px] sm:min-h-0 active:scale-95 ${currentPage === page
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
                className={`px-3 py-2 sm:py-1 rounded border text-sm min-h-[44px] sm:min-h-0 active:scale-95 ${currentPage === totalPages
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Create Form Modal */}
        {showCreateForm && (
          <CreateServiceFeeForm
            onClose={() => setShowCreateForm(false)}
            onSuccess={handleCreateSuccess}
          />
        )}

        {/* Confirmation Modal */}
        {showConfirmation && (
          <ConfirmationMessageBox
            message={
              deleteSuccessful
                ? "Service fee has been permanently deleted."
                : "Are you sure you want to permanently delete this service fee? This action cannot be undone and will remove all data from the database."
            }
            onConfirm={deleteSuccessful ? undefined : handleConfirmDelete}
            onCancel={handleCancelDelete}
            isSuccess={deleteSuccessful}
            showCancel={!deleteSuccessful}
          />
        )}
      </ContentBox>
    </PageContainer>
  );
};

export default CancelledServiceFeesList;
