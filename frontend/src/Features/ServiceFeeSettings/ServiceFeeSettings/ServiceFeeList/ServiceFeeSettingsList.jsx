import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { FaPlus, FaTrash } from "react-icons/fa";
import { FaCaretDown } from "react-icons/fa6";
import { IoMdSettings } from "react-icons/io";
import { BiFilter } from "react-icons/bi";
import { Div } from "../../../../Components/Ui/Div";
import Heading from "../../../../Components/HeadingComponent/Heading";
import { useServiceFees } from "../../../../hooks/useServiceFees";
import CreateServiceFeeForm from "../ServiceFeeCreateForm/CreateServiceFeeForm";
import FilterSelectModal from "../../../../Components/FilterSelect/FilterSelectModal";
import TableSkeleton from "../../../../Components/Loaders/TableSkeleton";
import useSkeletonLoading from "../../../../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../../../../config/skeletonLoadingConfig";
import { PERMISSIONS } from "../../../../constants/permissions";
import styles from './ServiceFeeSettingsList.module.css';
import Button from "../../../../Components/FormComponent/ButtonComponent/Button";
import FilterButton from "../../../../Components/FormComponent/ButtonComponent/FilterButton";
import PageContainer from "../../../../Components/Ui/PageContainer";
import ContentBox from "../../../../Components/Ui/ContentBox";
import EmptyState from "../../../../Components/Ui/EmptyState";
import { naturalSort } from "../../../../utils/serviceFeeUtils";

const getOrdinalSuffix = (day) => {
  const j = day % 10,
    k = day % 100;
  if (j === 1 && k !== 11) {
    return "st";
  }
  if (j === 2 && k !== 12) {
    return "nd";
  }
  if (j === 3 && k !== 13) {
    return "rd";
  }
  return "th";
};

