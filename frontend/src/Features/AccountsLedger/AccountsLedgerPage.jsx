import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaSearch, FaDownload, FaPrint } from "react-icons/fa";
import PageContainer from "../../Components/Ui/PageContainer";
import MessageBox from "../../Components/MessageBox/MessageBox";
import AccountHeadSelect from "../../Components/AccountHeadSelect";
import ModernDatePicker from "../../Components/FormComponent/ModernDatePicker";
import FilterButton from "../../Components/FormComponent/ButtonComponent/FilterButton";
import LedgerTable from "./components/LedgerTable";
import axiosInstance from "../../utils/axiosInstance";
import ModernLoadingAnimation from "../../Components/Loaders/ModernLoadingAnimation";
import TableSkeleton from "../../Components/Loaders/TableSkeleton";
import "./print-styles.css";

const AccountsLedgerPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Account data
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);

  // Filter states
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedParentAccount, setSelectedParentAccount] = useState(null);
  const [viewMode, setViewMode] = useState("individual"); // 'individual' or 'consolidated'
  const [showFilters, setShowFilters] = useState(true);

  // Date range states
  const [fromDate, setFromDate] = useState(getDefaultFromDate());
  const [toDate, setToDate] = useState(getDefaultToDate());

  // Helper functions for default dates
  function getDefaultFromDate() {
    const date = new Date();
    date.setDate(1); // First day of current month
    return date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  }

  function getDefaultToDate() {
    const date = new Date();
    return date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  }

  // Ledger data
  const [ledgerData, setLedgerData] = useState([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const itemsPerPage = 20;

  // Load accounts on mount
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setAccountsLoading(true);
      const response = await axiosInstance.get("/api/accounts/accounts/");
      const accountsData = Array.isArray(response.data)
        ? response.data
        : response.data.results || [];
      const activeAccounts = accountsData.filter((acc) => acc.isActive);
      setAccounts(activeAccounts);
    } catch (err) {
      console.error("Error loading accounts:", err);
      setError("Failed to load accounts");
    } finally {
      setAccountsLoading(false);
    }
  };

  // Get parent accounts (accounts marked as group)
  const parentAccounts = accounts.filter((acc) => acc.isGroup);
  const individualAccounts = accounts.filter((acc) => !acc.isGroup);

  // Fetch ledger data
  const fetchLedgerData = useCallback(async (page = 1) => {
    // Validation
    if (viewMode === "individual" && !selectedAccount) {
      setError("Please select an account");
      return;
    }
    if (viewMode === "consolidated" && !selectedParentAccount) {
      setError("Please select a parent account");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append("page", page);
      params.append("page_size", itemsPerPage);
      params.append("from_date", fromDate);
      params.append("to_date", toDate);

      let endpoint = "";
      if (viewMode === "individual") {
        endpoint = `/api/accounts/ledger/${selectedAccount.id}/?${params.toString()}`;
      } else {
        endpoint = `/api/accounts/ledger/consolidated/${selectedParentAccount.id}/?${params.toString()}`;
      }

      const response = await axiosInstance.get(endpoint);
      const data = response.data;

      setLedgerData(data.results || data.transactions || []);
      setOpeningBalance(data.opening_balance || 0);
      setClosingBalance(data.closing_balance || 0);
      setTotalDebit(data.total_debit || 0);
      setTotalCredit(data.total_credit || 0);
      setTotalRecords(data.count || 0);
      setTotalPages(Math.ceil((data.count || 0) / itemsPerPage));
      setCurrentPage(page);
    } catch (err) {
      console.error("Error fetching ledger:", err);
      setError(
        err.response?.data?.message ||
        err.response?.data?.detail ||
        "Failed to fetch ledger data"
      );
      setLedgerData([]);
    } finally {
      setLoading(false);
    }
  }, [viewMode, selectedAccount, selectedParentAccount, fromDate, toDate, itemsPerPage]);

  // Handle view ledger button
  const handleViewLedger = () => {
    setCurrentPage(1);
    fetchLedgerData(1);
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    fetchLedgerData(newPage);
  };

  // Handle view mode change
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setLedgerData([]);
    setOpeningBalance(0);
    setClosingBalance(0);
    setTotalDebit(0);
    setTotalCredit(0);
    if (mode === "individual") {
      setSelectedParentAccount(null);
    } else {
      setSelectedAccount(null);
    }
  };

  // Export handlers
  const handleExportPDF = () => {
    // TODO: Implement PDF export
    setSuccess("PDF export functionality coming soon");
  };

  const handlePrint = () => {
    window.print();
  };

  const hasActiveFilters = selectedAccount || selectedParentAccount;

  return (
    <PageContainer className="h-full bg-surfaceMuted flex flex-col min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 sticky top-0 z-20 mb-1.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surfaceMuted/95 py-3 sm:py-4 backdrop-blur print:hidden">
        <div
          onClick={() => navigate(-1)}
          className="inline-flex cursor-pointer items-center gap-2 sm:gap-3 text-ink transition-colors hover:text-primary"
        >
        </div>
        {ledgerData.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium shadow-sm text-sm sm:text-base"
            >
              <FaPrint className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-primary text-white rounded-lg hover:bg-primaryHover transition-colors font-medium shadow-sm text-sm sm:text-base"
            >
              <FaDownload className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        )}
      </div>

      {/* Print Header - Only visible when printing */}
      <div className="hidden print:block print:mb-4">
        <div className="text-center border-b-2 border-gray-800 pb-3 mb-4">
          <h1 className="text-xl font-bold text-gray-900">Accounts Ledger Report</h1>
          <p className="text-xs text-gray-600 mt-1">Generated on {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar print:overflow-visible">
        <section className="mx-auto w-full rounded-[32px] border border-borderLight bg-white px-4 sm:px-8 py-6 sm:py-10 print:rounded-none print:border-0 print:px-4 print:py-2">
          <div className="space-y-4 sm:space-y-6 print:space-y-3">
            {/* Introduction Card */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 sm:p-4 lg:p-6 print:hidden">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                Account Ledger Report
              </h2>
              <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                View detailed transaction ledger for individual accounts or
                consolidated view for parent accounts with all their
                sub-accounts combined. Select date range to filter transactions.
              </p>
            </div>

            {/* View Mode Selector */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 print:hidden">
              <button
                onClick={() => handleViewModeChange("individual")}
                className={`flex-1 px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-medium transition-colors shadow-sm text-sm sm:text-base justify-center ${viewMode === "individual"
                  ? "bg-primary text-white hover:bg-primaryDark"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
              >
                Individual Account Ledger
              </button>
              <button
                onClick={() => handleViewModeChange("consolidated")}
                className={`flex-1 px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-medium transition-colors shadow-sm text-sm sm:text-base justify-center ${viewMode === "consolidated"
                  ? "bg-primary text-white hover:bg-primaryDark"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
              >
                Consolidated Ledger (Parent Account)
              </button>
            </div>

            {/* Filters Section */}
            <div className="mb-4 sm:mb-6 print:hidden">
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
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 w-full items-end">
                    <div className="lg:col-span-6">
                      {viewMode === "individual" && (
                        <AccountHeadSelect
                          label="Select Account"
                          required
                          accountHeads={individualAccounts}
                          value={selectedAccount?.id || null}
                          onChange={(account) => setSelectedAccount(account)}
                          placeholder="Choose an account..."
                          loading={accountsLoading}
                          showCode={true}
                        />
                      )}

                      {/* Parent Account Selection - Consolidated Mode */}
                      {viewMode === "consolidated" && (
                        <AccountHeadSelect
                          label="Select Parent Account"
                          required
                          accountHeads={parentAccounts}
                          value={selectedParentAccount?.id || null}
                          onChange={(account) => setSelectedParentAccount(account)}
                          placeholder="Choose a parent account..."
                          loading={accountsLoading}
                          showCode={true}
                        />
                      )}
                    </div>
                    <div className="lg:col-span-2">
                      {/* From Date */}
                      <ModernDatePicker
                        label="From Date"
                        value={fromDate}
                        onChange={(value) => setFromDate(value)}
                        required
                      />
                    </div>
                    <div className="lg:col-span-2">
                      {/* To Date */}
                      <ModernDatePicker
                        label="To Date"
                        value={toDate}
                        onChange={(value) => setToDate(value)}
                        required
                      />
                    </div>
                    <div className="lg:col-span-2 pb-0.5">
                      {/* View Button */}
                      <button
                        onClick={handleViewLedger}
                        disabled={loading || accountsLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 sm:px-6 py-2 bg-primary text-white rounded-lg hover:bg-primaryHover transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm sm:text-base"
                      >
                        <FaSearch className="w-4 h-4" />
                        {loading ? "Loading..." : "View Ledger"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Active Account Display */}
            {(selectedAccount || selectedParentAccount) && ledgerData.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 print:bg-white print:border-gray-300 print:p-2 print:mb-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex-1">
                    <h3 className="text-sm sm:text-base font-semibold text-blue-900 print:text-sm print:text-gray-900">
                      {viewMode === "individual"
                        ? "Account Ledger"
                        : "Consolidated Ledger"}
                    </h3>
                    <p className="text-xs sm:text-sm text-blue-800 mt-1 print:text-xs print:text-gray-700">
                      {viewMode === "individual"
                        ? `${selectedAccount?.accountCode} - ${selectedAccount?.accountName}`
                        : `${selectedParentAccount?.accountCode} - ${selectedParentAccount?.accountName} (with all sub-accounts)`}
                    </p>
                    <p className="text-xs text-blue-700 mt-1 print:text-[10px] print:text-gray-600">
                      Period: {new Date(fromDate).toLocaleDateString('en-GB')} to {new Date(toDate).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <div className="text-left sm:text-right print:hidden w-full sm:w-auto">
                    <div className="text-xs text-blue-700">Opening Balance</div>
                    <div className={`text-lg sm:text-xl font-bold ${openingBalance < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                      {openingBalance < 0 && "- "}৳ {Math.abs(openingBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      {openingBalance < 0 ? ' Dr' : ' Cr'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Ledger Table */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <ModernLoadingAnimation className="min-h-[160px]" />
                <p className="mt-4 text-gray-600">Loading ledger data...</p>
                <div className="mt-6 w-full max-w-5xl">
                  <TableSkeleton
                    rows={8}
                    columns={viewMode === "consolidated" ? 7 : 6}
                  />
                </div>
              </div>
            ) : hasActiveFilters ? (
              <LedgerTable
                data={ledgerData}
                openingBalance={openingBalance}
                closingBalance={closingBalance}
                totalDebit={totalDebit}
                totalCredit={totalCredit}
                currentPage={currentPage}
                totalPages={totalPages}
                totalRecords={totalRecords}
                onPageChange={handlePageChange}
                viewMode={viewMode}
                accountType={viewMode === "consolidated" ? selectedParentAccount?.accountType : selectedAccount?.accountType}
              />
            ) : (
              <div className="text-center py-8 sm:py-12">
                <div className="mx-auto w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                  <FaSearch className="text-gray-400 text-2xl sm:text-3xl" />
                </div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                  Select Account to View Ledger
                </h3>
                <p className="text-sm sm:text-base text-gray-500">
                  Choose an account and date range, then click &quot;View Ledger&quot; to see transactions.
                </p>
              </div>
            )}
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

export default AccountsLedgerPage;
