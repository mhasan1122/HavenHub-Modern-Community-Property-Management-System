import { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FaPlus, FaEdit, FaTrash, FaList, FaTree } from "react-icons/fa";
import ModernLoadingAnimation from "../../Components/Loaders/ModernLoadingAnimation";
import TableSkeleton from "../../Components/Loaders/TableSkeleton";
import MessageBox from "../../Components/MessageBox/MessageBox";
import ConfirmationMessageBox from "../../Components/MessageBox/ConfirmationMessageBox";
import Button from "../../Components/FormComponent/ButtonComponent/Button";
import useModernLoading from "../../hooks/useModernLoading";
import { MODERN_LOADING_MIN_DISPLAY_TIME } from "../../config/modernLoadingConfig";

import AccountsModal from "./components/AccountsModal";
import AccountsTree from "./components/AccountsTree";

import {
  fetchAccounts,
  deleteAccount,
  setViewMode,
  setCurrentPage,
  setShowAddModal,
  setShowEditModal,
  setSelectedAccount,
  setShowDeleteConfirmation,
  setAccountToDelete,
  clearError,
  clearSuccessMessage
} from "../../redux/slices/chartOfAccounts/chartOfAccountsSlice";

import { formatCurrency } from "../ServiceFeeManagement/Reports/utils/paymentUtils";

