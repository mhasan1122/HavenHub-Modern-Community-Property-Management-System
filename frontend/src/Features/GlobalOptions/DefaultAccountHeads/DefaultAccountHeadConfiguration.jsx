import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { IoSave, IoClose, IoAdd } from "react-icons/io5";
import { FaFilter, FaSearch, FaTimes } from "react-icons/fa";
import ArrowHeading from "../../../Components/HeadingComponent/ArrowHeading";
import PageContainer from "../../../Components/Ui/PageContainer";
import MessageBox from "../../../Components/MessageBox/MessageBox";
import axiosInstance from "../../../utils/axiosInstance";

const DefaultAccountHeadConfiguration = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [accounts, setAccounts] = useState([]);
  const [defaultAccountHeads, setDefaultAccountHeads] = useState([]);
  const [filteredAccountHeads, setFilteredAccountHeads] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    transactionType: "",
    customLabel: "",
    defaultAccount: null,
    defaultEntryType: "", // Default to empty (optional)
    description: ""
  });

  // Filter and pagination states
  const [searchTerm, setSearchTerm] = useState("");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load accounts
      const accountsResponse = await axiosInstance.get(
        "/api/accounts/accounts/"
      );
      const accountsData = Array.isArray(accountsResponse.data)
        ? accountsResponse.data
        : accountsResponse.data.results || [];
      const activeAccounts = accountsData.filter((acc) => acc.isActive);
      setAccounts(activeAccounts);

      // Load existing default account heads
      const headsResponse = await axiosInstance.get(
        "/api/accounts/default-account-heads/"
      );
      const headsData = headsResponse.data || [];
      setDefaultAccountHeads(headsData);
      setFilteredAccountHeads(headsData);
    } catch (err) {
      console.error("Error loading data:", err);
      console.error("Error details:", err.response?.data);
      console.error("Error status:", err.response?.status);
      setError(
        err.response?.data?.message ||
          err.response?.data?.detail ||
          "Failed to load data"
      );
    } finally {
      setLoading(false);
    }
  };

  // Apply filters whenever search term, transaction type filter, or account heads change
  const applyFilters = useCallback(() => {
    let filtered = [...defaultAccountHeads];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (head) =>
          head.transactionType
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          head.customLabel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          head.defaultAccountCode
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          head.defaultAccountName
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          head.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply transaction type filter
    if (transactionTypeFilter) {
      filtered = filtered.filter(
        (head) => head.transactionType === transactionTypeFilter
      );
    }

    setFilteredAccountHeads(filtered);
  }, [searchTerm, transactionTypeFilter, defaultAccountHeads]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredAccountHeads]);

  const clearFilters = () => {
    setSearchTerm("");
    setTransactionTypeFilter("");
  };

  const hasActiveFilters = searchTerm || transactionTypeFilter;

  // Get unique transaction types for filter dropdown
  const uniqueTransactionTypes = [
    ...new Set(defaultAccountHeads.map((head) => head.transactionType))
  ];

  const resetForm = () => {
    setFormData({
      transactionType: "",
      customLabel: "",
      defaultAccount: null,
      defaultEntryType: "", // Default to empty (optional)
      description: ""
    });
    setIsCreating(false);
    setEditingId(null);
  };

  const handleCreateNew = () => {
    resetForm();
    setIsCreating(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Validation
      if (!formData.transactionType.trim()) {
        setError("Transaction Type is required");
        return;
      }
      if (!formData.customLabel.trim()) {
        setError("Display Label is required");
        return;
      }
      if (!formData.defaultAccount) {
        setError("Default Account is required");
        return;
      }

      const payload = {
        transactionType: formData.transactionType.trim(),
        customLabel: formData.customLabel.trim(),
        defaultAccount: formData.defaultAccount,
        defaultEntryType: formData.defaultEntryType,
        description: formData.description.trim(),
        isActive: true
      };

      if (editingId) {
        // Update existing
        await axiosInstance.patch(
          `/api/accounts/default-account-heads/${editingId}/`,
          payload
        );
        setSuccess("Default account head updated successfully");
      } else {
        // Create new
        await axiosInstance.post(
          "/api/accounts/default-account-heads/",
          payload
        );
        setSuccess("Default account head created successfully");
      }

      // Reload data and reset form
      await loadData();
      resetForm();
    } catch (err) {
      console.error("Error saving:", err);
      console.error("Error response data:", err.response?.data);

      // Handle duplicate transaction type error specifically
      const transactionTypeError = err.response?.data?.transactionType?.[0];

      if (transactionTypeError && typeof transactionTypeError === "string") {
        if (
          transactionTypeError.includes("already exists") ||
          transactionTypeError.includes("unique")
        ) {
          setError(
            "A default account head already exists for this transaction type. Please choose another type."
          );
          return;
        }
      }

      // Extract error details for more specific messages
      const errorData = err.response?.data;

      // Look for various possible error formats
      if (errorData?.transactionType) {
        const transactionError = Array.isArray(errorData.transactionType)
          ? errorData.transactionType[0]
          : errorData.transactionType;

        if (typeof transactionError === "object" && transactionError.string) {
          // Handle ErrorDetail object format: {'transactionType': [ErrorDetail(string='...', code='...')]}
          const errorMessage = transactionError.string;
          if (errorMessage.includes("already exists") || errorMessage.includes("unique")) {
            setError("A default account head already exists for this transaction type. Please choose another type.");
          } else {
            setError(errorMessage);
          }
        } else {
          if (typeof transactionError === "string" && (transactionError.includes("already exists") || transactionError.includes("unique"))) {
            setError("A default account head already exists for this transaction type. Please choose another type.");
          } else {
            setError(transactionError);
          }
        }
      } else if (errorData?.non_field_errors) {
        setError(
          Array.isArray(errorData.non_field_errors)
            ? errorData.non_field_errors[0]
            : errorData.non_field_errors
        );
      } else {
        setError(
          errorData?.message ||
            errorData?.detail ||
            "Failed to save. Please check your inputs and try again."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleGoBack = () => {
    navigate("/global-options");
  };

  if (loading) {
    return (
      <PageContainer className="h-full bg-surfaceMuted flex flex-col min-h-0">
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading account data...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="h-full bg-surfaceMuted flex flex-col min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 sticky top-0 z-20 mb-1.5 flex items-center justify-between gap-3 bg-surfaceMuted/95 py-4 backdrop-blur">
        <div
          onClick={handleGoBack}
          className="inline-flex cursor-pointer items-center gap-3 text-ink transition-colors hover:text-primary"
        >
          <ArrowHeading
            title="Default Account Heads"
            size="2xl"
            color="text-black"
          />
        </div>
        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primaryHover transition-colors font-medium"
        >
          <IoAdd className="w-5 h-5" />
          Create New
        </button>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <section className="mx-auto w-full rounded-[32px] border border-borderLight bg-white px-8 py-10">
          <div className="space-y-6">
            {/* Introduction Card */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Manage Default Account Heads
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                Create and configure default accounts for different transaction
                types. You can create custom transaction types as needed for
                your business.
              </p>
            </div>

            {/* Create Form */}
            {isCreating && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Create New Default Account Head
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Transaction Type <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.transactionType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          transactionType: e.target.value
                        })
                      }
                      placeholder="e.g., income, expense, custom_type"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Unique identifier (lowercase, no spaces)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Display Label <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.customLabel}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customLabel: e.target.value
                        })
                      }
                      placeholder="e.g., Income, Expense, Custom Type"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Human-readable label for display
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Account <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.defaultAccount || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          defaultAccount: e.target.value
                            ? parseInt(e.target.value)
                            : null
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white text-gray-900"
                    >
                      <option value="">Select an account...</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.accountCode} - {account.accountName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Entry Type (Optional)
                    </label>
                    <select
                      value={formData.defaultEntryType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          defaultEntryType: e.target.value
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white text-gray-900"
                    >
                      <option value="">None</option>
                      <option value="debit">Debit</option>
                      <option value="credit">Credit</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value
                        })
                      }
                      placeholder="Enter a note or description (optional)"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primaryHover transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    <IoSave className="w-4 h-4" />
                    {saving ? "Saving..." : "Create"}
                  </button>
                  <button
                    onClick={resetForm}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    <IoClose className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Filters Section */}
            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
                    showFilters
                      ? "bg-subprimary text-primary border-primary"
                      : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
                  }`}
                >
                  <FaFilter /> Filters
                  {hasActiveFilters && (
                    <span className="bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {(searchTerm ? 1 : 0) + (transactionTypeFilter ? 1 : 0)}
                    </span>
                  )}
                </button>

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                  >
                    <FaTimes /> Clear Filters
                  </button>
                )}
              </div>

              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-md border">
                  {/* Search */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <FaSearch className="text-gray-500" /> Search
                    </label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by transaction type, label, account..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>

                  {/* Transaction Type Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Transaction Type
                    </label>
                    <select
                      value={transactionTypeFilter}
                      onChange={(e) => setTransactionTypeFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                      <option value="">All Types</option>
                      {uniqueTransactionTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* List of Existing Default Account Heads */}
            <div className="bg-white rounded-lg border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Existing Default Account Heads
              </h3>

              {defaultAccountHeads.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No default account heads configured yet. Click &quot;Create
                  New&quot; to add one.
                </p>
              ) : filteredAccountHeads.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <FaSearch className="text-gray-400 text-3xl" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No account heads found
                  </h3>
                  <p className="text-gray-500 mb-4">
                    No account heads match the current filters. Try adjusting
                    your filters.
                  </p>
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primaryHover"
                  >
                    Clear All Filters
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative overflow-x-auto max-h-[50vh] overflow-y-auto custom-scrollbar bg-white">
                    <table className="w-full text-base text-left">
                      <thead className="bg-subprimary border-b border-subprimary sticky top-0 z-10">
                        <tr className="h-11">
                          <th className="px-4 py-2 text-base font-bold text-left">
                            Transaction Type
                          </th>
                          <th className="px-4 py-2 text-base font-bold text-left">
                            Display Label
                          </th>
                          <th className="px-4 py-2 text-base font-bold text-left">
                            Default Account
                          </th>
                          <th className="px-4 py-2 text-base font-bold text-left">
                            Default Entry Type
                          </th>
                          <th className="px-4 py-2 text-base font-bold text-left">
                            Description
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // Pagination calculations
                          const startIndex = (currentPage - 1) * itemsPerPage;
                          const endIndex = startIndex + itemsPerPage;
                          const paginatedHeads = filteredAccountHeads.slice(
                            startIndex,
                            endIndex
                          );

                          return paginatedHeads.map((head) => (
                            <tr
                              key={head.id}
                              className="bg-white border-b hover:bg-gray-50 transition-colors duration-150 h-11"
                            >
                              <td className="px-4 py-2 text-sm whitespace-nowrap">
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  {head.transactionType}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm whitespace-nowrap">
                                <span className="font-medium text-primary">
                                  {head.customLabel}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm">
                                <span className="text-gray-900">
                                  {head.defaultAccountCode} -{" "}
                                  {head.defaultAccountName}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm">
                                {head.defaultEntryType ? (
                                  <span
                                    className={`px-2 py-1 rounded text-xs font-medium ${
                                      head.defaultEntryType === "debit"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-blue-100 text-blue-800"
                                    }`}
                                  >
                                    {head.defaultEntryTypeDisplay ||
                                      head.defaultEntryType?.toUpperCase()}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-xs italic">
                                    Not set
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                <span className="text-gray-600">
                                  {head.description || "—"}
                                </span>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {filteredAccountHeads.length > itemsPerPage && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                      <div className="text-sm text-gray-600">
                        Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                        {Math.min(
                          currentPage * itemsPerPage,
                          filteredAccountHeads.length
                        )}{" "}
                        of {filteredAccountHeads.length} account heads
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setCurrentPage((prev) => Math.max(1, prev - 1));
                          }}
                          disabled={currentPage === 1}
                          className={`px-3 py-1 rounded border ${
                            currentPage === 1
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          Previous
                        </button>
                        <div className="flex items-center gap-1">
                          {Array.from(
                            {
                              length: Math.ceil(
                                filteredAccountHeads.length / itemsPerPage
                              )
                            },
                            (_, i) => i + 1
                          ).map((page) => {
                            const totalPages = Math.ceil(
                              filteredAccountHeads.length / itemsPerPage
                            );
                            if (
                              page === 1 ||
                              page === totalPages ||
                              (page >= currentPage - 1 &&
                                page <= currentPage + 1)
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
                                  className={`px-3 py-1 rounded border ${
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
                                <span key={page} className="px-2">
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
                                Math.ceil(
                                  filteredAccountHeads.length / itemsPerPage
                                ),
                                prev + 1
                              )
                            );
                          }}
                          disabled={
                            currentPage ===
                            Math.ceil(
                              filteredAccountHeads.length / itemsPerPage
                            )
                          }
                          className={`px-3 py-1 rounded border ${
                            currentPage ===
                            Math.ceil(
                              filteredAccountHeads.length / itemsPerPage
                            )
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Active Filters Indicator */}
              {hasActiveFilters && filteredAccountHeads.length > 0 && (
                <div className="mt-4 p-3 bg-subprimary border border-primary rounded-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-medium text-primary">
                        Active Filters:
                      </span>
                      {transactionTypeFilter && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          Type: {transactionTypeFilter}
                        </span>
                      )}
                      {searchTerm && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          Search: &quot;{searchTerm}&quot;
                        </span>
                      )}
                    </div>
                    <button
                      onClick={clearFilters}
                      className="text-sm text-primary hover:text-primaryDark"
                    >
                      Clear all
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-base font-semibold text-blue-900 mb-3">
                About Default Account Heads
              </h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold mt-0.5 flex-shrink-0">
                    •
                  </span>
                  <span>
                    Create custom transaction types to match your business needs
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold mt-0.5 flex-shrink-0">
                    •
                  </span>
                  <span>
                    Each transaction type must have a unique identifier
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold mt-0.5 flex-shrink-0">
                    •
                  </span>
                  <span>
                    All selected accounts must be active in the Chart of
                    Accounts
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold mt-0.5 flex-shrink-0">
                    •
                  </span>
                  <span>
                    Changes take effect immediately and apply system-wide
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      {/* MessageBox - Modal Dialog for Success/Error Messages */}
      <MessageBox
        message={success}
        error={error}
        clearMessage={() => {
          setSuccess(null);
          setError(null);
        }}
      />
    </PageContainer>
  );
};

export default DefaultAccountHeadConfiguration;