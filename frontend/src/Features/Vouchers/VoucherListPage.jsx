import { useState, useEffect } from "react";
import {
  FaEye,
  FaTrash,
  FaPlus,
  FaCheck,
  FaSearch,
  FaEdit
} from "react-icons/fa";
import axiosInstance from "../../utils/axiosInstance";
import MessageBox from "../../Components/MessageBox/MessageBox";
import ConfirmationMessageBox from "../../Components/MessageBox/ConfirmationMessageBox";
import VoucherDetailModal from "./VoucherDetailModal";
import VoucherEditModal from "./VoucherEditModal";
import TableSkeleton from "../../Components/Loaders/TableSkeleton";
import ModernLoadingAnimation from "../../Components/Loaders/ModernLoadingAnimation";
import useSkeletonLoading from "../../hooks/useSkeletonLoading";
import ModernDatePicker from "../../Components/FormComponent/ModernDatePicker";
import FilterButton from "../../Components/FormComponent/ButtonComponent/FilterButton";
import FilterSelect1 from "../../Components/FilterSelect1/FilterSelect1";
import SearchBar from "../../Components/Search/SearchBar";
import { useSearchParams } from "react-router-dom";

const VoucherListPage = () => {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [operationLoading, setOperationLoading] = useState(false);

  // Filter states
  const [searchParams] = useSearchParams();
  const [voucherType, setVoucherType] = useState([]);
  const [dateRange, setDateRange] = useState({ startDate: "", endDate: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState([]);
  const [showFilters, setShowFilters] = useState(true);

  const [voucherTypes, setVoucherTypes] = useState([]);
  const statusOptions = [
    { value: "draft", label: "Draft" },
    { value: "posted", label: "Posted" }
  ];

  // Message box states
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [pendingAction, setPendingAction] = useState(null);

  // Detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedVoucherId, setSelectedVoucherId] = useState(null);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selection state
  const [selectedVoucherIds, setSelectedVoucherIds] = useState([]);

  // Skeleton loading with minimum display time
  const showSkeleton = useSkeletonLoading(loading, vouchers, 1000);

  // Fetch voucher types from API
  useEffect(() => {
    fetchVoucherTypes();
  }, []);

  const fetchVoucherTypes = async () => {
    try {
      const response = await axiosInstance.get("/api/accounts/voucher-types/");
      const data = response.data;

      // Handle both paginated and direct array responses
      const typesData = Array.isArray(data) ? data : data.results || [];

      // Format the data to match the expected structure
      const formattedTypes = typesData.map((type) => ({
        value: type.value || type.id || type.code || type.name,
        label: type.label || type.name || type.display_name || type.displayName
      }));

      // If no voucher types are returned from API, use fallback values
      if (formattedTypes.length === 0) {
        setVoucherTypes([
          { value: "receipt", label: "Receipt Voucher" },
          { value: "payment", label: "Payment Voucher" },
          { value: "journal", label: "Journal Voucher" },
          { value: "contra", label: "Contra Voucher" }
        ]);
      } else {
        setVoucherTypes(formattedTypes);
      }
    } catch (error) {
      console.error("Error fetching voucher types:", error);
      console.error("Voucher types error details:", {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });

      // Fallback to default types if API fails
      setVoucherTypes([
        { value: "payment", label: "Payment Voucher" },
        { value: "receipt", label: "Receipt Voucher" },
        { value: "journal", label: "Journal Voucher" },
        { value: "contra", label: "Contra Voucher" },
        { value: "credit_note", label: "Credit Note" },
        { value: "debit_note", label: "Debit Note" }
      ]);
    }
  };

  // Load filter state from URL on mount
  useEffect(() => {
    const voucherTypeParam = searchParams.get("voucher_type") || "";
    const searchParam = searchParams.get("search") || "";
    const startDateParam = searchParams.get("from_date") || "";
    const endDateParam = searchParams.get("to_date") || "";

    // Parse multiple voucher types from comma-separated string
    setVoucherType(voucherTypeParam ? voucherTypeParam.split(",") : []);
    setSearchTerm(searchParam);
    setDateRange({ startDate: startDateParam, endDate: endDateParam });
  }, []);

  // Apply filters to vouchers
  useEffect(() => {
    fetchVouchers();
  }, [voucherType, dateRange, searchTerm, status]);

  // Reset to page 1 when vouchers change
  useEffect(() => {
    setCurrentPage(1);
  }, [vouchers]);

  const fetchVouchers = async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();

      // Append multiple voucher types as separate parameters
      if (voucherType && voucherType.length > 0) {
        voucherType.forEach((type) => {
          params.append("voucher_type", type);
        });
      }
      if (dateRange.startDate) params.append("from_date", dateRange.startDate);
      if (dateRange.endDate) params.append("to_date", dateRange.endDate);
      if (searchTerm) params.append("search", searchTerm);
      // Append multiple status values as separate parameters
      if (status && status.length > 0) {
        status.forEach((stat) => {
          params.append("status", stat);
        });
      }

      // Make API call to fetch vouchers using axiosInstance
      const response = await axiosInstance.get(
        `/api/accounts/voucher-entries/?${params.toString()}`
      );
      const data = response.data;

      // Handle both paginated and direct array responses
      const vouchersData = Array.isArray(data) ? data : data.results || [];

      setVouchers(vouchersData);
      setError(null);
    } catch (error) {
      console.error("Error fetching vouchers:", error);
      console.error("Error details:", {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });

      let errorMessage = "Failed to load vouchers. Please try again later.";

      if (error.response) {
        // Server responded with error status
        if (error.response.status === 404) {
          errorMessage =
            "Voucher API endpoint not found. Please check if the backend service is running.";
        } else if (error.response.status === 403) {
          errorMessage = "Access denied. Please check your permissions.";
        } else if (error.response.status === 500) {
          errorMessage = "Server error occurred. Please contact administrator.";
        } else {
          errorMessage = `Failed to load vouchers: ${error.response.status} - ${error.response.statusText}`;
        }
      } else if (error.request) {
        // Request was made but no response received
        errorMessage =
          "Network error. Please check your connection and try again.";
      }

      setError(errorMessage);
      setVouchers([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle date range change
  const handleDateRangeChange = (field, value) => {
    setDateRange((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setVoucherType([]);
    setDateRange({ startDate: "", endDate: "" });
    setSearchTerm("");
    setStatus([]);
  };

  // Check if any filter is active
  const hasActiveFilters =
    (voucherType && voucherType.length > 0) ||
    dateRange.startDate ||
    dateRange.endDate ||
    searchTerm ||
    (status && status.length > 0);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  // Get status badge class
  const getStatusClass = (status) => {
    switch (status.toLowerCase()) {
      case "draft":
        return "bg-yellow-100 text-yellow-800";
      case "posted":
        return "bg-green-100 text-green-800";
      case "void":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return "0.00";
    return parseFloat(amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Handle voucher approval confirmation
  const handleApproveVoucher = (voucher) => {
    console.log("handleApproveVoucher called with:", voucher);
    setConfirmationMessage(
      "Are you sure you want to approve this voucher? This will change its status from draft to posted."
    );
    // Capture voucher in closure to avoid state issues
    setPendingAction(() => async () => {
      console.log("Approval action executing for voucher:", voucher);
      await confirmApproveVoucher(voucher);
    });
  };

  // Confirm and execute voucher approval
  const confirmApproveVoucher = async (voucher) => {
    console.log("confirmApproveVoucher called with voucher:", voucher);
    if (!voucher) {
      console.error("No voucher to approve!");
      return;
    }

    try {
      setOperationLoading(true);
      console.log("Sending API request to approve voucher:", voucher.id);
      const response = await axiosInstance.post(
        `/api/accounts/voucher-entries/${voucher.id}/post_entry/`
      );
      console.log("API response:", response.data);

      if (response.data.success) {
        setSuccessMessage("Voucher approved successfully!");
        // Refresh the voucher list
        fetchVouchers();
      } else {
        setErrorMessage(
          response.data.message ||
            "Failed to approve voucher. Please try again."
        );
      }
    } catch (error) {
      console.error("Error approving voucher:", error);
      console.error("Error details:", error.response);
      const errMsg =
        error.response?.data?.message ||
        "Error approving voucher. Please try again later.";
      setErrorMessage(errMsg);
    } finally {
      clearConfirmation();
      setOperationLoading(false);
    }
  };

  // Handle bulk voucher approval confirmation
  const handleBulkApproveVouchers = () => {
    const draftVouchersCount = vouchers.filter(
      (v) => selectedVoucherIds.includes(v.id) && v.status?.toLowerCase() === "draft"
    ).length;

    if (draftVouchersCount === 0) {
      setErrorMessage("No draft vouchers selected for approval.");
      return;
    }

    setConfirmationMessage(
      `Are you sure you want to approve ${draftVouchersCount} selected draft vouchers?`
    );
    setPendingAction(() => async () => {
      await confirmBulkApproveVouchers();
    });
  };

  // Confirm and execute bulk voucher approval
  const confirmBulkApproveVouchers = async () => {
    try {
      setOperationLoading(true);
      const draftVoucherIds = vouchers
        .filter(
          (v) =>
            selectedVoucherIds.includes(v.id) &&
            v.status?.toLowerCase() === "draft"
        )
        .map((v) => v.id);

      const response = await axiosInstance.post(
        "/api/accounts/voucher-entries/bulk_post_entries/",
        { voucher_ids: draftVoucherIds }
      );

      if (response.data.success) {
        setSuccessMessage(response.data.message);
        if (response.data.error_count > 0) {
          setErrorMessage(`Approved with some errors: ${response.data.errors.join(", ")}`);
        }
        setSelectedVoucherIds([]);
        fetchVouchers();
      } else {
        setErrorMessage(response.data.message || "Failed to approve vouchers.");
      }
    } catch (error) {
      console.error("Error bulk approving vouchers:", error);
      const errMsg =
        error.response?.data?.message ||
        "Error approving vouchers. Please try again later.";
      setErrorMessage(errMsg);
    } finally {
      clearConfirmation();
      setOperationLoading(false);
    }
  };

  // Selection helpers
  const toggleVoucherSelection = (voucherId) => {
    setSelectedVoucherIds((prev) =>
      prev.includes(voucherId)
        ? prev.filter((id) => id !== voucherId)
        : [...prev, voucherId]
    );
  };

  const toggleAllSelection = () => {
    const allDraftIds = vouchers
      .filter((v) => v.status?.toLowerCase() === "draft")
      .map((v) => v.id);

    if (selectedVoucherIds.length === allDraftIds.length && allDraftIds.length > 0) {
      setSelectedVoucherIds([]);
    } else {
      setSelectedVoucherIds(allDraftIds);
    }
  };


  // Handle delete confirmation
  const handleDeleteVoucher = (voucher) => {
    setConfirmationMessage("Are you sure you want to delete this voucher?");
    // Capture voucher in closure to avoid state issues
    setPendingAction(() => async () => {
      await confirmDeleteVoucher(voucher);
    });
  };

  // Confirm and execute voucher deletion
  const confirmDeleteVoucher = async (voucher) => {
    if (!voucher) return;

    try {
      setOperationLoading(true);
      await axiosInstance.delete(
        `/api/accounts/voucher-entries/${voucher.id}/`
      );
      setSuccessMessage("Voucher deleted successfully!");
      // Refresh the voucher list after deletion
      fetchVouchers();
    } catch (error) {
      console.error("Error deleting voucher:", error);
      setErrorMessage("Error deleting voucher. Please try again later.");
    } finally {
      clearConfirmation();
      setOperationLoading(false);
    }
  };

  // Clear all message states
  const clearMessages = () => {
    setSuccessMessage("");
    setErrorMessage("");
  };

  // Clear confirmation states
  const clearConfirmation = () => {
    setConfirmationMessage("");
    setPendingAction(null);
  };

  // Handle view voucher details
  const handleViewVoucher = (voucher) => {
    setSelectedVoucherId(voucher.id);
    setShowDetailModal(true);
  };

  // Close detail modal
  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedVoucherId(null);
  };

  // Handle edit voucher
  const handleEditVoucher = (voucher) => {
    setEditingVoucherId(voucher.id);
    setShowEditModal(true);
  };

  // Close edit modal
  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingVoucherId(null);
  };

  // Handle successful edit
  const handleEditSuccess = () => {
    setSuccessMessage("Voucher updated successfully!");
    fetchVouchers();
    handleCloseEditModal();
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* Full Page Loading Overlay for voucher actions */}
      {operationLoading && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-70 z-50">
          <div className="flex flex-col items-center text-white px-4">
            <ModernLoadingAnimation />
            <p className="mt-4 text-base sm:text-lg font-medium text-center">
              Processing voucher action, please wait...
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Voucher List</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">Manage and track your vouchers</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            {selectedVoucherIds.length > 0 && (
              <button
                onClick={handleBulkApproveVouchers}
                disabled={operationLoading}
                className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-success text-white rounded-lg hover:opacity-90 transition-all font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base w-full sm:w-auto"
              >
                <FaCheck /> Bulk Approve ({selectedVoucherIds.length})
              </button>
            )}
            <button
              onClick={(e) => {
                e.preventDefault();
                window.location.href = "/accounting/financial-entry";
              }}
              disabled={operationLoading}
              className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-primary text-white rounded-lg hover:bg-primaryDark transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base w-full sm:w-auto"
            >
              <FaPlus /> New Voucher
            </button>
          </div>
        </div>

        {/* Filters Section */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-end gap-2 sm:gap-4 mb-3 sm:mb-4">
            <FilterButton
              active={showFilters}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filter
            </FilterButton>
          </div>

          {showFilters && (
            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
              <div className="flex flex-col lg:flex-row lg:items-end gap-3 sm:gap-4">
                {/* Voucher Type Filter */}
                <div className="flex-1">
                  <FilterSelect1
                    placeholder="Voucher Type"
                    options={voucherTypes}
                    paramKey="voucher_type"
                    useUrlParams={false}
                    onApply={(selected) => {
                      setVoucherType(selected);
                    }}
                  />
                </div>

                {/* Status Filter */}
                <div className="flex-1">
                  <FilterSelect1
                    placeholder="Status"
                    options={statusOptions}
                    paramKey="status"
                    useUrlParams={false}
                    onApply={(selected) => {
                      setStatus(selected);
                    }}
                  />
                </div>

                {/* Start Date Filter */}
                <div className="flex-1">
                  <ModernDatePicker
                    label="Start Date"
                    value={dateRange.startDate}
                    onChange={(value) =>
                      handleDateRangeChange("startDate", value)
                    }
                    placeholder="Select start date"
                    labelClassName="block text-sm font-medium text-gray-700 mb-2"
                    inputClassName="h-[42px]"
                    showIcon={true}
                  />
                </div>

                {/* End Date Filter */}
                <div className="flex-1">
                  <ModernDatePicker
                    label="End Date"
                    value={dateRange.endDate}
                    onChange={(value) =>
                      handleDateRangeChange("endDate", value)
                    }
                    placeholder="Select end date"
                    minDate={dateRange.startDate}
                    labelClassName="block text-sm font-medium text-gray-700 mb-2"
                    inputClassName="h-[42px]"
                    showIcon={true}
                  />
                </div>

                {/* Search */}
                <div className="flex-1">
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2 invisible">
                      Search
                    </label>
                  </div>
                  <SearchBar
                    placeholder="Search voucher code, reference..."
                    updateUrl={false}
                    onSearch={(text) => setSearchTerm(text)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        )}

        {/* Vouchers Table */}
        {showSkeleton ? (
          <div className="flex justify-center items-center py-8 sm:py-12">
            <TableSkeleton rows={10} columns={6} />
          </div>
        ) : vouchers.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 sm:p-12">
            <div className="text-center">
              <div className="mx-auto w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <FaSearch className="text-gray-400 text-2xl sm:text-3xl" />
              </div>
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                No vouchers found
              </h3>
              <p className="text-sm sm:text-base text-gray-500 mb-4">
                {hasActiveFilters
                  ? "No vouchers match the current filters. Try adjusting your filters."
                  : "No vouchers have been created yet."}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-4 sm:px-6 py-2 sm:py-2.5 bg-primary text-white rounded-lg hover:bg-primaryDark transition-colors font-medium text-sm sm:text-base justify-center"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block sm:hidden space-y-3">
              {(() => {
                const startIndex = (currentPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const paginatedVouchers = vouchers.slice(startIndex, endIndex);

                return paginatedVouchers.map((voucher) => (
                  <div
                    key={voucher.id}
                    className={`bg-white border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                      selectedVoucherIds.includes(voucher.id)
                        ? "border-primary bg-subprimary shadow-sm"
                        : "border-gray-200"
                    }`}
                    onClick={() => handleViewVoucher(voucher)}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      {voucher.status?.toLowerCase() === "draft" && (
                        <div
                          className="pt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                            checked={selectedVoucherIds.includes(voucher.id)}
                            onChange={() => toggleVoucherSelection(voucher.id)}
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-primary mb-1">
                              {voucher.voucherNumber ||
                                voucher.voucherCode ||
                                "N/A"}
                            </div>
                            <div className="text-xs text-gray-500 mb-2">
                              Ref: {voucher.referenceNumber || "N/A"}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(
                                voucher.status
                              )}`}
                            >
                              {voucher.status?.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between items-end mt-1">
                          <div>
                            <div className="text-xs text-gray-600 mb-1">
                              {voucher.voucherTypeName || "N/A"}
                            </div>
                            <div className="text-xs text-gray-600">
                              {formatDate(
                                voucher.entryDate || voucher.dateIssued
                              )}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-gray-900">
                            ৳{" "}
                            {formatCurrency(
                              voucher.totalDebit ||
                                voucher.totalCredit ||
                                voucher.amount ||
                                0
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div
                      className="flex items-center justify-center gap-2 pt-3 border-t border-gray-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {voucher.status?.toLowerCase() === "draft" && (
                        <>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              handleApproveVoucher(voucher);
                            }}
                            disabled={operationLoading}
                            className={`p-2 rounded transition-colors ${
                              operationLoading
                                ? "text-gray-400 cursor-not-allowed"
                                : "text-green-600 hover:text-green-900 hover:bg-green-50"
                            }`}
                            title="Approve Voucher"
                          >
                            <FaCheck size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              handleEditVoucher(voucher);
                            }}
                            disabled={operationLoading}
                            className={`p-2 rounded transition-colors ${
                              operationLoading
                                ? "text-gray-400 cursor-not-allowed"
                                : "text-blue-600 hover:text-blue-900 hover:bg-blue-50"
                            }`}
                            title="Edit Voucher"
                          >
                            <FaEdit size={16} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleViewVoucher(voucher);
                        }}
                        disabled={operationLoading}
                        className={`p-2 rounded transition-colors ${
                          operationLoading
                            ? "text-gray-400 cursor-not-allowed"
                            : "text-primary hover:text-primaryDark hover:bg-subprimary"
                        }`}
                        title="View Details"
                      >
                        <FaEye size={16} />
                      </button>
                      {voucher.status?.toLowerCase() === "draft" && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleDeleteVoucher(voucher);
                          }}
                          disabled={operationLoading}
                          className={`p-2 rounded transition-colors ${
                            operationLoading
                              ? "text-gray-400 cursor-not-allowed"
                              : "text-red-600 hover:text-red-900 hover:bg-red-50"
                          }`}
                          title="Delete"
                        >
                          <FaTrash size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block border border-gray-200 rounded-lg overflow-hidden">
            <div className="relative overflow-x-auto max-h-[calc(100vh-500px)] overflow-y-auto custom-scrollbar">
              <table className="w-full text-base text-left">
                <thead className="bg-[#EBF5F5] border-b border-gray-200 sticky top-0 z-10">
                  <tr className="h-11">
                    <th className="px-4 lg:px-6 py-3 text-sm sm:text-base font-semibold text-black text-left w-10">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                        checked={
                          vouchers.filter(v => v.status?.toLowerCase() === 'draft').length > 0 &&
                          selectedVoucherIds.length === vouchers.filter(v => v.status?.toLowerCase() === 'draft').length
                        }
                        onChange={toggleAllSelection}
                      />
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-sm sm:text-base font-semibold text-black text-left">
                      Voucher Code
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-sm sm:text-base font-semibold text-black text-left">
                      Type
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-sm sm:text-base font-semibold text-black text-left">
                      Date Issued
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-sm sm:text-base font-semibold text-black text-left">
                      Status
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-sm sm:text-base font-semibold text-black text-right">
                      Amount
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-sm sm:text-base font-semibold text-black text-center">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Pagination calculations
                    const startIndex = (currentPage - 1) * itemsPerPage;
                    const endIndex = startIndex + itemsPerPage;
                    const paginatedVouchers = vouchers.slice(
                      startIndex,
                      endIndex
                    );

                    return paginatedVouchers.map((voucher) => (
                      <tr
                        key={voucher.id}
                        className={`border-b hover:bg-gray-50 transition-colors duration-150 h-11 cursor-pointer ${
                          selectedVoucherIds.includes(voucher.id)
                            ? "bg-subprimary"
                            : "bg-white"
                        }`}
                        onClick={() => handleViewVoucher(voucher)}
                      >
                        <td
                          className="px-4 lg:px-6 py-4 text-sm whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {voucher.status?.toLowerCase() === "draft" ? (
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                              checked={selectedVoucherIds.includes(voucher.id)}
                              onChange={() => toggleVoucherSelection(voucher.id)}
                            />
                          ) : (
                            <div className="w-4 h-4"></div>
                          )}
                        </td>
                          <td className="px-4 lg:px-6 py-4 text-sm whitespace-nowrap">
                          <div className="text-sm font-medium text-primary">
                            {voucher.voucherNumber ||
                              voucher.voucherCode ||
                              "N/A"}
                          </div>
                          <div className="text-xs text-gray-500">
                            Ref: {voucher.referenceNumber || "N/A"}
                          </div>
                        </td>
                          <td className="px-4 lg:px-6 py-4 text-sm whitespace-nowrap">
                          {voucher.voucherTypeName || "N/A"}
                        </td>
                          <td className="px-4 lg:px-6 py-4 text-sm whitespace-nowrap">
                          {formatDate(voucher.entryDate || voucher.dateIssued)}
                        </td>
                          <td className="px-4 lg:px-6 py-4 text-sm whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(
                              voucher.status
                            )}`}
                          >
                            {voucher.status?.toUpperCase()}
                          </span>
                        </td>
                          <td className="px-4 lg:px-6 py-4 text-sm whitespace-nowrap text-right font-medium">
                          ৳{" "}
                          {formatCurrency(
                            voucher.totalDebit ||
                              voucher.totalCredit ||
                              voucher.amount ||
                              0
                          )}
                        </td>
                        <td
                            className="px-4 lg:px-6 py-4 text-sm whitespace-nowrap text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-center space-x-2">
                            {/* Approve button - only show for draft vouchers */}
                            {voucher.status?.toLowerCase() === "draft" && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleApproveVoucher(voucher);
                                }}
                                disabled={operationLoading}
                                className={`p-1 rounded transition-colors ${
                                  operationLoading
                                    ? "text-gray-400 cursor-not-allowed"
                                    : "text-green-600 hover:text-green-900 hover:bg-green-50"
                                }`}
                                title={
                                  operationLoading
                                    ? "Operation in progress"
                                    : "Approve Voucher"
                                }
                              >
                                <FaCheck size={16} />
                              </button>
                            )}
                            {/* Edit button - only show for draft vouchers */}
                            {voucher.status?.toLowerCase() === "draft" && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleEditVoucher(voucher);
                                }}
                                disabled={operationLoading}
                                className={`p-1 rounded transition-colors ${
                                  operationLoading
                                    ? "text-gray-400 cursor-not-allowed"
                                    : "text-blue-600 hover:text-blue-900 hover:bg-blue-50"
                                }`}
                                title={
                                  operationLoading
                                    ? "Operation in progress"
                                    : "Edit Voucher"
                                }
                              >
                                <FaEdit size={16} />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleViewVoucher(voucher);
                              }}
                              disabled={operationLoading}
                              className={`p-1 rounded transition-colors ${
                                operationLoading
                                  ? "text-gray-400 cursor-not-allowed"
                                  : "text-primary hover:text-primaryDark hover:bg-subprimary"
                              }`}
                              title={
                                operationLoading
                                  ? "Operation in progress"
                                  : "View Details"
                              }
                            >
                              <FaEye size={16} />
                            </button>
                            {/* Delete button - only show for draft vouchers */}
                            {voucher.status?.toLowerCase() === "draft" && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleDeleteVoucher(voucher);
                                }}
                                disabled={operationLoading}
                                className={`p-1 rounded transition-colors ${
                                  operationLoading
                                    ? "text-gray-400 cursor-not-allowed"
                                    : "text-red-600 hover:text-red-900 hover:bg-red-50"
                                }`}
                                title={
                                  operationLoading
                                    ? "Operation in progress"
                                    : "Delete"
                                }
                              >
                                <FaTrash size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
          </>
        )}

        {/* Pagination */}
        {vouchers.length > itemsPerPage && !showSkeleton && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-200">
            <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, vouchers.length)} of{" "}
              {vouchers.length} vouchers
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentPage((prev) => Math.max(1, prev - 1));
                }}
                disabled={currentPage === 1}
                className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded border ${
                  currentPage === 1
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from(
                  { length: Math.ceil(vouchers.length / itemsPerPage) },
                  (_, i) => i + 1
                ).map((page) => {
                  const totalPages = Math.ceil(vouchers.length / itemsPerPage);
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
                        className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded border ${
                          currentPage === page
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
                    return (
                      <span key={page} className="px-1 sm:px-2 text-xs sm:text-sm">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentPage((prev) =>
                    Math.min(
                      Math.ceil(vouchers.length / itemsPerPage),
                      prev + 1
                    )
                  );
                }}
                disabled={
                  currentPage === Math.ceil(vouchers.length / itemsPerPage)
                }
                className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded border ${
                  currentPage === Math.ceil(vouchers.length / itemsPerPage)
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

      {/* Success/Error Message Box */}
      {(successMessage || errorMessage) && (
        <MessageBox
          message={successMessage}
          error={errorMessage}
          clearMessage={clearMessages}
          onOk={clearMessages}
        />
      )}

      {/* Confirmation Message Box */}
      {confirmationMessage && (
        <ConfirmationMessageBox
          message={confirmationMessage}
          onConfirm={async () => {
            console.log("Confirm button clicked");
            console.log("pendingAction:", pendingAction);
            if (pendingAction) {
              console.log("Calling pending action");
              await pendingAction();
            } else {
              console.error("No pending action!");
            }
          }}
          onCancel={clearConfirmation}
          confirmText="Yes"
          cancelText="No"
          isLoading={operationLoading}
        />
      )}

      {/* Voucher Detail Modal */}
      <VoucherDetailModal
        isOpen={showDetailModal}
        onClose={handleCloseDetailModal}
        voucherId={selectedVoucherId}
      />

      {/* Voucher Edit Modal */}
      <VoucherEditModal
        isOpen={showEditModal}
        onClose={handleCloseEditModal}
        voucherId={editingVoucherId}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
};

export default VoucherListPage;
