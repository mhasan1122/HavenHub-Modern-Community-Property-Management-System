import PropTypes from "prop-types";

const LedgerTable = ({
  data,
  openingBalance,
  closingBalance,
  totalDebit,
  totalCredit,
  currentPage,
  totalPages,
  totalRecords,
  onPageChange,
  viewMode,
  accountType,
}) => {
  const isDebitAccount = ["asset", "expense"].includes(accountType?.toLowerCase());

  const getBalanceInfo = (amount) => {
    const numericAmount = parseFloat(amount) || 0;
    const isNegative = numericAmount < 0;
    
    // For Debit Accounts (Asset/Expense): Positive is Dr (+), Negative is Cr (-)
    // For Credit Accounts (Liability/Equity/Revenue): Positive is Cr (+), Negative is Dr (-)
    let suffix = "";
    if (isDebitAccount) {
      suffix = numericAmount >= 0 ? "Dr" : "Cr";
    } else {
      suffix = numericAmount >= 0 ? "Cr" : "Dr";
    }

    return {
      formatted: `${isNegative ? "- " : ""}৳ ${formatCurrency(Math.abs(numericAmount))}`,
      suffix,
      isNegative,
      colorClass: isNegative ? "text-red-700" : "text-gray-900"
    };
  };
  const formatCurrency = (amount) => {
    const numericAmount = parseFloat(amount) || 0;
    return numericAmount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 p-3 sm:p-6 border-b border-gray-200 print:gap-2 print:p-2">
        <div className="bg-blue-50 rounded-lg p-2 sm:p-4 print:bg-white print:border print:border-blue-200 print:p-1">
          <div className="text-[10px] sm:text-xs text-blue-600 font-medium mb-1 print:text-[8px]">Opening Balance</div>
          {(() => {
            const { formatted, suffix, colorClass } = getBalanceInfo(openingBalance);
            return (
              <div className={`text-sm sm:text-lg font-bold ${colorClass} print:text-[10px]`}>
                {formatted}
                <span className="text-[10px] sm:text-xs ml-1 print:text-[8px]">{suffix}</span>
              </div>
            );
          })()}
        </div>
        <div className="bg-green-50 rounded-lg p-2 sm:p-4 print:bg-white print:border print:border-green-200 print:p-1">
          <div className="text-[10px] sm:text-xs text-green-600 font-medium mb-1 print:text-[8px]">Total Debit</div>
          <div className="text-sm sm:text-lg font-bold text-gray-900 print:text-[10px]">
            ৳ {formatCurrency(totalDebit)}
          </div>
        </div>
        <div className="bg-red-50 rounded-lg p-2 sm:p-4 print:bg-white print:border print:border-red-200 print:p-1">
          <div className="text-[10px] sm:text-xs text-gray-600 font-medium mb-1 print:text-[8px]">Total Credit</div>
          <div className="text-sm sm:text-lg font-bold text-gray-900 print:text-[10px]">
            ৳ {formatCurrency(totalCredit)}
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-2 sm:p-4 print:bg-white print:border print:border-purple-200 print:p-1">
          <div className="text-[10px] sm:text-xs text-purple-600 font-medium mb-1 print:text-[8px]">Closing Balance</div>
          {(() => {
            const { formatted, suffix, colorClass } = getBalanceInfo(closingBalance);
            return (
              <div className={`text-sm sm:text-lg font-bold ${colorClass} print:text-[10px]`}>
                {formatted}
                <span className="text-[10px] sm:text-xs ml-1 print:text-[8px]">{suffix}</span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Table */}
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm sm:text-base text-left">
          <thead className="bg-[#EBF5F5] border-b border-gray-200 sticky top-0 z-10 print:bg-gray-100">
            <tr className="h-10 sm:h-11 print:h-6">
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-base font-semibold text-black text-left print:px-2 print:py-1 print:text-[9px]">Date</th>
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-base font-semibold text-black text-left print:px-2 print:py-1 print:text-[9px]">Voucher No.</th>
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-base font-semibold text-black text-left print:px-2 print:py-1 print:text-[9px]">Particulars</th>
              {viewMode === "consolidated" && (
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-base font-semibold text-black text-left print:px-2 print:py-1 print:text-[9px]">Account</th>
              )}
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-base font-semibold text-black text-right print:px-2 print:py-1 print:text-[9px]">Debit (৳)</th>
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-base font-semibold text-black text-right print:px-2 print:py-1 print:text-[9px]">Credit (৳)</th>
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-base font-semibold text-black text-right print:px-2 print:py-1 print:text-[9px]">Balance (৳)</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* Opening Balance Row */}
            <tr className="bg-blue-50 hover:bg-blue-50 print:bg-gray-50">
              <td colSpan={viewMode === "consolidated" ? 4 : 3} className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm font-semibold text-gray-900 print:px-2 print:py-1 print:text-[8px]">
                Opening Balance
              </td>
              <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-500 text-right print:px-2 print:py-1 print:text-[8px]">—</td>
              <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-500 text-right print:px-2 print:py-1 print:text-[8px]">—</td>
              {(() => {
                const { formatted, suffix, colorClass } = getBalanceInfo(openingBalance);
                return (
                  <td className={`px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-right font-semibold ${colorClass} print:px-2 print:py-1 print:text-[8px] print:text-black`}>
                    {formatted.replace("৳ ", "")} {suffix}
                  </td>
                );
              })()}
            </tr>

            {data.length === 0 && (
              <tr>
                <td colSpan={viewMode === "consolidated" ? 7 : 6} className="px-3 sm:px-6 py-8 text-center text-gray-500 italic print:py-2 print:text-[8px]">
                  No transactions found for the selected period.
                </td>
              </tr>
            )}
            {data.map((transaction, index) => (
              <tr
                key={index}
                className="hover:bg-gray-50 transition-colors duration-150 print:hover:bg-white"
              >
                <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 print:px-2 print:py-1 print:text-[8px]">
                  {formatDate(transaction.date)}
                </td>
                <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm print:px-2 print:py-1 print:text-[8px]">
                  <span className="text-blue-600 font-medium print:text-black">
                    {transaction.voucherNo || transaction.voucher_no || "—"}
                  </span>
                </td>
                <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm print:px-2 print:py-1 print:text-[8px]">
                  <div className="text-gray-900">{transaction.particulars || transaction.description || "—"}</div>
                  {transaction.narration && (
                    <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 print:text-[7px]">{transaction.narration}</div>
                  )}
                </td>
                {viewMode === "consolidated" && (
                  <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm print:px-2 print:py-1 print:text-[8px]">
                    <div className="text-gray-700">
                      {transaction.accountName || transaction.account_name || "—"}
                    </div>
                    {transaction.accountCode && (
                      <div className="text-[10px] sm:text-xs text-gray-500 print:text-[7px]">
                        {transaction.accountCode || transaction.account_code}
                      </div>
                    )}
                  </td>
                )}
                <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-right print:px-2 print:py-1 print:text-[8px]">
                  {transaction.debit && parseFloat(transaction.debit) > 0 ? (
                    <span className="text-gray-900 font-medium print:text-black">
                      {formatCurrency(transaction.debit)}
                    </span>
                  ) : (
                    <span className="text-gray-400 print:text-gray-300">—</span>
                  )}
                </td>
                <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-right print:px-2 print:py-1 print:text-[8px]">
                  {transaction.credit && parseFloat(transaction.credit) > 0 ? (
                    <span className="text-gray-900 font-medium print:text-black">
                      {formatCurrency(transaction.credit)}
                    </span>
                  ) : (
                    <span className="text-gray-400 print:text-gray-300">—</span>
                  )}
                </td>
                {(() => {
                  const { formatted, suffix, colorClass } = getBalanceInfo(transaction.balance);
                  return (
                    <td className={`px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-right font-semibold ${colorClass} print:px-2 print:py-1 print:text-[8px] print:text-black`}>
                      {formatted.replace("৳ ", "")} {suffix}
                    </td>
                  );
                })()}
              </tr>
            ))}

            {/* Closing Balance Row */}
            <tr className="bg-purple-50 hover:bg-purple-50 font-bold print:bg-gray-100">
              <td colSpan={viewMode === "consolidated" ? 4 : 3} className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-900 print:px-2 print:py-1 print:text-[8px]">
                Closing Balance
              </td>
              <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-right text-gray-900 font-semibold print:px-2 print:py-1 print:text-[8px] print:text-black">
                {formatCurrency(totalDebit)}
              </td>
              <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-right text-gray-900 font-semibold print:px-2 print:py-1 print:text-[8px] print:text-black">
                {formatCurrency(totalCredit)}
              </td>
              {(() => {
                const { formatted, suffix, colorClass } = getBalanceInfo(closingBalance);
                return (
                  <td className={`px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-right font-bold ${colorClass} print:px-2 print:py-1 print:text-[8px] print:text-black`}>
                    {formatted.replace("৳ ", "")} {suffix}
                  </td>
                );
              })()}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-6 py-3 sm:py-4 border-t border-gray-200 print:hidden">
          <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
            Showing {(currentPage - 1) * 20 + 1} to {Math.min(currentPage * 20, totalRecords)} of {totalRecords} transactions
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onPageChange(currentPage - 1);
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
                        onPageChange(page);
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
                } else if (page === currentPage - 2 || page === currentPage + 2) {
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
                onPageChange(currentPage + 1);
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
  );
};

LedgerTable.propTypes = {
  data: PropTypes.array.isRequired,
  openingBalance: PropTypes.number.isRequired,
  closingBalance: PropTypes.number.isRequired,
  totalDebit: PropTypes.number.isRequired,
  totalCredit: PropTypes.number.isRequired,
  currentPage: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  totalRecords: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  viewMode: PropTypes.oneOf(["individual", "consolidated"]).isRequired,
  accountType: PropTypes.string,
};

export default LedgerTable;