const ServiceFeeSettingsList = () => {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const permissionIds = user?.permission_ids?.map(String) || [];
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Permission checks - Strictly depend on permission IDs
  const canAddServiceFee = permissionIds.includes(String(PERMISSIONS.ADD_SERVICE_FEE_SETTINGS));
  const canViewArchive = permissionIds.includes(String(PERMISSIONS.EDIT_SERVICE_FEE_SETTINGS));
  const [searchTerm, setSearchTerm] = useState("");
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [selectedTowers, setSelectedTowers] = useState([]);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const {
    serviceFees,
    loading,
    error,
    deleteSuccess,
    message,
    activeTab,
    towers,
    loadServiceFees,
    loadTowers,
    removeServiceFee,
    changeActiveTab,
    clearAllErrors,
    clearSuccessMessages
  } = useServiceFees();

  // Load service fees and towers on component mount
  useEffect(() => {
    loadServiceFees({ is_active: 'true', ordering: '-created_at' });
    loadTowers();
  }, [loadServiceFees, loadTowers]);

  // Clear messages after some time
  useEffect(() => {
    if (deleteSuccess && message) {
      const timer = setTimeout(() => {
        clearSuccessMessages();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [deleteSuccess, message, clearSuccessMessages]);

  // Filter service fees based on search and tower (only show active service fees)
  const filteredServiceFees = serviceFees.filter(fee => {
    // First filter: only show active service fees
    const isActive = fee.is_active !== false;

    const matchesSearch = !searchTerm ||
      fee.creator_display?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fee.tower_names?.some(name => name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      fee.unit_names?.some(name => name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesTower = selectedTowers.length === 0 ||
      fee.tower_names?.some(name => selectedTowers.includes(name));

    return isActive && matchesSearch && matchesTower;
  });

  // Sort filtered service fees
  const sortedServiceFees = [...filteredServiceFees].sort((a, b) => {
    let aValue, bValue;

    if (sortBy === "tower_name") {
      aValue = a.tower_names?.[0] || "";
      bValue = b.tower_names?.[0] || "";
    } else if (sortBy === "fee_amount") {
      aValue = parseFloat(a.fee_amount) || 0;
      bValue = parseFloat(b.fee_amount) || 0;
    } else if (sortBy === "created_at") {
      aValue = new Date(a.created_at || 0);
      bValue = new Date(b.created_at || 0);
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

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this service fee setting?")) {
      await removeServiceFee(id);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    loadServiceFees(); // Refresh the list
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
      { id: "created_at-desc", label: "Newest First" },
      { id: "created_at-asc", label: "Oldest First" }
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
      <div className="relative w-full">
        {/* Input box */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            setSortDropdownOpen(!sortDropdownOpen);
          }}
          className={`w-full px-4 py-2.5 bg-white border rounded-lg flex items-center justify-between text-left focus:outline-none transition-all duration-200 cursor-pointer ${sortDropdownOpen
            ? '!border-primary !shadow-ring-primary'
            : 'border-primary focus:border-primary focus:shadow-ring-primary'
            }`}
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
                className={`px-4 py-3 cursor-pointer  transition-colors duration-150 text-sm ${currentValue === option.id ? 'bg-primary text-white' : 'text-gray-700'
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

  return (
    <PageContainer>
      <ContentBox>
        {/* Header with Sticky Filters */}
        <div className="md:sticky top-0 z-20 bg-white pb-4 md:backdrop-blur">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 mb-4 gap-3 sm:gap-0">
            <Heading title="Service Fee Settings" size="2xl" color="black" />
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <FilterButton active={isFilterExpanded} onClick={() => setIsFilterExpanded(!isFilterExpanded)}>
                Filter
              </FilterButton>
              {canViewArchive && (
                <button
                  type="button"
                  onClick={() => navigate('/service-fee-settings/cancelled')}
                  className="flex items-center justify-center px-4 py-[11px] rounded-8 border bg-white border-primary text-primary transition-all duration-300 w-full sm:w-auto"
                >
                  <FaTrash className="mr-2 text-[24px] text-primary" size={20} />
                  <span className="font-lg">Archive List</span>
                </button>
              )}
              {canAddServiceFee && (
                <Button
                  icon={FaPlus}
                  onClick={() => setShowCreateForm(true)}
                  className="bg-primary text-center hover:bg-primary-dark text-white w-full sm:w-auto justify-center"
                >
                  Create New Service Fee
                </Button>
              )}
            </div>
          </div>

          {/* Expanded Filters - Now part of sticky container */}
          {isFilterExpanded && (
            <div className="pb-4 mb-4 bg-white">
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
                    className="w-full h-[42px] pl-4 pr-4 border border-primary rounded-lg focus:outline-none focus:border-primary focus:shadow-ring-primary text-sm text-primary placeholder:text-sm placeholder-primary"
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

        {/* Success Messages Only */}
        {message && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            {message}
          </div>
        )}

        {/* Service Fees List */}
        <div className="bg-white rounded-lg overflow-hidden flex flex-col">
          {showSkeleton && (
            <div className="flex justify-center items-center py-12">
              <TableSkeleton rows={10} columns={6} />
            </div>
          )}

          {!showSkeleton && (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block relative overflow-auto max-h-[calc(100vh-400px)]">
                <table className={`min-w-full ${styles.serviceFeesTable}`}>
                  <thead className="bg-primaryLight sticky top-0 z-10">
                    <tr className="h-11">
                      <th className={`px-2 py-2 text-base font-bold text-black border-b border-gray-200 text-left ${styles.towerNameColumn}`}>
                        Tower Name
                      </th>
                      <th className={`px-2 py-2 text-base font-bold text-black border-b border-gray-200 text-left ${styles.unitsColumn}`}>
                        Units
                      </th>
                      <th className={`px-2 py-2 text-base font-bold text-black border-b border-gray-200 text-right ${styles.feeAmountColumn}`}>
                        Fee Amount (BDT)
                      </th>
                      <th className={`px-2 py-2 text-base font-bold text-black border-b border-gray-200 text-left ${styles.feeAmountColumn}`}>
                        Service Fee Date
                      </th>
                      <th className={`px-2 py-2 text-base font-bold text-black border-b border-gray-200 text-center ${styles.billingCycleColumn}`}>
                        Billing Cycle
                      </th>
                      <th className={`px-2 py-2 text-base font-bold text-black border-b border-gray-200 text-left ${styles.dueDayColumn}`}>
                        Due Day of the Month
                      </th>
                      <th className={`px-2 py-2 text-base font-bold text-black border-b border-gray-200 text-left ${styles.paymentMethodsColumn}`}>
                        Accepted Payment Methods
                      </th>
                      <th className={`px-2 py-2 text-base font-bold text-black border-b border-gray-200 text-left ${styles.paymentMethodsColumn}`}>
                        Late Penalties
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {paginatedServiceFees.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-2 py-8">
                          <EmptyState
                            icon={IoMdSettings}
                            title="No Service Fee Settings Found"
                          />
                        </td>
                      </tr>
                    ) : (
                      paginatedServiceFees.map((fee) => (
                        <tr
                          key={fee.id}
                          className="border-b h-11 hover:bg-gray-50 cursor-pointer"
                          onClick={() => navigate(`/service-fee-settings/${fee.id}`)}
                        >
                          <td className={`px-2 py-2 text-left ${styles.towerNameColumn} ${styles.towerNameCell}`}>
                            <div className={`text-sm font-medium text-gray-900 ${styles.towerNameText}`}>
                              {fee.tower_names?.length > 0 ? [...fee.tower_names].sort(naturalSort).join(", ") : "N/A"}
                            </div>
                          </td>
                          <td className={`px-2 py-2 whitespace-nowrap text-left ${styles.unitsColumn}`}>
                            <div className="text-sm text-gray-900">
                              {fee.unit_names?.length || 0}
                            </div>
                          </td>
                          <td className={`px-2 py-2 whitespace-nowrap text-right ${styles.feeAmountColumn}`}>
                            <div className="text-sm font-medium text-gray-900">
                              {fee.currency === 'BDT' ? '৳' : '$'}
                              {fee.fee_amount}
                            </div>
                          </td>
                          <td className={`px-2 py-2 whitespace-nowrap text-left ${styles.feeAmountColumn}`}>
                            <div className="text-sm text-gray-900">
                              {fee.service_fee_date
                                ? new Date(fee.service_fee_date).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                }).replace(/\//g, '-')
                                : 'N/A'}
                            </div>
                          </td>
                          <td className={`px-2 py-2 whitespace-nowrap text-center ${styles.billingCycleColumn}`}>
                            <div className="text-sm text-gray-900">{fee.billing_cycle}</div>
                          </td>
                          <td className={`px-2 py-2 whitespace-nowrap text-left ${styles.dueDayColumn}`}>
                            <div className="text-sm text-gray-900">
                              {fee.due_day}
                              {getOrdinalSuffix(parseInt(fee.due_day))} of every month
                            </div>
                          </td>
                          <td className={`px-2 py-2 whitespace-nowrap text-left ${styles.paymentMethodsColumn}`}>
                            <div className="text-sm text-gray-900">
                              {(() => {
                                try {
                                  if (fee.payment_methods && Array.isArray(fee.payment_methods)) {
                                    const methods = fee.payment_methods.map((method) => {
                                      if (typeof method === 'string') {
                                        return method;
                                      }
                                      if (typeof method === 'object' && method !== null) {
                                        return method.provider || method.bank_name || method.name || 'Unknown';
                                      }
                                      return 'Unknown';
                                    });
                                    return methods.join(', ');
                                  }

                                  if (fee.payment_methods && typeof fee.payment_methods === 'object') {
                                    const methods = [];
                                    if (fee.accepts_cash) methods.push('Cash');
                                    if (fee.accepts_mfs) methods.push('MFS');
                                    if (fee.accepts_bank) methods.push('Bank');
                                    return methods.length > 0 ? methods.join(', ') : 'N/A';
                                  }

                                  const methods = [];
                                  if (fee.accepts_cash) methods.push('Cash');
                                  if (fee.accepts_mfs) methods.push('MFS');
                                  if (fee.accepts_bank) methods.push('Bank');
                                  return methods.length > 0 ? methods.join(', ') : 'N/A';
                                } catch (error) {
                                  console.error('Error rendering payment methods:', error);
                                  const methods = [];
                                  if (fee.accepts_cash) methods.push('Cash');
                                  if (fee.accepts_mfs) methods.push('MFS');
                                  if (fee.accepts_bank) methods.push('Bank');
                                  return methods.length > 0 ? methods.join(', ') : 'N/A';
                                }
                              })()}
                            </div>
                          </td>
                          <td className={`px-2 py-2 text-left ${styles.paymentMethodsColumn}`}>
                            <div className="text-sm text-gray-900">
                              {fee.late_payment_enabled ? (
                                fee.late_penalty_tiers &&
                                  Array.isArray(fee.late_penalty_tiers) &&
                                  fee.late_penalty_tiers.length > 0 ? (
                                  <div className="space-y-1">
                                    {[...fee.late_penalty_tiers]
                                      .sort((a, b) => (a.days_overdue || 0) - (b.days_overdue || 0))
                                      .map((tier, idx) => (
                                        <div key={idx} className="text-xs">
                                          {tier.days_overdue} days: {tier.penalty_percentage}%
                                        </div>
                                      ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">Enabled (no tiers)</span>
                                )
                              ) : (
                                <span className="text-gray-400">Disabled</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-3 p-4">
                {paginatedServiceFees.length === 0 ? (
                  <div className="bg-white rounded-lg p-6">
                    <EmptyState
                      icon={IoMdSettings}
                      title="No Service Fee Settings Found"
                    />
                  </div>
                ) : (
                  paginatedServiceFees.map((fee) => {
                    const getPaymentMethods = () => {
                      try {
                        if (fee.payment_methods && Array.isArray(fee.payment_methods)) {
                          const methods = fee.payment_methods.map((method) => {
                            if (typeof method === 'string') {
                              return method;
                            }
                            if (typeof method === 'object' && method !== null) {
                              return method.provider || method.bank_name || method.name || 'Unknown';
                            }
                            return 'Unknown';
                          });
                          return methods.join(', ');
                        }

                        if (fee.payment_methods && typeof fee.payment_methods === 'object') {
                          const methods = [];
                          if (fee.accepts_cash) methods.push('Cash');
                          if (fee.accepts_mfs) methods.push('MFS');
                          if (fee.accepts_bank) methods.push('Bank');
                          return methods.length > 0 ? methods.join(', ') : 'N/A';
                        }

                        const methods = [];
                        if (fee.accepts_cash) methods.push('Cash');
                        if (fee.accepts_mfs) methods.push('MFS');
                        if (fee.accepts_bank) methods.push('Bank');
                        return methods.length > 0 ? methods.join(', ') : 'N/A';
                      } catch (error) {
                        const methods = [];
                        if (fee.accepts_cash) methods.push('Cash');
                        if (fee.accepts_mfs) methods.push('MFS');
                        if (fee.accepts_bank) methods.push('Bank');
                        return methods.length > 0 ? methods.join(', ') : 'N/A';
                      }
                    };

                    return (
                      <div
                        key={fee.id}
                        className="bg-white rounded-lg border-2 border-gray-200 p-4 cursor-pointer transition-all duration-300 hover:border-primary/50 hover:shadow-md"
                        onClick={() => navigate(`/service-fee-settings/${fee.id}`)}
                      >
                        <div className="flex items-start justify-between mb-3 pb-3 border-b border-gray-100">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-gray-900 truncate">
                              {fee.tower_names?.length > 0 ? [...fee.tower_names].sort(naturalSort).join(", ") : "N/A"}
                            </h3>
                            <div className="mt-1 text-sm font-medium text-primary">
                              {fee.currency === 'BDT' ? '৳' : '$'}
                              {fee.fee_amount}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center text-sm">
                            <span className="text-gray-500 font-medium w-28 flex-shrink-0">Units:</span>
                            <span className="text-gray-900">{fee.unit_names?.length || 0}</span>
                          </div>

                          <div className="flex items-center text-sm">
                            <span className="text-gray-500 font-medium w-28 flex-shrink-0">Service Date:</span>
                            <span className="text-gray-900">
                              {fee.service_fee_date
                                ? new Date(fee.service_fee_date).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                }).replace(/\//g, '-')
                                : 'N/A'}
                            </span>
                          </div>

                          <div className="flex items-center text-sm">
                            <span className="text-gray-500 font-medium w-28 flex-shrink-0">Billing Cycle:</span>
                            <span className="text-gray-900">{fee.billing_cycle || 'N/A'}</span>
                          </div>

                          <div className="flex items-center text-sm">
                            <span className="text-gray-500 font-medium w-28 flex-shrink-0">Due Day:</span>
                            <span className="text-gray-900">
                              {fee.due_day}
                              {getOrdinalSuffix(parseInt(fee.due_day))} of every month
                            </span>
                          </div>

                          <div className="flex items-start text-sm">
                            <span className="text-gray-500 font-medium w-28 flex-shrink-0">Payment Methods:</span>
                            <span className="text-gray-900 flex-1">{getPaymentMethods()}</span>
                          </div>

                          <div className="flex items-start text-sm">
                            <span className="text-gray-500 font-medium w-28 flex-shrink-0">Late Penalties:</span>
                            <div className="text-gray-900 flex-1">
                              {fee.late_payment_enabled ? (
                                fee.late_penalty_tiers &&
                                  Array.isArray(fee.late_penalty_tiers) &&
                                  fee.late_penalty_tiers.length > 0 ? (
                                  <div className="space-y-1">
                                    {[...fee.late_penalty_tiers]
                                      .sort((a, b) => (a.days_overdue || 0) - (b.days_overdue || 0))
                                      .map((tier, idx) => (
                                        <div key={idx} className="text-xs">
                                          {tier.days_overdue} days: {tier.penalty_percentage}%
                                        </div>
                                      ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-xs">Enabled (no tiers)</span>
                                )
                              ) : (
                                <span className="text-gray-400 text-xs">Disabled</span>
                              )}
                            </div>
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
      </ContentBox>
    </PageContainer>
  );
};


export default ServiceFeeSettingsList;
