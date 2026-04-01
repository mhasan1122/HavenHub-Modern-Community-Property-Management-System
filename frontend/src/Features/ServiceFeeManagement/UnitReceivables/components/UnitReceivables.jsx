import { useState, useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { FaMagnifyingGlass, FaCaretDown } from 'react-icons/fa6';
import { TbCoinTaka } from "react-icons/tb";
import { MdOutlineAdUnits } from "react-icons/md";
import ModernLoadingAnimation from '../../../../Components/Loaders/ModernLoadingAnimation';
import TableSkeleton from '../../../../Components/Loaders/TableSkeleton';
import { fetchUnitOutstandingSummary, fetchFilterOptions } from '../../../../redux/slices/api/serviceFeeManagement/serviceFeeManagementApi';
import { clearAllStates, clearErrors } from '../../../../redux/slices/serviceFeeManagement/serviceFeeManagementSlice';
import PageContainer from '../../../../Components/Ui/PageContainer';
import ContentBox from '../../../../Components/Ui/ContentBox';
import EmptyState from '../../../../Components/Ui/EmptyState';
import Heading from '../../../../Components/HeadingComponent/Heading';
import FilterButton from '../../../../Components/FormComponent/ButtonComponent/FilterButton';
import FilterSelectModal from '../../../../Components/FilterSelect/FilterSelectModal';
import useSkeletonLoading from '../../../../hooks/useSkeletonLoading';
import { SKELETON_MIN_DISPLAY_TIME } from '../../../../config/skeletonLoadingConfig';
import SearchInput from '../../../../Components/SearchInput/SearchInput';

const UnitReceivablesPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Redux state
  const serviceFeeState = useSelector(state => state.serviceFeeManagement) || {};
  const {
    outstandingSummary: payments = [],
    outstandingSummaryLoading: loading = false,
    outstandingSummaryError: error = null,
    outstandingSummaryStats: stats = {},
    filterOptions = { towers: [] },
    filterOptionsLoading = false,
    receivablesFilters = {} // Persisted filters
  } = serviceFeeState;

  // Local state initialized from Redux (for persistence)
  const [searchQuery, setSearchQuery] = useState(receivablesFilters.searchQuery || '');
  const [isInitialLoad, setIsInitialLoad] = useState(payments.length === 0);
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [selectedTowers, setSelectedTowers] = useState(receivablesFilters.selectedTowers || []);
  const [sortBy, setSortBy] = useState(receivablesFilters.sortBy || 'tower_name');
  const [sortOrder, setSortOrder] = useState(receivablesFilters.sortOrder || 'asc');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  // Track if this is the first mount to prevent redundant fetch if data exists in cache
  const isFirstMount = useRef(true);
  const lastUsedFilters = useRef({
    search: receivablesFilters.searchQuery || '',
    towers: receivablesFilters.selectedTowers || []
  });

  // Pagination state initialized from Redux
  const [currentPage, setCurrentPage] = useState(receivablesFilters.currentPage || 1);
  const itemsPerPage = 8; // Match design/performance

  // Synchronize local filter state with Redux (persists filters on navigate away)
  useEffect(() => {
    dispatch({
      type: 'serviceFeeManagement/setReceivablesFilters',
      payload: { searchQuery, selectedTowers, sortBy, sortOrder, currentPage }
    });
  }, [dispatch, searchQuery, selectedTowers, sortBy, sortOrder, currentPage]);

  // Fetch filter options on mount
  useEffect(() => {
    // Only fetch if we don't have towers yet (prevents redundant calls on back navigation)
    if (filterOptions.towers.length === 0) {
      dispatch(fetchFilterOptions());
    }
  }, [dispatch, filterOptions.towers.length]);

  // Fetch outstanding units data
  useEffect(() => {
    // 1. On first mount, if we have data, just sync our "last used" ref and skip the call
    if (isFirstMount.current) {
      isFirstMount.current = false;
      if (payments.length > 0) {
        lastUsedFilters.current = { search: searchQuery, towers: selectedTowers };
        return; // Skip fetch on mount if we have cached data
      }
    }

    // 2. Check if filters actually changed from what produced the current 'payments' data
    const filtersChanged =
      searchQuery !== lastUsedFilters.current.search ||
      JSON.stringify(selectedTowers) !== JSON.stringify(lastUsedFilters.current.towers);

    // 3. Skip if nothing changed and we already have data OR if we are already loading
    if ((!filtersChanged && payments.length > 0) || loading) {
      return;
    }

    // 4. Only skip if towers are selected but we don't have mapping options yet (wait for filterOptions)
    const hasTowersButNoFilterData = selectedTowers.length > 0 && (filterOptions.towers || []).length === 0;
    if (hasTowersButNoFilterData) return;

    const fetchOutstandingUnits = async () => {
      // Final check: if we're technically already showing data that matches these filters, STOP
      const isAlreadyShowingCorrectData =
        payments.length > 0 &&
        searchQuery === lastUsedFilters.current.search &&
        JSON.stringify(selectedTowers) === JSON.stringify(lastUsedFilters.current.towers);

      if (isAlreadyShowingCorrectData && !isFirstMount.current) return;

      dispatch(clearErrors());
      const towerIds = selectedTowers.length > 0 ? selectedTowers.map(t => {
        const option = (filterOptions.towers || []).find(opt => opt.label === t);
        return option ? option.value : t;
      }).join(',') : null;

      const filterParams = {
        tower_id: towerIds,
        search: searchQuery
      };

      // Update refs and perform fetch
      lastUsedFilters.current = { search: searchQuery, towers: selectedTowers };
      await dispatch(fetchUnitOutstandingSummary(filterParams));
    };

    fetchOutstandingUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, searchQuery, selectedTowers, (selectedTowers.length > 0 && (filterOptions.towers || []).length > 0), loading, payments.length]);

  // Handle initial load completion
  useEffect(() => {
    if (!loading && payments) {
      setIsInitialLoad(false);
    }
  }, [loading, payments]);

  // Aggregate raw vouchers into unit summaries if backend returns raw data
  const { aggregatedUnits, calculatedStats } = useMemo(() => {
    if (!payments || !Array.isArray(payments)) return { aggregatedUnits: [], calculatedStats: { total_units: 0, total_outstanding: 0, total_unpaid_bills: 0 } };

    // If data is already aggregated (has outstanding_amount), return as is
    if (payments.length > 0 && payments[0].outstanding_amount !== undefined) {
      return {
        aggregatedUnits: payments,
        calculatedStats: {
          total_units: stats.total_units || payments.length,
          total_outstanding: stats.total_outstanding || 0,
          total_unpaid_bills: stats.total_unpaid_bills || 0
        }
      };
    }

    // Otherwise, aggregate raw voucher results
    const groups = payments.reduce((acc, row) => {
      const id = row.unit_id;
      if (!id) return acc;

      if (!acc[id]) {
        acc[id] = {
          unit_id: id,
          unit_name: row.unit_display || row.unit_name || 'N/A',
          resident_name: row.primary_name || row.resident_name || 'N/A',
          tower_name: row.tower_name || 'N/A',
          outstanding_amount: 0,
          unpaid_bills_count: 0,
          seen_bills: new Set(),
        };
      }

      const debit = parseFloat(row.debit) || 0;
      const credit = parseFloat(row.credit) || 0;
      acc[id].outstanding_amount += (debit - credit);

      // Count unpaid bills: Check if this row represents a bill that isn't fully paid
      const type = (row.type || '').toLowerCase();
      const isBill = type === 'servicefeebill' || type === 'service fee bill' || (row.referenceNumber && row.referenceNumber.startsWith('BILL-'));

      if (isBill) {
        // Explicitly check for unpaid statuses (due, partial, overdue) as requested
        const isUnpaid = ['due', 'partial', 'overdue'].includes(row.service_status);
        if (isUnpaid && !acc[id].seen_bills.has(row.referenceNumber)) {
          acc[id].seen_bills.add(row.referenceNumber);
          acc[id].unpaid_bills_count += 1;
        }
      }

      return acc;
    }, {});

    // Do not filter out units with zero outstanding balance as per user request
    const unitList = Object.values(groups);

    const total_outstanding = unitList.reduce((sum, u) => sum + u.outstanding_amount, 0);
    const total_unpaid_bills = unitList.reduce((sum, u) => sum + u.unpaid_bills_count, 0);

    return {
      aggregatedUnits: unitList,
      calculatedStats: {
        total_units: unitList.length,
        total_outstanding,
        total_unpaid_bills
      }
    };
  }, [payments, stats]);

  // Sort outstanding units (Still useful for client-side sorting of the current result set)
  const sortedUnits = useMemo(() => {
    const sorted = [...aggregatedUnits].sort((a, b) => {
      let aValue, bValue;

      if (sortBy === 'outstanding_amount') {
        aValue = parseFloat(a.outstanding_amount) || 0;
        bValue = parseFloat(b.outstanding_amount) || 0;
      } else if (sortBy === 'unpaid_bills_count') {
        aValue = parseInt(a.unpaid_bills_count) || 0;
        bValue = parseInt(b.unpaid_bills_count) || 0;
      } else if (sortBy === 'tower_name') {
        aValue = String(a.tower_name || '').toLowerCase();
        bValue = String(b.tower_name || '').toLowerCase();
      } else if (sortBy === 'unit_name') {
        aValue = String(a.unit_name || '').toLowerCase();
        bValue = String(b.unit_name || '').toLowerCase();
      } else if (sortBy === 'resident_name') {
        aValue = String(a.resident_name || '').toLowerCase();
        bValue = String(b.resident_name || '').toLowerCase();
      } else {
        aValue = String(a[sortBy] || '').toLowerCase();
        bValue = String(b[sortBy] || '').toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return sorted;
  }, [payments, sortBy, sortOrder]);

  const filteredUnits = sortedUnits; // Search is handled by API

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTowers, sortBy, sortOrder]);

  // Pagination calculations
  const totalPages = Math.ceil((filteredUnits?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUnits = filteredUnits?.slice(startIndex, endIndex) || [];

  const formatCurrency = (value) => {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
      return '৳ 0.00';
    }
    return `৳ ${numericValue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const handleViewLedger = (unitId) => {
    navigate(`/unit-ledger/${unitId}`);
  };

  // Custom SortBy Dropdown Component
  const SortByDropdown = () => {
    const sortOptions = [
      { id: "tower_name-asc", label: "Tower Name (A-Z)" },
      { id: "tower_name-desc", label: "Tower Name (Z-A)" },
      { id: "unit_name-asc", label: "Unit (A-Z)" },
      { id: "unit_name-desc", label: "Unit (Z-A)" },
      { id: "outstanding_amount-asc", label: "Outstanding Amount (Low-High)" },
      { id: "outstanding_amount-desc", label: "Outstanding Amount (High-Low)" },
      { id: "unpaid_bills_count-asc", label: "Unpaid Bills (Low-High)" },
      { id: "unpaid_bills_count-desc", label: "Unpaid Bills (High-Low)" },
      { id: "resident_name-asc", label: "Resident Name (A-Z)" },
      { id: "resident_name-desc", label: "Resident Name (Z-A)" }
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
                className={`px-4 py-3 cursor-pointer transition-colors duration-150 text-sm ${currentValue === option.id ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-50'
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

  // Get tower names for filter options
  const availableTowers = useMemo(() => {
    return (filterOptions.towers || []).map(tower => ({
      value: tower.label,
      label: tower.label
    }));
  }, [filterOptions.towers]);

  const totalUnits = calculatedStats.total_units || 0;

  // Use skeleton loading hook
  const showSkeleton = useSkeletonLoading(
    loading && !isInitialLoad,
    payments,
    SKELETON_MIN_DISPLAY_TIME
  );

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

  // Show loading animation only on initial window load
  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ModernLoadingAnimation />
      </div>
    );
  }

  return (
    <PageContainer>
      <ContentBox>
        {/* Header with Sticky Filters */}
        <div className="md:sticky top-0 z-20 bg-white pb-4 md:backdrop-blur">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 mb-4 gap-4">
            <Heading title="Unit Receivables" size="2xl" color="black" />
            <div className="flex items-center space-x-4 w-full sm:w-auto">
              <FilterButton active={isFilterExpanded} onClick={() => setIsFilterExpanded(!isFilterExpanded)}>
                Filter
              </FilterButton>
            </div>
          </div>
        </div>
        {/* Summary Statistics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3 sm:gap-4 mb-4">
          <div className="bg-blue-50 border border-blue-200 p-3 sm:p-4 rounded-lg shadow-sm">
            <div className="text-xs sm:text-sm font-medium text-blue-600">Total Units</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-blue-900">{totalUnits}</div>
            <div className="text-xs sm:text-sm text-blue-700">With outstanding balances</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 p-3 sm:p-4 rounded-lg shadow-sm">
            <div className="text-xs sm:text-sm font-medium text-orange-600">Total Outstanding</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-orange-900 truncate">{formatCurrency(calculatedStats.total_outstanding || 0)}</div>
            <div className="text-xs sm:text-sm text-orange-700">Total amount due</div>
          </div>
          <div className="bg-red-50 border border-red-200 p-3 sm:p-4 rounded-lg shadow-sm">
            <div className="text-xs sm:text-sm font-medium text-red-600">Unpaid Bills</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-red-900">{calculatedStats.total_unpaid_bills || 0}</div>
            <div className="text-xs sm:text-sm text-red-700">Pending invoices</div>
          </div>
        </div>

        {/* Expanded Filters */}
        {isFilterExpanded && (
          <div className="pb-4 mb-4 bg-white">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:space-x-6">
              {availableTowers.length > 0 && (
                <div className="w-full sm:min-w-[200px]">
                  <FilterSelectModal
                    placeholder="Select Tower"
                    options={availableTowers}
                    value={selectedTowers}
                    onApply={setSelectedTowers}
                    className="w-full"
                  />
                </div>
              )}

              <div className="w-full sm:min-w-[200px]">
                <SearchInput
                  placeholder="Search by tower, unit, or resident..."
                  value={searchQuery}
                  onChange={setSearchQuery}
                  className="w-full"
                />
              </div>

              <div className="w-full sm:min-w-[200px]">
                <SortByDropdown />
              </div>
            </div>
          </div>
        )}


        {/* Table Section */}
        <div className="bg-white rounded-lg overflow-hidden flex flex-col">
          {showSkeleton ? (
            <div className="flex justify-center items-center py-12">
              <TableSkeleton rows={10} columns={6} />
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block relative overflow-hidden max-h-[calc(100vh-500px)] flex flex-col min-h-0">
                <div className="overflow-auto flex-1">
                  <table className="min-w-full">
                    <thead className="bg-primaryLight sticky top-0 z-10 shadow-sm">
                      <tr className="h-11">
                        <th className="px-6 py-3 text-base font-bold text-black border-b border-gray-200 text-left">
                          #
                        </th>
                        <th className="px-6 py-3 text-base font-bold text-black border-b border-gray-200 text-left">
                          Tower
                        </th>
                        <th className="px-6 py-3 text-base font-bold text-black border-b border-gray-200 text-center">
                          Unit
                        </th>
                        <th className="px-6 py-3 text-base font-bold text-black border-b border-gray-200 text-left">
                          Resident Name
                        </th>
                        <th className="px-6 py-3 text-base font-bold text-black border-b border-gray-200 text-center">
                          Outstanding Amount
                        </th>
                        <th className="px-6 py-3 text-base font-bold text-black border-b border-gray-200 text-center">
                          Unpaid Bills
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {paginatedUnits.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="px-6 py-12 text-center">
                            <EmptyState
                              icon={TbCoinTaka}
                              title="No Units Found"

                            />
                          </td>
                        </tr>
                      ) : (
                        paginatedUnits.map((unit, index) => {
                          return (
                            <tr
                              key={unit.unit_id}
                              className="border-b h-11 hover:bg-gray-50 cursor-pointer"
                              onClick={() => handleViewLedger(unit.unit_id)}
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-left">
                                <div className="text-sm text-gray-900">{startIndex + index + 1}</div>
                              </td>
                              <td className="px-6 py-4 text-left">
                                <div className="text-sm text-gray-900 break-words">
                                  {unit.tower_name || '—'}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-primary text-white text-sm font-medium">
                                  {unit.unit_name}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-left">
                                <div className="text-sm text-gray-900 break-words">{unit.resident_name || 'N/A'}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <div className="text-sm font-semibold text-orange-600">
                                  {formatCurrency(unit.outstanding_amount)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <div className="text-sm text-gray-900">
                                  {unit.unpaid_bills_count}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-4 p-4">
                {paginatedUnits.length === 0 ? (
                  <div className="py-12">
                    <EmptyState
                      icon={TbCoinTaka}
                      title="No Units Found"
                    />
                  </div>
                ) : (
                  paginatedUnits.map((unit, index) => (
                    <div
                      key={unit.unit_id}
                      onClick={() => handleViewLedger(unit.unit_id)}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-base font-semibold text-gray-900">
                              {unit.tower_name || '—'}
                            </h3>
                            <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-primary text-white text-xs font-medium">
                              {unit.unit_name}
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">{unit.resident_name || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Outstanding Amount</p>
                          <p className="text-sm font-semibold text-orange-600">{formatCurrency(unit.outstanding_amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Unpaid Bills</p>
                          <p className="text-sm font-medium text-gray-900">{unit.unpaid_bills_count}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        {filteredUnits && filteredUnits.length > itemsPerPage && (
          <div className="flex flex-col sm:flex-row items-center justify-between mt-4 pt-4 border-t border-gray-200 pb-2 gap-4">
            <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredUnits.length)} of {filteredUnits.length} units
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
      </ContentBox>
    </PageContainer>
  );
};

export default UnitReceivablesPage;