const ChartOfAccountsPage = () => {
  const dispatch = useDispatch();

  // Get state from Redux store
  const {
    accounts,
    loading,
    error,
    successMessage,
    viewMode,
    currentPage,
    showAddModal,
    showEditModal,
    selectedAccount,
    showDeleteConfirmation,
    accountToDelete,
    operationLoading
  } = useSelector((state) => state.chartOfAccounts);

  const itemsPerPage = 10;
  const [searchQuery, setSearchQuery] = useState("");

  // Use ModernLoading hook with minimum display time
  const showModernLoading = useModernLoading(
    loading || operationLoading,
    accounts,
    MODERN_LOADING_MIN_DISPLAY_TIME
  );

  // Fetch accounts from Redux store
  useEffect(() => {
    dispatch(fetchAccounts());
  }, [dispatch]);

  // Reset to page 1 when search changes
  useEffect(() => {
    dispatch(setCurrentPage(1));
  }, [searchQuery, dispatch]);

  // Handle delete account
  const handleDelete = (account) => {
    dispatch(setAccountToDelete(account));
    dispatch(setShowDeleteConfirmation(true));
  };

  // Confirm delete account
  const confirmDelete = async () => {
    if (!accountToDelete) return;

    dispatch(deleteAccount(accountToDelete.id));
  };

  // Cancel delete
  const cancelDelete = () => {
    dispatch(setShowDeleteConfirmation(false));
    dispatch(setAccountToDelete(null));
  };

  // Handle edit
  const handleEdit = (account) => {
    dispatch(setSelectedAccount(account));
    dispatch(setShowEditModal(true));
  };

  // Handle add
  const handleAdd = () => {
    dispatch(setSelectedAccount(null));
    dispatch(setShowAddModal(true));
  };

  // Handle modal save - Update state directly for real-time updates
  const handleModalSave = () => {
    dispatch(setShowAddModal(false));
    dispatch(setShowEditModal(false));
    dispatch(setSelectedAccount(null));
  };

  // Handle success from modal
  const handleSuccess = () => {
    // Success messages are handled in the Redux store
  };

  // Handle error from modal
  const handleError = () => {
    // Error messages are handled in the Redux store
  };

  // Get type badge color
  const getTypeBadgeColor = (type) => {
    const colors = {
      asset: "bg-blue-100 text-blue-800",
      liability: "bg-red-100 text-red-800",
      equity: "bg-purple-100 text-purple-800",
      revenue: "bg-green-100 text-green-800",
      expense: "bg-orange-100 text-orange-800"
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  // Filter accounts based on search query
  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) {
      return accounts || [];
    }
    const query = searchQuery.toLowerCase();
    return (accounts || []).filter(
      (account) =>
        account.accountName?.toLowerCase().includes(query) ||
        account.accountCode?.toLowerCase().includes(query) ||
        account.description?.toLowerCase().includes(query) ||
        account.accountTypeDisplay?.toLowerCase().includes(query) ||
        account.parentAccountName?.toLowerCase().includes(query)
    );
  }, [accounts, searchQuery]);

  // Pagination calculations
  const totalPages = Math.ceil((filteredAccounts?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAccounts = filteredAccounts?.slice(startIndex, endIndex) || [];

  // Render tree view if selected
  if (viewMode === "tree") {
    return (
      <div className="bg-gray-50 min-h-screen flex flex-col">
        {/* Combined Loading Overlay - Show single loader for both loading states with minimum display time */}
        {showModernLoading && (
          <div
            className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-70 z-50"
            role="alert"
            aria-live="assertive"
            aria-label={loading ? "Loading data, please wait" : "Processing your request, please wait"}
          >
            <div className="flex flex-col items-center text-white">
              <ModernLoadingAnimation />
              <p className="mt-4 text-base sm:text-lg font-medium">
                {loading ? "Loading data, please wait..." : "Processing your request, please wait..."}
              </p>
            </div>
          </div>
        )}
        {/* Fixed Header */}
        <div className="sticky top-0 z-20 bg-gray-50 pt-4 sm:pt-6 pb-4 border-b border-gray-200 shadow-md backdrop-blur">
          <div className="px-4 sm:px-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  Chart of Accounts
                </h1>
                <p className="text-gray-600 mt-1 text-sm sm:text-base">
                  Manage your financial account structure
                </p>
              </div>

              {/* Action Buttons - Right Aligned */}
              <div className="flex flex-row items-center gap-2 sm:gap-3">
                <button
                  onClick={() => dispatch(setViewMode("table"))}
                  className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 border-2 border-primary text-primary bg-white rounded-lg hover:bg-primary hover:text-white transition-colors font-medium text-sm sm:text-base whitespace-nowrap"
                  disabled={loading || operationLoading}
                >
                  <FaList className="text-base sm:text-lg" />
                  <span>Table View</span>
                </button>
                <button
                  onClick={() => dispatch(setViewMode("tree"))}
                  className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 border-2 border-primary bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium text-sm sm:text-base whitespace-nowrap"
                  disabled={loading || operationLoading}
                >
                  <FaTree className="text-base sm:text-lg" />
                  <span>Tree View</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto">
          <AccountsTree fullPageLoading={false} />
        </div>
      </div>
    );
  }

  return (
      <div className="bg-gray-50 min-h-screen flex flex-col">
        {/* Combined Loading Overlay - Show single loader for both loading states with minimum display time */}
        {showModernLoading && (
          <div
            className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-70 z-50"
            role="alert"
            aria-live="assertive"
            aria-label={loading ? "Loading data, please wait" : "Processing your request, please wait"}
          >
            <div className="flex flex-col items-center text-white">
              <ModernLoadingAnimation />
              <p className="mt-4 text-base sm:text-lg font-medium">
                {loading ? "Loading data, please wait..." : "Processing your request, please wait..."}
              </p>
            </div>
          </div>
        )}
      {/* Success/Error Messages */}
      {successMessage && (
        <MessageBox
          message={successMessage}
          clearMessage={() => dispatch(clearSuccessMessage())}
          onOk={() => dispatch(clearSuccessMessage())}
        />
      )}
      {error && (
        <MessageBox
          type="error"
          error
          message={error}
          clearMessage={() => dispatch(clearError())}
          onOk={() => dispatch(clearError())}
        />
      )}

      {/* Fixed Header */}
      <div className="sticky top-0 z-20 bg-gray-50 pt-4 sm:pt-6 pb-4 border-b border-gray-200 shadow-md backdrop-blur">
        <div className="px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Chart of Accounts
              </h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">
                Manage your financial account structure
              </p>
            </div>

            {/* Action Buttons - Right Aligned */}
            <div className="flex flex-row items-center gap-2 sm:gap-3">
              <button
                disabled
                className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 border-2 border-primary bg-primary text-white rounded-lg cursor-not-allowed font-medium text-sm sm:text-base whitespace-nowrap"
              >
                <FaList className="text-base sm:text-lg" />
                <span>Table View</span>
              </button>
              <button
                onClick={() => dispatch(setViewMode("tree"))}
                className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 border-2 border-primary text-primary bg-white rounded-lg hover:bg-primary hover:text-white transition-colors font-medium text-sm sm:text-base whitespace-nowrap"
                disabled={loading || operationLoading}
              >
                <FaTree className="text-base sm:text-lg" />
                <span>Tree View</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-lg sm:text-2xl font-bold text-green-600">
            Chart of Account as on :{" "}
            <span className="block sm:inline">
              {new Date().toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
              })}
            </span>
          </h1>
        </div>

        {/* Filters and Actions */}
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
            <div className="relative flex-1 w-full lg:max-w-md">
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <svg
                className="absolute left-2.5 sm:left-3 top-2.5 h-4 w-4 sm:h-5 sm:w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            {/* Add Account Button - Visible on web, hidden on mobile (will use fixed button) */}
            <div className="hidden lg:block">
              <Button
                icon={FaPlus}
                onClick={handleAdd}
                className="whitespace-nowrap"
                disabled={loading || operationLoading}
              >
                Add Account
              </Button>
            </div>
          </div>
        </div>

        {/* Accounts Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
        {/* Mobile Card View */}
        <div className="block sm:hidden">
          {operationLoading ? (
            <div className="p-4">
              <TableSkeleton rows={5} columns={1} />
            </div>
          ) : paginatedAccounts.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-500">
              <div className="flex flex-col items-center">
                <p className="text-base font-medium mb-2">
                  {searchQuery.trim() ? "No accounts found matching your search" : "No accounts found"}
                </p>
                <p className="text-sm">
                  {searchQuery.trim() ? "Try adjusting your search terms" : "Create your first account to get started"}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {paginatedAccounts.map((account) => (
                <div key={account.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500 font-mono">
                          {account.accountCode}
                        </span>
                        <span
                          className={`px-2 py-0.5 inline-flex text-xs leading-4 font-semibold rounded-full ${getTypeBadgeColor(
                            account.accountType
                          )}`}
                        >
                          {account.accountTypeDisplay}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">
                        {account.accountName}
                      </h3>
                      {account.description && (
                        <p className="text-xs text-gray-500 mb-2">
                          {account.description.substring(0, 60)}
                          {account.description.length > 60 && "..."}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => handleEdit(account)}
                        disabled={operationLoading}
                        className={`p-1.5 rounded-lg transition-colors ${
                          operationLoading
                            ? "text-gray-400 cursor-not-allowed"
                            : "text-blue-600 hover:bg-blue-50"
                        }`}
                        title={operationLoading ? "Operation in progress" : "Edit account"}
                      >
                        <FaEdit size={14} />
                      </button>
                      {!account.isSystemAccount && (
                        <button
                          onClick={() => handleDelete(account)}
                          disabled={
                            account.hasSubAccounts ||
                            account.hasVoucherEntries ||
                            operationLoading
                          }
                          className={`p-1.5 rounded-lg transition-colors ${
                            account.hasSubAccounts ||
                            account.hasVoucherEntries ||
                            operationLoading
                              ? "text-gray-400 cursor-not-allowed"
                              : "text-red-600 hover:bg-red-50"
                          }`}
                          title={
                            account.hasSubAccounts
                              ? "Cannot delete account with sub-accounts"
                              : account.hasVoucherEntries
                              ? "Cannot delete account with voucher entries"
                              : operationLoading
                              ? "Operation in progress"
                              : "Delete account"
                          }
                        >
                          <FaTrash size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Parent:</span>
                      <span className="ml-1 text-gray-900">
                        {account.parentAccountName || "-"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-500">OD:</span>
                      <span className="ml-1 font-medium text-gray-900">
                        {account.openingDebit && parseFloat(account.openingDebit) > 0
                          ? formatCurrency(account.openingDebit)
                          : "-"}
                      </span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-gray-500">OC:</span>
                      <span className="ml-1 font-medium text-gray-900">
                        {account.openingCredit && parseFloat(account.openingCredit) > 0
                          ? formatCurrency(account.openingCredit)
                          : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-[#EBF5F5]">
              <tr>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                  Account Code
                </th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                  Account Name
                </th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                  Parent Account
                </th>
                <th className="px-4 lg:px-6 py-3 text-right text-xs font-semibold text-black uppercase tracking-wider">
                  Opening Debit
                </th>
                <th className="px-4 lg:px-6 py-3 text-right text-xs font-semibold text-black uppercase tracking-wider">
                  Opening Credit
                </th>
                <th className="px-4 lg:px-6 py-3 text-center text-xs font-semibold text-black uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {operationLoading ? (
                <tr>
                  <td colSpan="7" className="px-4 lg:px-6 py-8">
                    <TableSkeleton rows={5} columns={7} />
                  </td>
                </tr>
              ) : paginatedAccounts.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-4 lg:px-6 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center">
                      <p className="text-lg font-medium mb-2">
                        {searchQuery.trim() ? "No accounts found matching your search" : "No accounts found"}
                      </p>
                      <p className="text-sm">
                        {searchQuery.trim() ? "Try adjusting your search terms" : "Create your first account to get started"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {account.accountCode}
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {account.accountName}
                      </div>
                      {account.description && (
                        <div className="text-xs text-gray-500 mt-1">
                          {account.description.substring(0, 50)}
                          {account.description.length > 50 && "..."}
                        </div>
                      )}
                    </td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeBadgeColor(
                          account.accountType
                        )}`}
                      >
                        {account.accountTypeDisplay}
                      </span>
                    </td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {account.parentAccountName || "-"}
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {account.openingDebit && parseFloat(account.openingDebit) > 0
                          ? formatCurrency(account.openingDebit)
                          : "-"}
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {account.openingCredit && parseFloat(account.openingCredit) > 0
                          ? formatCurrency(account.openingCredit)
                          : "-"}
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(account)}
                          disabled={operationLoading}
                          className={`p-2 rounded-lg transition-colors ${
                            operationLoading
                              ? "text-gray-400 cursor-not-allowed"
                              : "text-blue-600 hover:bg-blue-50"
                          }`}
                          title={operationLoading ? "Operation in progress" : "Edit account"}
                        >
                          <FaEdit />
                        </button>
                        {!account.isSystemAccount && (
                          <button
                            onClick={() => handleDelete(account)}
                            disabled={
                              account.hasSubAccounts ||
                              account.hasVoucherEntries ||
                              operationLoading
                            }
                            className={`p-2 rounded-lg transition-colors ${
                              account.hasSubAccounts ||
                              account.hasVoucherEntries ||
                              operationLoading
                                ? "text-gray-400 cursor-not-allowed"
                                : "text-red-600 hover:bg-red-50"
                            }`}
                            title={
                              account.hasSubAccounts
                                ? "Cannot delete account with sub-accounts"
                                : account.hasVoucherEntries
                                ? "Cannot delete account with voucher entries"
                                : operationLoading
                                ? "Operation in progress"
                                : "Delete account"
                            }
                          >
                            <FaTrash />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredAccounts && filteredAccounts.length > itemsPerPage && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-gray-200">
            <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredAccounts.length)}{" "}
              of {filteredAccounts.length} accounts
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  dispatch(setCurrentPage(Math.max(1, currentPage - 1)));
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
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => {
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
                            dispatch(setCurrentPage(page));
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
                  }
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  dispatch(
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  );
                }}
                disabled={currentPage === totalPages}
                className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded border ${
                  currentPage === totalPages
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

        {/* Add Account Modal */}
      <AccountsModal
        isOpen={showAddModal}
        title="Add New Account"
        account={null}
        onClose={() => dispatch(setShowAddModal(false))}
        onSave={handleModalSave}
        onSuccess={handleSuccess}
        onError={handleError}
        isEdit={false}
        operationLoading={operationLoading}
        setOperationLoading={() => {}} // Redux handles loading state
      />

      {/* Edit Account Modal */}
      <AccountsModal
        isOpen={showEditModal}
        title="Edit Account"
        account={selectedAccount}
        onClose={() => dispatch(setShowEditModal(false))}
        onSave={handleModalSave}
        onSuccess={handleSuccess}
        onError={handleError}
        isEdit={true}
        operationLoading={operationLoading}
        setOperationLoading={() => {}} // Redux handles loading state
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <ConfirmationMessageBox
          message={`Are you sure you want to delete the account "${accountToDelete?.accountName}"? This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          confirmText="Delete"
          cancelText="Cancel"
          disabled={operationLoading}
        />
        )}

        {/* Add Account Button - Fixed on mobile, hidden on web (shown in filters section) */}
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 lg:hidden z-10">
          <Button
            icon={FaPlus}
            onClick={handleAdd}
            className="shadow-lg hover:shadow-xl rounded-full text-sm sm:text-base"
            disabled={loading || operationLoading}
          >
            <span className="hidden sm:inline">Add Account</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChartOfAccountsPage;
