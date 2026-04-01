import { useState, useEffect } from "react";
import axiosInstance from "../../utils/axiosInstance";
import BaseVoucherEntryWithAccountSelect from "./BaseVoucherEntryWithAccountSelect";

const ContraEntryTab = () => {
  const [defaultAccountHeads, setDefaultAccountHeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      await fetchDefaultAccountHeads();
      setLoading(false);
    };
    initialize();
  }, []);

  const fetchDefaultAccountHeads = async () => {
    try {
      const response = await axiosInstance.get("/api/accounts/default-account-heads/");
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      setDefaultAccountHeads(data);
    } catch (error) {
      console.error("Error fetching default account heads:", error);
    }
  };

  if (loading) return null;

  // Filter to show only cash and cash equivalent accounts for contra entries
  // Contra entries are transfers between cash/bank/MFS/petty cash accounts
  // Both debit and credit sides should be cash or cash equivalent accounts only
  const contraAccountFilter = (account) => {
    if (!account.isActive) return false;

    // 1. Identification by default account head configuration (most accurate)
    const cceDefaultHead = defaultAccountHeads.find(h => h.transactionType?.toLowerCase() === 'cce');
    const cceAccountId = cceDefaultHead?.defaultAccount;

    const bankCashDefaultIds = new Set(
      defaultAccountHeads
        .filter(h => ['cash', 'bank', 'mfs', 'cce'].includes(h.transactionType?.toLowerCase()))
        .map(h => h.defaultAccount)
    );

    if (bankCashDefaultIds.has(account.id)) return true;
    
    // If its parent is the CCE account
    if (cceAccountId && (account.parentAccount === cceAccountId || account.parent_account === cceAccountId)) {
      return true;
    }

    // 2. Traditional naming/coding convention
    const accountCode = account.accountCode;
    if (accountCode && (accountCode.startsWith('111') || accountCode.startsWith('112'))) {
      return true;
    }

    // 3. Fallback: If name suggests it's a bank or cash account
    const name = account.accountName?.toLowerCase() || '';
    if (account.accountType === 'asset' && 
       (name.includes('bank') || name.includes('cash') || name.includes('mfs') || 
        name.includes('bkash') || name.includes('nagad') || name.includes('rocket'))) {
      return true;
    }
    
    return false;
  };

  return (
    <div className="space-y-4">
      <BaseVoucherEntryWithAccountSelect
        title="Balance Transfer (Contra)"
        onSaved={() => window.location.reload()}
        accountFilter={contraAccountFilter}
        voucherType="contra"
      />
    </div>
  );
};

export default ContraEntryTab;